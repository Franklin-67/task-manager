const express = require('express');
const router = express.Router();
const {
    readUsers, writeUsers, readTasks, writeTasks,
    readInvites, writeInvites, generateInviteCode,
    readGroups, writeGroups, readUserGroups, writeUserGroups,
    readGroupRequests, writeGroupRequests,
    hashPassword, verifyPassword
} = require('./data');

let users = [];
let tasks = [];
let currentUser = null;

// 初始化数据
async function initialize() {
    users = readUsers();
    tasks = readTasks();

    if (users.length === 0) {
        const hashedPassword = await hashPassword('admin123');
        writeUsers([
            { id: Date.now(), name: '超级管理员', email: 'admin@example.com', password: hashedPassword, role: 'superadmin' }
        ]);
        users = readUsers();
    }

    if (tasks.length === 0) {
        writeTasks([]);
    }
}

initialize().catch(err => console.error('初始化失败:', err));

// 权限验证中间件
function requireAuth(req, res, next) {
    users = readUsers();

    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: '未登录，请先登录' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = JSON.parse(atob(token));
        currentUser = users.find(u => u.id === decoded.id);

        if (!currentUser) {
            return res.status(401).json({ error: '用户不存在' });
        }
        req.user = currentUser;
        next();
    } catch (error) {
        console.error('Token decode error:', error);
        return res.status(401).json({ error: '登录已过期，请重新登录' });
    }
}

// 权限验证中间件（超级管理员）
function requireSuperAdmin(req, res, next) {
    if (!currentUser || currentUser.role !== 'superadmin') {
        return res.status(403).json({ error: '需要超级管理员权限' });
    }
    next();
}

// 权限验证中间件（管理员或超级管理员）
function requireAdmin(req, res, next) {
    if (!currentUser || !['admin', 'superadmin'].includes(currentUser.role)) {
        return res.status(403).json({ error: '需要管理员权限' });
    }
    next();
}

// 检查用户是否是小组管理员或超级管理员
function isGroupAdmin(req, res, next) {
    if (req.params.group_id) {
        const userGroups = readUserGroups();
        const group = readGroups().find(g => g.id == req.params.group_id);
        if (group) {
            const groupAdmins = userGroups.filter(ug => ug.group_id == group.id && ug.role === 'admin');
            if (!groupAdmins.some(ga => ga.user_id === currentUser.id)) {
                return res.status(403).json({ error: '需要小组管理员权限' });
            }
        }
    }
    next();
}

// 生成邀请码（超级管理员）
router.post('/invites', requireSuperAdmin, (req, res) => {
    const { max_uses, expires_in_days } = req.body;

    let expiresAt = null;
    if (expires_in_days) {
        const date = new Date();
        date.setDate(date.getDate() + parseInt(expires_in_days));
        expiresAt = date.toISOString();
    }

    const invite = generateInviteCode(null, max_uses || null, expiresAt);
    writeInvites([...readInvites(), invite]);

    res.json(invite);
});

// 获取邀请码列表（超级管理员）
router.get('/invites', requireSuperAdmin, (req, res) => {
    const invites = readInvites();
    res.json(invites);
});

// 使用邀请码注册（普通用户/管理员）
router.post('/auth/register', async (req, res) => {
    const { email, password, role, invite_code } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: '请填写邮箱和密码' });
    }

    if (users.some(u => u.email === email)) {
        return res.status(409).json({ error: '邮箱已被注册' });
    }

    // 检查邀请码
    if (!invite_code) {
        return res.status(400).json({ error: '请提供邀请码' });
    }

    const invites = readInvites();
    const invite = invites.find(i => i.code === invite_code);

    if (!invite) {
        return res.status(404).json({ error: '邀请码不存在' });
    }

    // 检查邀请码是否过期
    if (invite.expires_at) {
        const expiresDate = new Date(invite.expires_at);
        if (new Date() > expiresDate) {
            return res.status(400).json({ error: '邀请码已过期' });
        }
    }

    // 检查邀请码使用次数
    if (invite.max_uses && invite.uses >= invite.max_uses) {
        return res.status(400).json({ error: '邀请码使用次数已满' });
    }

    // 确定角色
    let userRole = 'member';
    if (role && ['admin', 'superadmin'].includes(role)) {
        userRole = role;
    }

    try {
        const hashedPassword = await hashPassword(password);

        const newUser = {
            id: Date.now(),
            name: email.split('@')[0],
            email,
            password: hashedPassword,
            role: userRole
        };

        users.push(newUser);
        writeUsers(users);
        users = readUsers(); // 更新全局变量

        // 更新邀请码使用次数
        invite.uses += 1;
        writeInvites(invites);

        // 返回用户信息（不包含密码）
        const { password: _, ...userWithoutPassword } = newUser;
        res.json({ message: '注册成功', user: userWithoutPassword });
    } catch (error) {
        console.error('注册失败:', error);
        res.status(500).json({ error: '注册失败' });
    }
});

// 用户登录（更新全局变量）
router.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: '请填写完整信息' });
    }

    const user = users.find(u => u.email === email);
    if (!user) {
        return res.status(401).json({ error: '邮箱或密码错误' });
    }

    try {
        const isValid = await verifyPassword(password, user.password);
        if (!isValid) {
            return res.status(401).json({ error: '邮箱或密码错误' });
        }

        // 更新全局用户列表
        users = readUsers();

        // 生成 token
        const token = btoa(JSON.stringify({ id: user.id, email: user.email }));
        const { password: _, ...userWithoutPassword } = user;

        res.json({ token, user: userWithoutPassword });
    } catch (error) {
        console.error('登录失败:', error);
        res.status(500).json({ error: '登录失败' });
    }
});

// 获取当前用户信息
router.get('/auth/me', requireAuth, (req, res) => {
    const { password: _, ...userWithoutPassword } = currentUser;
    res.json(userWithoutPassword);
});

// 获取所有用户（超级管理员）
router.get('/users', requireSuperAdmin, (req, res) => {
    const usersWithoutPassword = users.map(({ password: _, ...user }) => user);
    res.json(usersWithoutPassword.sort((a, b) => a.name.localeCompare(b.name)));
});

// 创建用户（超级管理员）
router.post('/users', requireSuperAdmin, async (req, res) => {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ error: '请填写完整信息' });
    }

    if (users.some(u => u.email === email)) {
        return res.status(409).json({ error: '邮箱已被使用' });
    }

    try {
        const hashedPassword = await hashPassword(password);
        const newUser = {
            id: Date.now(),
            name,
            email,
            password: hashedPassword,
            role: role || 'admin'
        };

        users.push(newUser);
        writeUsers(users);

        const { password: _, ...userWithoutPassword } = newUser;
        res.json(userWithoutPassword);
    } catch (error) {
        console.error('创建用户失败:', error);
        res.status(500).json({ error: '创建用户失败' });
    }
});

// 删除用户（超级管理员）
router.delete('/users/:id', requireSuperAdmin, (req, res) => {
    const initialLength = users.length;
    users = users.filter(u => u.id != req.params.id);

    if (users.length === initialLength) {
        return res.status(404).json({ error: '用户不存在' });
    }

    writeUsers(users);
    res.json({ success: true });
});

// 创建小组（管理员）
router.post('/groups', requireAdmin, (req, res) => {
    const { name, description } = req.body;

    if (!name) {
        return res.status(400).json({ error: '请填写小组名称' });
    }

    if (name.length > 100) {
        return res.status(400).json({ error: '小组名称不能超过100个字符' });
    }

    const groups = readGroups();
    if (groups.some(g => g.name === name)) {
        return res.status(409).json({ error: '小组名称已存在' });
    }

    const newGroup = {
        id: Date.now(),
        name,
        description: description || '',
        created_by: currentUser.id,
        created_at: new Date().toISOString()
    };

    groups.push(newGroup);
    writeGroups(groups);

    const userGroups = readUserGroups();
    userGroups.push({
        user_id: currentUser.id,
        group_id: newGroup.id,
        role: 'admin'
    });
    writeUserGroups(userGroups);

    // 更新全局变量
    users = readUsers();
    tasks = readTasks();

    res.json(newGroup);
});

// 获取所有小组（超级管理员）
router.get('/groups', requireSuperAdmin, (req, res) => {
    const groups = readGroups();
    res.json(groups);
});

// 获取小组申请列表（超级管理员）
router.get('/groups/requests', requireSuperAdmin, (req, res) => {
    const requests = readGroupRequests();
    const users = readUsers();
    const groups = readGroups();

    const requestsWithDetails = requests.map(req => ({
        ...req,
        requester_name: users.find(u => u.id === req.user_id)?.name || '未知',
        group_name: groups.find(g => g.id === req.group_id)?.name || '未知'
    }));

    res.json(requestsWithDetails.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
});

// 提交小组创建申请（管理员）
router.post('/groups/requests', requireAdmin, (req, res) => {
    const { group_id } = req.body;

    if (!group_id) {
        return res.status(400).json({ error: '请选择小组' });
    }

    const group = readGroups().find(g => g.id == group_id);
    if (!group) {
        return res.status(404).json({ error: '小组不存在' });
    }

    const requests = readGroupRequests();
    if (requests.some(r => r.user_id === currentUser.id && r.group_id === group.id)) {
        return res.status(400).json({ error: '申请已提交' });
    }

    const newRequest = {
        id: Date.now(),
        user_id: currentUser.id,
        group_id: group.id,
        status: 'pending',
        created_at: new Date().toISOString()
    };

    requests.push(newRequest);
    writeGroupRequests(requests);

    res.json({ message: '申请已提交' });
});

// 获取我的小组申请（管理员）
router.get('/groups/my-requests', requireAdmin, (req, res) => {
    const requests = readGroupRequests().filter(r => r.user_id === currentUser.id);
    res.json(requests);
});

// 批准/拒绝小组申请（超级管理员）
router.put('/groups/requests/:id', requireSuperAdmin, (req, res) => {
    const { status } = req.body;
    const requests = readGroupRequests();

    const reqIndex = requests.findIndex(r => r.id == req.params.id);
    if (reqIndex === -1) {
        return res.status(404).json({ error: '申请不存在' });
    }

    if (status !== 'approved' && status !== 'rejected') {
        return res.status(400).json({ error: '无效的状态' });
    }

    const request = requests[reqIndex];
    request.status = status;

    if (status === 'approved') {
        const userGroups = readUserGroups();
        if (!userGroups.some(ug => ug.user_id === request.user_id && ug.group_id === request.group_id)) {
            userGroups.push({
                user_id: request.user_id,
                group_id: request.group_id,
                role: 'member'
            });
            writeUserGroups(userGroups);
        }
    }

    requests[reqIndex] = request;
    writeGroupRequests(requests);

    res.json({ message: status === 'approved' ? '批准成功' : '拒绝成功' });
});

// 获取我的小组列表
router.get('/my-groups', requireAuth, (req, res) => {
    const userGroups = readUserGroups().filter(ug => ug.user_id === currentUser.id);
    const groups = readGroups();

    const groupsWithDetails = userGroups.map(ug => {
        const group = groups.find(g => g.id === ug.group_id);
        return {
            ...ug,
            ...group,
            role: ug.role
        };
    });

    res.json(groupsWithDetails);
});

// 获取所有小组（管理员或超级管理员）
router.get('/groups-admin', requireAuth, (req, res) => {
    if (!['admin', 'superadmin'].includes(currentUser.role)) {
        return res.status(403).json({ error: '需要管理员权限' });
    }

    const groups = readGroups();
    const userGroups = readUserGroups();

    const groupsWithDetails = groups.map(group => {
        const userGroup = userGroups.find(ug => ug.group_id === group.id);
        return {
            ...group,
            member_count: userGroups.filter(ug => ug.group_id === group.id).length,
            role: userGroup ? userGroup.role : null
        };
    });

    res.json(groupsWithDetails);
});

// 获取所有任务
router.get('/tasks', requireAuth, (req, res) => {
    const { assignee_id, status, priority, group_id } = req.query;

    let filteredTasks = tasks;

    if (assignee_id) {
        filteredTasks = filteredTasks.filter(t => t.assignee_id == assignee_id);
    }
    if (status) {
        filteredTasks = filteredTasks.filter(t => t.status === status);
    }
    if (priority) {
        filteredTasks = filteredTasks.filter(t => t.priority === priority);
    }
    if (group_id) {
        filteredTasks = filteredTasks.filter(t => t.group_id && t.group_id == group_id);
    }

    const tasksWithAssignee = filteredTasks.map(task => {
        const assignee = users.find(u => u.id == task.assignee_id);
        return {
            ...task,
            assignee_name: assignee ? assignee.name : null
        };
    });

    res.json(tasksWithAssignee.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
});

// 获取单个任务
router.get('/tasks/:id', requireAuth, (req, res) => {
    const task = tasks.find(t => t.id == req.params.id);
    if (!task) {
        return res.status(404).json({ error: '任务不存在' });
    }
    const assignee = users.find(u => u.id == task.assignee_id);
    res.json({
        ...task,
        assignee_name: assignee ? assignee.name : null
    });
});

// 创建任务
router.post('/tasks', requireAuth, (req, res) => {
    const { title, description, status, priority, tags, assignee_id, deadline, group_id } = req.body;

    if (!title) {
        return res.status(400).json({ error: '请填写任务标题' });
    }

    // 如果提供了group_id，验证用户是否有权限在该小组中创建任务
    if (group_id) {
        const userGroups = readUserGroups();
        const hasPermission = userGroups.some(ug =>
            ug.user_id === currentUser.id && ug.group_id == group_id
        );

        if (!hasPermission) {
            return res.status(403).json({ error: '您没有权限在这个小组中创建任务' });
        }
    }

    const newTask = {
        id: Date.now(),
        title,
        description: description || '',
        status: status || 'todo',
        priority: priority || 'medium',
        tags: tags || [],
        assignee_id: assignee_id || null,
        deadline: deadline || null,
        group_id: group_id || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };

    tasks.push(newTask);
    writeTasks(tasks);
    res.json(newTask);
});

// 更新任务
router.put('/tasks/:id', requireAuth, (req, res) => {
    const { title, description, status, priority, tags, assignee_id, deadline, group_id } = req.body;

    const taskIndex = tasks.findIndex(t => t.id == req.params.id);
    if (taskIndex === -1) {
        return res.status(404).json({ error: '任务不存在' });
    }

    const task = tasks[taskIndex];

    if (title !== undefined) task.title = title;
    if (description !== undefined) task.description = description;
    if (status) task.status = status;
    if (priority) task.priority = priority;
    if (tags) task.tags = tags;
    if (assignee_id !== undefined) task.assignee_id = assignee_id;
    if (deadline) task.deadline = deadline;
    if (group_id !== undefined) task.group_id = group_id;

    task.updated_at = new Date().toISOString();

    tasks[taskIndex] = task;
    writeTasks(tasks);
    res.json({ success: true });
});

// 删除任务
router.delete('/tasks/:id', requireAuth, (req, res) => {
    const initialLength = tasks.length;
    tasks = tasks.filter(t => t.id != req.params.id);

    if (tasks.length === initialLength) {
        return res.status(404).json({ error: '任务不存在' });
    }

    writeTasks(tasks);
    res.json({ success: true });
});

// 统计数据
router.get('/stats', requireAuth, (req, res) => {
    res.json({
        total_users: users.length,
        total_tasks: tasks.length,
        todo_count: tasks.filter(t => t.status === 'todo').length,
        in_progress_count: tasks.filter(t => t.status === 'in_progress').length,
        done_count: tasks.filter(t => t.status === 'done').length
    });
});

module.exports = router;
