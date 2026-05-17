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

async function initialize() {
    users = readUsers();
    tasks = readTasks();
    await require('./data').initializeData();
    users = readUsers();
    tasks = readTasks();
}

initialize().catch(err => console.error('初始化失败:', err));

function requireAuth(req, res, next) {
    users = readUsers();

    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: '未登录，请先登录' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
        const user = users.find(u => u.id === decoded.id);

        if (!user) {
            console.log('requireAuth 用户未找到:', { decodedId: decoded.id, userIds: users.map(u => u.id) });
            return res.status(401).json({ error: '用户不存在' });
        }
        req.user = user;
        next();
    } catch (error) {
        return res.status(401).json({ error: '登录已过期，请重新登录' });
    }
}

function requireSuperAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'superadmin') {
        console.log('requireSuperAdmin 拒绝:', {
            hasUser: !!req.user,
            role: req.user ? req.user.role : 'no-user',
            email: req.user ? req.user.email : 'no-user'
        });
        return res.status(403).json({ error: '需要超级管理员权限' });
    }
    next();
}

function requireAdmin(req, res, next) {
    if (!req.user || !['admin', 'superadmin'].includes(req.user.role)) {
        return res.status(403).json({ error: '需要管理员权限' });
    }
    next();
}

function isGroupAdmin(req, res, next) {
    if (req.params.group_id) {
        const userGroups = readUserGroups();
        const group = readGroups().find(g => g.id == req.params.group_id);
        if (group) {
            const groupAdmins = userGroups.filter(ug => ug.group_id == group.id && ug.role === 'admin');
            if (!groupAdmins.some(ga => ga.user_id === req.user.id)) {
                return res.status(403).json({ error: '需要小组管理员权限' });
            }
        }
    }
    next();
}

router.post('/auth/register', async (req, res) => {
    const { email, password, role, invite_code } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: '请填写邮箱和密码' });
    }

    users = readUsers();
    if (users.some(u => u.email === email)) {
        return res.status(409).json({ error: '邮箱已被注册' });
    }

    if (!invite_code) {
        return res.status(400).json({ error: '请提供邀请码' });
    }

    const invites = readInvites();
    const invite = invites.find(i => i.code === invite_code);

    if (!invite) {
        return res.status(404).json({ error: '邀请码不存在' });
    }

    if (invite.expires_at) {
        if (new Date() > new Date(invite.expires_at)) {
            return res.status(400).json({ error: '邀请码已过期' });
        }
    }

    if (invite.max_uses && invite.uses >= invite.max_uses) {
        return res.status(400).json({ error: '邀请码使用次数已满' });
    }

    let userRole = 'member';
    if (role && ['admin', 'superadmin'].includes(role)) {
        userRole = role;
    }

    if (invite.role && userRole !== invite.role) {
        return res.status(400).json({ error: `此邀请码只能注册为${invite.role === 'admin' ? '管理员' : '普通成员'}` });
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
        users = readUsers();

        invite.uses += 1;
        writeInvites(invites);

        const { password: _, ...userWithoutPassword } = newUser;
        res.json({ message: '注册成功', user: userWithoutPassword });
    } catch (error) {
        console.error('注册失败:', error);
        res.status(500).json({ error: '注册失败' });
    }
});

router.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: '请填写完整信息' });
    }

    users = readUsers();
    const user = users.find(u => u.email === email);

    if (!user) {
        return res.status(401).json({ error: '邮箱或密码错误' });
    }

    try {
        const isValid = await verifyPassword(password, user.password);
        if (!isValid) {
            return res.status(401).json({ error: '邮箱或密码错误' });
        }

        users = readUsers();

        const token = Buffer.from(JSON.stringify({ id: user.id, email: user.email })).toString('base64');
        const { password: _, ...userWithoutPassword } = user;

        res.json({ token, user: userWithoutPassword });
    } catch (error) {
        console.error('登录失败:', error);
        res.status(500).json({ error: '登录失败' });
    }
});

router.get('/auth/me', requireAuth, (req, res) => {
    const { password: _, ...userWithoutPassword } = req.user;
    res.json(userWithoutPassword);
});

router.post('/invites', requireAuth, requireSuperAdmin, (req, res) => {
    const { max_uses, expires_in_days, role } = req.body;

    let expiresAt = null;
    if (expires_in_days) {
        const date = new Date();
        date.setDate(date.getDate() + parseInt(expires_in_days));
        expiresAt = date.toISOString();
    }

    if (role && !['member', 'admin'].includes(role)) {
        return res.status(400).json({ error: '角色只能是 member 或 admin' });
    }

    const invite = generateInviteCode(null, max_uses || null, expiresAt, role || 'member');
    writeInvites([...readInvites(), invite]);

    res.json(invite);
});

router.get('/invites', requireAuth, requireSuperAdmin, (req, res) => {
    const invites = readInvites();
    res.json(invites);
});

router.delete('/invites/:code', requireAuth, requireSuperAdmin, (req, res) => {
    const code = req.params.code;
    const invites = readInvites();
    const initialLength = invites.length;

    const filtered = invites.filter(i => i.code !== code);

    if (filtered.length === initialLength) {
        return res.status(404).json({ error: '邀请码不存在' });
    }

    writeInvites(filtered);
    res.json({ success: true });
});

router.post('/users', requireAuth, requireSuperAdmin, async (req, res) => {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ error: '请填写完整信息' });
    }

    users = readUsers();
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

router.get('/users', requireAuth, (req, res) => {
    users = readUsers();
    let visibleUsers = users;

    if (req.user.role !== 'superadmin') {
        const userGroups = readUserGroups();
        const myGroupIds = userGroups
            .filter(ug => ug.user_id === req.user.id)
            .map(ug => ug.group_id);

        const memberIds = new Set();
        userGroups
            .filter(ug => myGroupIds.includes(ug.group_id))
            .forEach(ug => memberIds.add(ug.user_id));
        memberIds.add(req.user.id);

        visibleUsers = users.filter(u => memberIds.has(u.id));
    }

    const usersWithoutPasswords = visibleUsers.map(u => {
        const { password: _, ...rest } = u;
        const userGroups = readUserGroups().filter(ug => ug.user_id === u.id);
        const groups = readGroups();
        rest.groups = userGroups.map(ug => {
            const g = groups.find(gr => gr.id === ug.group_id);
            return g ? { id: g.id, name: g.name, role: ug.role } : null;
        }).filter(Boolean);
        return rest;
    });
    res.json(usersWithoutPasswords);
});

router.delete('/users/:id', requireAuth, requireSuperAdmin, (req, res) => {
    const targetId = parseInt(req.params.id);

    if (targetId === req.user.id) {
        return res.status(400).json({ error: '不能删除自己' });
    }

    users = readUsers();
    const initialLength = users.length;
    users = users.filter(u => u.id !== targetId);

    if (users.length === initialLength) {
        return res.status(404).json({ error: '用户不存在' });
    }

    writeUsers(users);

    const userGroups = readUserGroups().filter(ug => ug.user_id !== targetId);
    writeUserGroups(userGroups);

    const groupRequests = readGroupRequests().filter(r => r.user_id !== targetId);
    writeGroupRequests(groupRequests);

    tasks = readTasks();
    tasks.forEach(t => {
        if (t.assignee_id == targetId) t.assignee_id = null;
    });
    writeTasks(tasks);

    res.json({ success: true });
});

router.post('/groups', requireAuth, requireAdmin, (req, res) => {
    const { name, description } = req.body;

    if (!name) {
        return res.status(400).json({ error: '请填写小组名称' });
    }

    if (name.length > 100) {
        return res.status(400).json({ error: '小组名称不能超过100个字符' });
    }

    users = readUsers();
    const groups = readGroups();
    if (groups.some(g => g.name === name)) {
        return res.status(409).json({ error: '小组名称已存在' });
    }

    const newGroup = {
        id: Date.now(),
        name,
        description: description || '',
        created_by: req.user.id,
        created_at: new Date().toISOString()
    };

    groups.push(newGroup);
    writeGroups(groups);

    const userGroups = readUserGroups();
    userGroups.push({
        user_id: req.user.id,
        group_id: newGroup.id,
        role: 'admin'
    });
    writeUserGroups(userGroups);

    users = readUsers();
    tasks = readTasks();

    res.json(newGroup);
});

router.get('/groups', requireAuth, requireSuperAdmin, (req, res) => {
    const groups = readGroups();
    const userGroups = readUserGroups();
    users = readUsers();

    const groupsWithDetails = groups.map(group => {
        const groupMembers = userGroups.filter(ug => ug.group_id === group.id);
        const creator = users.find(u => u.id === group.created_by);
        return {
            ...group,
            member_count: groupMembers.length,
            creator_name: creator ? creator.name : '未知'
        };
    });

    res.json(groupsWithDetails);
});

router.put('/groups/:id', requireAuth, requireSuperAdmin, (req, res) => {
    const groupId = parseInt(req.params.id);
    const { name, description } = req.body;

    if (!name) {
        return res.status(400).json({ error: '请填写小组名称' });
    }

    const groups = readGroups();
    const groupIndex = groups.findIndex(g => g.id === groupId);

    if (groupIndex === -1) {
        return res.status(404).json({ error: '小组不存在' });
    }

    if (groups.some(g => g.name === name && g.id !== groupId)) {
        return res.status(409).json({ error: '小组名称已存在' });
    }

    groups[groupIndex].name = name;
    groups[groupIndex].description = description || '';
    writeGroups(groups);

    res.json(groups[groupIndex]);
});

router.delete('/groups/:id', requireAuth, requireSuperAdmin, (req, res) => {
    const groupId = parseInt(req.params.id);

    const groups = readGroups();
    const initialLength = groups.length;
    const filtered = groups.filter(g => g.id !== groupId);

    if (filtered.length === initialLength) {
        return res.status(404).json({ error: '小组不存在' });
    }

    writeGroups(filtered);

    const userGroups = readUserGroups().filter(ug => ug.group_id !== groupId);
    writeUserGroups(userGroups);

    tasks = readTasks();
    tasks.forEach(t => {
        if (t.group_id == groupId) t.group_id = null;
    });
    writeTasks(tasks);

    res.json({ success: true });
});

router.get('/groups-admin', requireAuth, (req, res) => {
    if (!['admin', 'superadmin'].includes(req.user.role)) {
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

router.post('/groups/requests', requireAuth, requireAdmin, (req, res) => {
    const { group_id } = req.body;

    if (!group_id) {
        return res.status(400).json({ error: '请选择小组' });
    }

    users = readUsers();
    const groups = readGroups();
    const group = groups.find(g => g.id == group_id);

    if (!group) {
        return res.status(404).json({ error: '小组不存在' });
    }

    const groupRequests = readGroupRequests();
    if (groupRequests.some(r => r.user_id === req.user.id && r.group_id === group.id)) {
        return res.status(400).json({ error: '申请已提交' });
    }

    const newRequest = {
        id: Date.now(),
        user_id: req.user.id,
        group_id: group.id,
        status: 'pending',
        created_at: new Date().toISOString()
    };

    groupRequests.push(newRequest);
    writeGroupRequests(groupRequests);

    res.json({ message: '申请已提交' });
});

router.get('/groups/my-requests', requireAuth, requireAdmin, (req, res) => {
    const groupRequests = readGroupRequests().filter(r => r.user_id === req.user.id);
    res.json(groupRequests);
});

router.put('/groups/requests/:id', requireAuth, requireSuperAdmin, (req, res) => {
    const { status } = req.body;
    const groupRequests = readGroupRequests();

    const reqIndex = groupRequests.findIndex(r => r.id == req.params.id);
    if (reqIndex === -1) {
        return res.status(404).json({ error: '申请不存在' });
    }

    if (status !== 'approved' && status !== 'rejected') {
        return res.status(400).json({ error: '无效的状态' });
    }

    const request = groupRequests[reqIndex];
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

    groupRequests[reqIndex] = request;
    writeGroupRequests(groupRequests);

    res.json({ message: status === 'approved' ? '批准成功' : '拒绝成功' });
});

router.get('/my-groups', requireAuth, (req, res) => {
    const userGroups = readUserGroups().filter(ug => ug.user_id === req.user.id);
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

function requireGroupAdmin(req, res, next) {
    const groupId = parseInt(req.params.groupId);
    const userGroups = readUserGroups();
    const isAdmin = userGroups.some(ug =>
        ug.user_id === req.user.id && ug.group_id === groupId && ug.role === 'admin'
    );

    if (!isAdmin && req.user.role !== 'superadmin') {
        return res.status(403).json({ error: '需要小组管理员权限' });
    }
    next();
}

router.get('/groups/:groupId/members', requireAuth, requireGroupAdmin, (req, res) => {
    const groupId = parseInt(req.params.groupId);
    const userGroups = readUserGroups().filter(ug => ug.group_id === groupId);
    users = readUsers();
    const groups = readGroups();
    const group = groups.find(g => g.id === groupId);

    const members = userGroups.map(ug => {
        const user = users.find(u => u.id === ug.user_id);
        if (!user) return null;
        const { password: _, ...rest } = user;
        return { ...rest, groupRole: ug.role };
    }).filter(Boolean);

    res.json({ group: group || null, members });
});

router.post('/groups/:groupId/members', requireAuth, requireGroupAdmin, (req, res) => {
    const groupId = parseInt(req.params.groupId);
    const { user_id } = req.body;

    if (!user_id) {
        return res.status(400).json({ error: '请选择要添加的成员' });
    }

    users = readUsers();
    const user = users.find(u => u.id == user_id);
    if (!user) {
        return res.status(404).json({ error: '用户不存在' });
    }

    const userGroups = readUserGroups();
    if (userGroups.some(ug => ug.user_id == user_id && ug.group_id === groupId)) {
        return res.status(409).json({ error: '该用户已在小组中' });
    }

    userGroups.push({
        user_id: user.id,
        group_id: groupId,
        role: 'member'
    });
    writeUserGroups(userGroups);

    const { password: _, ...userWithoutPassword } = user;
    res.json({ message: '添加成功', user: userWithoutPassword });
});

router.delete('/groups/:groupId/members/:userId', requireAuth, requireGroupAdmin, (req, res) => {
    const groupId = parseInt(req.params.groupId);
    const userId = parseInt(req.params.userId);

    if (userId === req.user.id) {
        return res.status(400).json({ error: '不能移除自己' });
    }

    const userGroups = readUserGroups();
    const initialLength = userGroups.length;
    const filtered = userGroups.filter(ug => !(ug.user_id === userId && ug.group_id === groupId));

    if (filtered.length === initialLength) {
        return res.status(404).json({ error: '该成员不在小组中' });
    }

    writeUserGroups(filtered);
    res.json({ success: true });
});

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

router.post('/tasks', requireAuth, (req, res) => {
    const { title, description, status, priority, tags, assignee_id, deadline, group_id } = req.body;

    if (!title) {
        return res.status(400).json({ error: '请填写任务标题' });
    }

    if (group_id) {
        const userGroups = readUserGroups();
        const hasPermission = userGroups.some(ug =>
            ug.user_id === req.user.id && ug.group_id == group_id
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

router.put('/tasks/:id', requireAuth, (req, res) => {
    const { title, description, status, priority, tags, assignee_id, deadline, group_id } = req.body;

    const taskIndex = tasks.findIndex(t => t.id == req.params.id);
    if (taskIndex === -1) {
        return res.status(404).json({ error: '任务不存在' });
    }

    const task = tasks[taskIndex];

    const targetGroupId = group_id !== undefined ? group_id : task.group_id;
    if (targetGroupId) {
        const userGroups = readUserGroups();
        const hasPermission = userGroups.some(ug =>
            ug.user_id === req.user.id && ug.group_id == targetGroupId
        );

        if (!hasPermission) {
            return res.status(403).json({ error: '您没有权限在该小组中编辑任务' });
        }
    }

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

router.delete('/tasks/:id', requireAuth, (req, res) => {
    tasks = readTasks();
    const initialLength = tasks.length;
    tasks = tasks.filter(t => t.id != req.params.id);

    if (tasks.length === initialLength) {
        return res.status(404).json({ error: '任务不存在' });
    }

    writeTasks(tasks);
    res.json({ success: true });
});

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
