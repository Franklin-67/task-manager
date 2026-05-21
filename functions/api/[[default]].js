// ─── KV Storage ────────────────────────────────────────────────────

const kv = typeof TASK_KV !== 'undefined' ? TASK_KV : null;

async function getCollection(name) {
    if (!kv) return [];
    try {
        const data = await kv.get(name, { type: 'json' });
        return Array.isArray(data) ? data : [];
    } catch {
        return [];
    }
}

async function setCollection(name, data) {
    if (!kv) return;
    await kv.put(name, JSON.stringify(data));
}

async function initializeData() {
    let users = await getCollection('users');

    if (users.length === 0) {
        const hashed = await hashPassword('admin123');
        users = [{
            id: Date.now(),
            name: '超级管理员',
            email: 'admin@example.com',
            password: hashed,
            role: 'superadmin'
        }];
        await setCollection('users', users);
    }

    return users;
}

// ─── Password / Auth (Web Crypto PBKDF2) ────────────────────────────

async function hashPassword(password) {
    const encoder = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
    const hash = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
        key, 256
    );
    const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
    const hashHex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
    return `pbkdf2$${saltHex}$${hashHex}`;
}

async function verifyPassword(password, stored) {
    if (!stored.startsWith('pbkdf2$')) {
        // legacy bcrypt — allow for migrated data
        return false;
    }
    const [, saltHex, hashHex] = stored.split('$');
    const salt = new Uint8Array(saltHex.match(/.{2}/g).map(b => parseInt(b, 16)));
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
    const hash = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
        key, 256
    );
    const computedHex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
    return computedHex === hashHex;
}

function generateToken(user) {
    return btoa(JSON.stringify({ id: user.id, email: user.email }));
}

function generateInviteCode(code, maxUses, expiresAt, role) {
    return {
        code: code || Array.from(crypto.getRandomValues(new Uint8Array(6)), b => b.toString(16).padStart(2, '0')).join(''),
        max_uses: maxUses || null,
        uses: 0,
        role: role || 'member',
        created_at: new Date().toISOString(),
        expires_at: expiresAt || null
    };
}

// ─── Auth Middleware ────────────────────────────────────────────────

async function authenticate(request) {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) return null;
    try {
        const token = authHeader.split(' ')[1];
        const decoded = JSON.parse(atob(token));
        const users = await getCollection('users');
        const user = users.find(u => u.id === decoded.id);
        return user || null;
    } catch {
        return null;
    }
}

function getParams(pattern, pathname) {
    const match = pathname.match(pattern);
    if (!match) return null;
    return match.groups || {};
}

// ─── Response Helpers ───────────────────────────────────────────────

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
    });
}

function errorResponse(message, status = 400) {
    return jsonResponse({ error: message }, status);
}

// ─── Initialize ─────────────────────────────────────────────────────

let usersCache = null;
let initPromise = null;

function ensureInit() {
    if (!initPromise) {
        initPromise = initializeData().then(users => { usersCache = users; }).catch(() => {});
    }
    return initPromise;
}

async function readUsers() {
    await ensureInit();
    return getCollection('users');
}

// ─── Route Handlers ─────────────────────────────────────────────────

async function handlePing(request) {
    const users = await readUsers();
    const rawUrl = request.url || '';
    const pathname = rawUrl.indexOf('?') !== -1 ? rawUrl.slice(0, rawUrl.indexOf('?')) : rawUrl;
    const cleanPath = pathname.includes('://') ? '/' + pathname.split('/').slice(3).join('/') : pathname;
    return jsonResponse({
        ok: true, time: Date.now(), storage: kv ? 'kv' : 'none',
        users: users.length,
        tasks: (await getCollection('tasks')).length,
        url: rawUrl,
        cleanPath: cleanPath,
        method: request.method
    });
}

async function handleRegister(request) {
    const { email, password, role, invite_code } = await request.json().catch(() => ({}));
    if (!email || !password) return errorResponse('请填写邮箱和密码');

    const users = await readUsers();
    if (users.some(u => u.email === email)) return errorResponse('邮箱已被注册', 409);
    if (!invite_code) return errorResponse('请提供邀请码');

    const invites = await getCollection('invites');
    const invite = invites.find(i => i.code === invite_code);
    if (!invite) return errorResponse('邀请码不存在', 404);
    if (invite.expires_at && new Date() > new Date(invite.expires_at)) return errorResponse('邀请码已过期');
    if (invite.max_uses && invite.uses >= invite.max_uses) return errorResponse('邀请码使用次数已满');

    let userRole = invite.role || 'member';
    if (role && ['admin', 'member'].includes(role)) userRole = role;
    if (invite.role && userRole !== invite.role) return errorResponse(`此邀请码只能注册为${invite.role === 'admin' ? '管理员' : '普通成员'}`);

    const hashed = await hashPassword(password);
    const newUser = { id: Date.now(), name: email.split('@')[0], email, password: hashed, role: userRole };
    users.push(newUser);
    await setCollection('users', users);

    invite.uses += 1;
    await setCollection('invites', invites);

    const { password: _, ...userWithoutPassword } = newUser;
    return jsonResponse({ message: '注册成功', user: userWithoutPassword });
}

async function handleLogin(request) {
    const { email, password } = await request.json().catch(() => ({}));
    if (!email || !password) return errorResponse('请填写完整信息');

    const users = await readUsers();
    const user = users.find(u => u.email === email);
    if (!user) return errorResponse('邮箱或密码错误', 401);

    const valid = await verifyPassword(password, user.password);
    if (!valid) return errorResponse('邮箱或密码错误', 401);

    const token = generateToken(user);
    const { password: _, ...userWithoutPassword } = user;
    return jsonResponse({ token, user: userWithoutPassword });
}

async function handleMe(request) {
    const user = await authenticate(request);
    if (!user) return errorResponse('未登录', 401);
    const { password: _, ...rest } = user;
    return jsonResponse(rest);
}

async function handleCreateInvite(request) {
    const user = await authenticate(request);
    if (!user || user.role !== 'superadmin') return errorResponse('需要超级管理员权限', 403);

    const { max_uses, expires_in_days, role } = await request.json().catch(() => ({}));
    let expiresAt = null;
    if (expires_in_days) {
        const date = new Date();
        date.setDate(date.getDate() + parseInt(expires_in_days));
        expiresAt = date.toISOString();
    }
    if (role && !['member', 'admin'].includes(role)) return errorResponse('角色只能是 member 或 admin');

    const invite = generateInviteCode(null, max_uses || null, expiresAt, role || 'member');
    const invites = await getCollection('invites');
    invites.push(invite);
    await setCollection('invites', invites);
    return jsonResponse(invite);
}

async function handleGetInvites(request) {
    const user = await authenticate(request);
    if (!user || user.role !== 'superadmin') return errorResponse('需要超级管理员权限', 403);
    return jsonResponse(await getCollection('invites'));
}

async function handleDeleteInvite(request, params) {
    const user = await authenticate(request);
    if (!user || user.role !== 'superadmin') return errorResponse('需要超级管理员权限', 403);

    const invites = await getCollection('invites');
    const filtered = invites.filter(i => i.code !== params.code);
    if (filtered.length === invites.length) return errorResponse('邀请码不存在', 404);
    await setCollection('invites', filtered);
    return jsonResponse({ success: true });
}

async function handleCreateUser(request) {
    const auth = await authenticate(request);
    if (!auth || auth.role !== 'superadmin') return errorResponse('需要超级管理员权限', 403);

    const { name, email, password, role } = await request.json().catch(() => ({}));
    if (!name || !email || !password) return errorResponse('请填写完整信息');

    const users = await readUsers();
    if (users.some(u => u.email === email)) return errorResponse('邮箱已被使用', 409);

    const hashed = await hashPassword(password);
    const newUser = { id: Date.now(), name, email, password: hashed, role: role || 'admin' };
    users.push(newUser);
    await setCollection('users', users);

    const { password: _, ...rest } = newUser;
    return jsonResponse(rest);
}

async function handleGetUsers(request) {
    const auth = await authenticate(request);
    if (!auth) return errorResponse('未登录', 401);

    const users = await readUsers();
    let visible = users;

    if (auth.role !== 'superadmin') {
        const userGroups = await getCollection('user_groups');
        const myGroupIds = userGroups.filter(ug => ug.user_id === auth.id).map(ug => ug.group_id);
        const memberIds = new Set();
        userGroups.filter(ug => myGroupIds.includes(ug.group_id)).forEach(ug => memberIds.add(ug.user_id));
        memberIds.add(auth.id);
        visible = users.filter(u => memberIds.has(u.id));
    }

    const allUserGroups = await getCollection('user_groups');
    const groups = await getCollection('groups');
    const result = visible.map(u => {
        const { password: _, ...rest } = u;
        rest.groups = allUserGroups.filter(ug => ug.user_id === u.id).map(ug => {
            const g = groups.find(gr => gr.id === ug.group_id);
            return g ? { id: g.id, name: g.name, role: ug.role } : null;
        }).filter(Boolean);
        return rest;
    });
    return jsonResponse(result);
}

async function handleDeleteUser(request, params) {
    const auth = await authenticate(request);
    if (!auth || auth.role !== 'superadmin') return errorResponse('需要超级管理员权限', 403);

    const targetId = parseInt(params.id);
    if (targetId === auth.id) return errorResponse('不能删除自己');

    let users = await readUsers();
    if (!users.some(u => u.id === targetId)) return errorResponse('用户不存在', 404);
    users = users.filter(u => u.id !== targetId);
    await setCollection('users', users);

    let userGroups = await getCollection('user_groups');
    userGroups = userGroups.filter(ug => ug.user_id !== targetId);
    await setCollection('user_groups', userGroups);

    let groupRequests = await getCollection('group_requests');
    groupRequests = groupRequests.filter(r => r.user_id !== targetId);
    await setCollection('group_requests', groupRequests);

    let tasks = await getCollection('tasks');
    tasks.forEach(t => { if (t.assignee_id == targetId) t.assignee_id = null; });
    await setCollection('tasks', tasks);

    return jsonResponse({ success: true });
}

async function handleCreateGroup(request) {
    const auth = await authenticate(request);
    if (!auth || !['admin', 'superadmin'].includes(auth.role)) return errorResponse('需要管理员权限', 403);

    const { name, description } = await request.json().catch(() => ({}));
    if (!name) return errorResponse('请填写小组名称');
    if (name.length > 100) return errorResponse('小组名称不能超过100个字符');

    const groups = await getCollection('groups');
    if (groups.some(g => g.name === name)) return errorResponse('小组名称已存在', 409);

    const newGroup = { id: Date.now(), name, description: description || '', created_by: auth.id, created_at: new Date().toISOString() };
    groups.push(newGroup);
    await setCollection('groups', groups);

    const userGroups = await getCollection('user_groups');
    userGroups.push({ user_id: auth.id, group_id: newGroup.id, role: 'admin' });
    await setCollection('user_groups', userGroups);

    return jsonResponse(newGroup);
}

async function handleGetGroups(request) {
    const auth = await authenticate(request);
    if (!auth || auth.role !== 'superadmin') return errorResponse('需要超级管理员权限', 403);

    const groups = await getCollection('groups');
    const userGroups = await getCollection('user_groups');
    const users = await readUsers();

    const result = groups.map(group => {
        const members = userGroups.filter(ug => ug.group_id === group.id);
        const creator = users.find(u => u.id === group.created_by);
        return { ...group, member_count: members.length, creator_name: creator ? creator.name : '未知' };
    });
    return jsonResponse(result);
}

async function handleUpdateGroup(request, params) {
    const auth = await authenticate(request);
    if (!auth || auth.role !== 'superadmin') return errorResponse('需要超级管理员权限', 403);

    const { name, description } = await request.json().catch(() => ({}));
    if (!name) return errorResponse('请填写小组名称');

    const groups = await getCollection('groups');
    const idx = groups.findIndex(g => g.id === parseInt(params.id));
    if (idx === -1) return errorResponse('小组不存在', 404);
    if (groups.some(g => g.name === name && g.id !== parseInt(params.id))) return errorResponse('小组名称已存在', 409);

    groups[idx].name = name;
    groups[idx].description = description || '';
    await setCollection('groups', groups);
    return jsonResponse(groups[idx]);
}

async function handleDeleteGroup(request, params) {
    const auth = await authenticate(request);
    if (!auth || auth.role !== 'superadmin') return errorResponse('需要超级管理员权限', 403);

    const groupId = parseInt(params.id);
    let groups = await getCollection('groups');
    if (!groups.some(g => g.id === groupId)) return errorResponse('小组不存在', 404);
    groups = groups.filter(g => g.id !== groupId);
    await setCollection('groups', groups);

    let userGroups = await getCollection('user_groups');
    userGroups = userGroups.filter(ug => ug.group_id !== groupId);
    await setCollection('user_groups', userGroups);

    let tasks = await getCollection('tasks');
    tasks.forEach(t => { if (t.group_id == groupId) t.group_id = null; });
    await setCollection('tasks', tasks);

    return jsonResponse({ success: true });
}

async function handleGroupsAdmin(request) {
    const auth = await authenticate(request);
    if (!auth || !['admin', 'superadmin'].includes(auth.role)) return errorResponse('需要管理员权限', 403);

    const groups = await getCollection('groups');
    const userGroups = await getCollection('user_groups');
    const result = groups.map(group => {
        const ug = userGroups.find(x => x.group_id === group.id);
        return { ...group, member_count: userGroups.filter(x => x.group_id === group.id).length, role: ug ? ug.role : null };
    });
    return jsonResponse(result);
}

async function handleCreateGroupRequest(request) {
    const auth = await authenticate(request);
    if (!auth || !['admin', 'superadmin'].includes(auth.role)) return errorResponse('需要管理员权限', 403);

    const { group_id } = await request.json().catch(() => ({}));
    if (!group_id) return errorResponse('请选择小组');

    const groups = await getCollection('groups');
    if (!groups.find(g => g.id == group_id)) return errorResponse('小组不存在', 404);

    const groupRequests = await getCollection('group_requests');
    if (groupRequests.some(r => r.user_id === auth.id && r.group_id == group_id)) return errorResponse('申请已提交');

    groupRequests.push({ id: Date.now(), user_id: auth.id, group_id: parseInt(group_id), status: 'pending', created_at: new Date().toISOString() });
    await setCollection('group_requests', groupRequests);
    return jsonResponse({ message: '申请已提交' });
}

async function handleMyGroupRequests(request) {
    const auth = await authenticate(request);
    if (!auth || !['admin', 'superadmin'].includes(auth.role)) return errorResponse('需要管理员权限', 403);
    const requests = await getCollection('group_requests');
    return jsonResponse(requests.filter(r => r.user_id === auth.id));
}

async function handleProcessGroupRequest(request, params) {
    const auth = await authenticate(request);
    if (!auth || auth.role !== 'superadmin') return errorResponse('需要超级管理员权限', 403);

    const { status } = await request.json().catch(() => ({}));
    if (status !== 'approved' && status !== 'rejected') return errorResponse('无效的状态');

    const groupRequests = await getCollection('group_requests');
    const idx = groupRequests.findIndex(r => r.id == params.id);
    if (idx === -1) return errorResponse('申请不存在', 404);

    const req = groupRequests[idx];
    req.status = status;

    if (status === 'approved') {
        const userGroups = await getCollection('user_groups');
        if (!userGroups.some(ug => ug.user_id === req.user_id && ug.group_id === req.group_id)) {
            userGroups.push({ user_id: req.user_id, group_id: req.group_id, role: 'member' });
            await setCollection('user_groups', userGroups);
        }
    }

    groupRequests[idx] = req;
    await setCollection('group_requests', groupRequests);
    return jsonResponse({ message: status === 'approved' ? '批准成功' : '拒绝成功' });
}

async function handleMyGroups(request) {
    const auth = await authenticate(request);
    if (!auth) return errorResponse('未登录', 401);

    const userGroups = await getCollection('user_groups');
    const groups = await getCollection('groups');
    const result = userGroups.filter(ug => ug.user_id === auth.id).map(ug => {
        const group = groups.find(g => g.id === ug.group_id);
        return { ...ug, ...group, role: ug.role };
    });
    return jsonResponse(result);
}

async function handleGroupMembers(request, params) {
    const auth = await authenticate(request);
    if (!auth) return errorResponse('未登录', 401);

    const groupId = parseInt(params.groupId);
    const userGroups = await getCollection('user_groups');
    const isGroupAdmin = userGroups.some(ug => ug.user_id === auth.id && ug.group_id === groupId && ug.role === 'admin');
    if (!isGroupAdmin && auth.role !== 'superadmin') return errorResponse('需要小组管理员权限', 403);

    const groups = await getCollection('groups');
    const group = groups.find(g => g.id === groupId);
    const groupMembers = userGroups.filter(ug => ug.group_id === groupId);
    const users = await readUsers();

    const members = groupMembers.map(ug => {
        const u = users.find(x => x.id === ug.user_id);
        if (!u) return null;
        const { password: _, ...rest } = u;
        return { ...rest, groupRole: ug.role };
    }).filter(Boolean);

    return jsonResponse({ group: group || null, members });
}

async function handleAddGroupMember(request, params) {
    const auth = await authenticate(request);
    if (!auth) return errorResponse('未登录', 401);

    const groupId = parseInt(params.groupId);
    const userGroups = await getCollection('user_groups');
    const isGroupAdmin = userGroups.some(ug => ug.user_id === auth.id && ug.group_id === groupId && ug.role === 'admin');
    if (!isGroupAdmin && auth.role !== 'superadmin') return errorResponse('需要小组管理员权限', 403);

    const { user_id } = await request.json().catch(() => ({}));
    if (!user_id) return errorResponse('请选择要添加的成员');

    const users = await readUsers();
    const targetUser = users.find(u => u.id == user_id);
    if (!targetUser) return errorResponse('用户不存在', 404);
    if (userGroups.some(ug => ug.user_id == user_id && ug.group_id === groupId)) return errorResponse('该用户已在小组中', 409);

    userGroups.push({ user_id: targetUser.id, group_id: groupId, role: 'member' });
    await setCollection('user_groups', userGroups);

    const { password: _, ...rest } = targetUser;
    return jsonResponse({ message: '添加成功', user: rest });
}

async function handleRemoveGroupMember(request, params) {
    const auth = await authenticate(request);
    if (!auth) return errorResponse('未登录', 401);

    const groupId = parseInt(params.groupId);
    const userId = parseInt(params.userId);
    if (userId === auth.id) return errorResponse('不能移除自己');

    const userGroups = await getCollection('user_groups');
    const isGroupAdmin = userGroups.some(ug => ug.user_id === auth.id && ug.group_id === groupId && ug.role === 'admin');
    if (!isGroupAdmin && auth.role !== 'superadmin') return errorResponse('需要小组管理员权限', 403);

    const filtered = userGroups.filter(ug => !(ug.user_id === userId && ug.group_id === groupId));
    if (filtered.length === userGroups.length) return errorResponse('该成员不在小组中', 404);

    await setCollection('user_groups', filtered);
    return jsonResponse({ success: true });
}

function getQueryParams(request) {
    const raw = request.url || '';
    const qi = raw.indexOf('?');
    if (qi === -1) return {};
    return Object.fromEntries(new URLSearchParams(raw.slice(qi)));
}

async function handleGetTasks(request) {
    const auth = await authenticate(request);
    if (!auth) return errorResponse('未登录', 401);

    try {
        const { assignee_id, status, priority, group_id } = getQueryParams(request);

        let tasks = await getCollection('tasks');
        if (assignee_id) tasks = tasks.filter(t => t.assignee_id == assignee_id);
        if (status) tasks = tasks.filter(t => t.status === status);
        if (priority) tasks = tasks.filter(t => t.priority === priority);
        if (group_id) tasks = tasks.filter(t => t.group_id && t.group_id == group_id);

        const users = await readUsers();
        const result = tasks.map(task => {
            const assignee = users.find(u => u.id == task.assignee_id);
            return { ...task, assignee_name: assignee ? assignee.name : null };
        });
        result.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
        return jsonResponse(result);
    } catch (e) {
        return jsonResponse([]);
    }
}

async function handleGetTask(request, params) {
    const auth = await authenticate(request);
    if (!auth) return errorResponse('未登录', 401);

    const tasks = await getCollection('tasks');
    const task = tasks.find(t => t.id == params.id);
    if (!task) return errorResponse('任务不存在', 404);

    const users = await readUsers();
    const assignee = users.find(u => u.id == task.assignee_id);
    return jsonResponse({ ...task, assignee_name: assignee ? assignee.name : null });
}

async function handleCreateTask(request) {
    const auth = await authenticate(request);
    if (!auth) return errorResponse('未登录', 401);

    const { title, description, status, priority, tags, assignee_id, deadline, group_id } = await request.json().catch(() => ({}));
    if (!title) return errorResponse('请填写任务标题');

    if (group_id) {
        const userGroups = await getCollection('user_groups');
        if (!userGroups.some(ug => ug.user_id === auth.id && ug.group_id == group_id)) {
            return errorResponse('您没有权限在这个小组中创建任务', 403);
        }
    }

    const newTask = {
        id: Date.now(), title, description: description || '',
        status: status || 'todo', priority: priority || 'medium',
        tags: tags || [],
        assignee_id: assignee_id ? parseInt(assignee_id, 10) || null : null,
        deadline: deadline || null,
        group_id: group_id ? parseInt(group_id, 10) || null : null,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    };

    const tasks = await getCollection('tasks');
    tasks.push(newTask);
    await setCollection('tasks', tasks);
    return jsonResponse(newTask);
}

async function handleUpdateTask(request, params) {
    const auth = await authenticate(request);
    if (!auth) return errorResponse('未登录', 401);

    const body = await request.json().catch(() => ({}));
    const tasks = await getCollection('tasks');
    const idx = tasks.findIndex(t => t.id == params.id);
    if (idx === -1) return errorResponse('任务不存在', 404);

    const task = tasks[idx];
    const targetGroupId = body.group_id !== undefined ? body.group_id : task.group_id;
    if (targetGroupId) {
        const userGroups = await getCollection('user_groups');
        if (!userGroups.some(ug => ug.user_id === auth.id && ug.group_id == targetGroupId)) {
            return errorResponse('您没有权限在该小组中编辑任务', 403);
        }
    }

    ['title', 'description', 'status', 'priority', 'tags', 'assignee_id', 'deadline', 'group_id'].forEach(field => {
        if (body[field] !== undefined) {
            if (field === 'assignee_id' || field === 'group_id') {
                task[field] = body[field] ? parseInt(body[field], 10) || null : null;
            } else {
                task[field] = body[field];
            }
        }
    });
    task.updated_at = new Date().toISOString();

    tasks[idx] = task;
    await setCollection('tasks', tasks);
    return jsonResponse({ success: true });
}

async function handleDeleteTask(request, params) {
    const auth = await authenticate(request);
    if (!auth) return errorResponse('未登录', 401);

    let tasks = await getCollection('tasks');
    const len = tasks.length;
    tasks = tasks.filter(t => t.id != params.id);
    if (tasks.length === len) return errorResponse('任务不存在', 404);

    await setCollection('tasks', tasks);
    return jsonResponse({ success: true });
}

async function handleStats(request) {
    const auth = await authenticate(request);
    if (!auth) return errorResponse('未登录', 401);

    const users = await readUsers();
    const tasks = await getCollection('tasks');
    return jsonResponse({
        total_users: users.length,
        total_tasks: tasks.length,
        todo_count: tasks.filter(t => t.status === 'todo').length,
        in_progress_count: tasks.filter(t => t.status === 'in_progress').length,
        done_count: tasks.filter(t => t.status === 'done').length
    });
}

// ─── Router ─────────────────────────────────────────────────────────

const ROUTES = [
    // Auth
    { method: 'GET',    path: '/api/ping',                      handler: handlePing },
    { method: 'POST',   path: '/api/auth/register',             handler: handleRegister },
    { method: 'POST',   path: '/api/auth/login',                handler: handleLogin },
    { method: 'GET',    path: '/api/auth/me',                   handler: handleMe },
    // Invites
    { method: 'POST',   path: '/api/invites',                   handler: handleCreateInvite },
    { method: 'GET',    path: '/api/invites',                   handler: handleGetInvites },
    { method: 'DELETE', path: '/api/invites/:code',             handler: handleDeleteInvite, params: ['code'] },
    // Users
    { method: 'POST',   path: '/api/users',                     handler: handleCreateUser },
    { method: 'GET',    path: '/api/users',                     handler: handleGetUsers },
    { method: 'DELETE', path: '/api/users/:id',                 handler: handleDeleteUser, params: ['id'] },
    // Groups (specific before wildcard)
    { method: 'POST',   path: '/api/groups/requests',           handler: handleCreateGroupRequest },
    { method: 'GET',    path: '/api/groups/my-requests',        handler: handleMyGroupRequests },
    { method: 'PUT',    path: '/api/groups/requests/:id',       handler: handleProcessGroupRequest, params: ['id'] },
    { method: 'GET',    path: '/api/groups-admin',              handler: handleGroupsAdmin },
    { method: 'GET',    path: '/api/my-groups',                 handler: handleMyGroups },
    { method: 'POST',   path: '/api/groups',                    handler: handleCreateGroup },
    { method: 'GET',    path: '/api/groups',                    handler: handleGetGroups },
    { method: 'PUT',    path: '/api/groups/:id',                handler: handleUpdateGroup, params: ['id'] },
    { method: 'DELETE', path: '/api/groups/:id',                handler: handleDeleteGroup, params: ['id'] },
    // Group members
    { method: 'GET',    path: '/api/groups/:groupId/members',           handler: handleGroupMembers, params: ['groupId'] },
    { method: 'POST',   path: '/api/groups/:groupId/members',           handler: handleAddGroupMember, params: ['groupId'] },
    { method: 'DELETE', path: '/api/groups/:groupId/members/:userId',   handler: handleRemoveGroupMember, params: ['groupId', 'userId'] },
    // Tasks
    { method: 'GET',    path: '/api/tasks/:id',                 handler: handleGetTask, params: ['id'] },
    { method: 'PUT',    path: '/api/tasks/:id',                 handler: handleUpdateTask, params: ['id'] },
    { method: 'DELETE', path: '/api/tasks/:id',                 handler: handleDeleteTask, params: ['id'] },
    { method: 'GET',    path: '/api/tasks',                     handler: handleGetTasks },
    { method: 'POST',   path: '/api/tasks',                     handler: handleCreateTask },
    // Stats
    { method: 'GET',    path: '/api/stats',                     handler: handleStats },
];

// ─── Main Handler ───────────────────────────────────────────────────

export async function onRequest({ request }) {
    try {
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
                }
            });
        }

        const rawUrl = request.url || '';
        const pathname = rawUrl.indexOf('?') !== -1 ? rawUrl.slice(0, rawUrl.indexOf('?')) : rawUrl;
        const cleanPath = pathname.includes('://') ? '/' + pathname.split('/').slice(3).join('/') : pathname;

        for (const route of ROUTES) {
            if (route.method !== request.method) continue;

            if (!route.params) {
                if (route.path === cleanPath) {
                    return route.handler(request).catch(e => {
                        return errorResponse('服务器内部错误: ' + (e.message || e), 500);
                    });
                }
            } else {
                const pattern = route.path.replace(/:(\w+)/g, '(?<$1>[^/]+)');
                const match = cleanPath.match(new RegExp('^' + pattern + '$'));
                if (match) {
                    return route.handler(request, match.groups).catch(e => {
                        return errorResponse('服务器内部错误: ' + (e.message || e), 500);
                    });
                }
            }
        }

        return jsonResponse({ error: 'Not Found', path: cleanPath, method: request.method }, 404);
    } catch (e) {
        return jsonResponse({ error: 'Fatal: ' + (e.message || e), stack: e.stack }, 500);
    }
}
