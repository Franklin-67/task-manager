const API_BASE = '/api';

let currentUser = null;
let token = null;
let users = [];
let tasks = [];
let userGroups = [];
let allGroupsData = [];

document.addEventListener('DOMContentLoaded', () => {
    checkLoginStatus();
    initEventListeners();

    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });
});

function checkLoginStatus() {
    const savedToken = localStorage.getItem('authToken');
    const savedUser = localStorage.getItem('currentUser');

    if (savedToken && savedUser) {
        token = savedToken;
        currentUser = JSON.parse(savedUser);
        showApp();
    } else {
        showLogin();
    }
}

function initEventListeners() {
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await login();
    });

    document.getElementById('registerForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await register();
    });

    document.getElementById('userForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await addUser();
    });

    document.getElementById('taskForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveTask();
    });

    document.getElementById('inviteForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await generateInvite();
    });

    document.getElementById('groupForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await createGroup();
    });
}

// 显示/隐藏登录/注册
function showLogin() {
    document.getElementById('loginPage').style.display = 'flex';
    document.getElementById('appPage').style.display = 'none';
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('registerForm').style.display = 'none';
}

function showRegister() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'block';
}

// 显示应用
async function showApp() {
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('appPage').style.display = 'block';

    document.getElementById('currentUserEmail').textContent = currentUser.email;

    if (currentUser.role === 'superadmin') {
        document.getElementById('allGroupsBtn').style.display = '';
    }

    await loadMyGroups();
    loadUsers();
    loadTasks();
    loadStats();
    loadInviteManager();
}

// 登录
async function login() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value.trim();

    if (!email || !password) {
        alert('请填写完整信息');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            alert(data.error || '登录失败');
            return;
        }

        token = data.token;
        currentUser = data.user;

        localStorage.setItem('authToken', token);
        localStorage.setItem('currentUser', JSON.stringify(currentUser));

        showApp();
    } catch (error) {
        console.error('登录失败:', error);
        alert('登录失败，请稍后重试');
    }
}

// 注册
async function register() {
    const inviteCode = document.getElementById('registerInviteCode').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value.trim();

    if (!inviteCode || !email || !password) {
        alert('请填写完整信息');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, invite_code: inviteCode })
        });

        const data = await response.json();

        if (!response.ok) {
            alert(data.error || '注册失败');
            return;
        }

        alert('注册成功，请登录');
        showLogin();
        document.getElementById('registerForm').reset();
    } catch (error) {
        console.error('注册失败:', error);
        alert('注册失败，请稍后重试');
    }
}

// 登出
function logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    token = null;
    currentUser = null;
    location.reload();
}

// 加载用户列表
async function loadUsers() {
    try {
        const response = await fetch(`${API_BASE}/users`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.status === 401) {
            alert('登录已过期，请重新登录');
            logout();
            return;
        }

        users = await response.json();

        const userList = document.getElementById('userList');
        if (users.length === 0) {
            userList.innerHTML = '<p class="text-muted">暂无成员</p>';
            return;
        }

        const grouped = {};
        const ungrouped = [];

        users.forEach(user => {
            if (user.groups && user.groups.length > 0) {
                user.groups.forEach(g => {
                    if (!grouped[g.id]) {
                        grouped[g.id] = { name: g.name, members: [] };
                    }
                    grouped[g.id].members.push(user);
                });
            } else {
                ungrouped.push(user);
            }
        });

        let html = '';

        Object.values(grouped).forEach(group => {
            html += `<div class="group-section-title">📁 ${escapeHtml(group.name)}</div>`;
            group.members.forEach(user => {
                html += renderUserItem(user);
            });
        });

        if (ungrouped.length > 0) {
            html += '<div class="group-section-title">👤 未分组</div>';
            ungrouped.forEach(user => {
                html += renderUserItem(user);
            });
        }

        userList.innerHTML = html;

        renderAssigneeFilter();
        renderGroupSelect();
    } catch (error) {
        console.error('加载用户失败:', error);
        document.getElementById('userList').innerHTML = '<p class="text-muted">加载失败</p>';
    }
}

function renderUserItem(user) {
    return `
        <div class="user-item">
            <div class="user-item-avatar">${getInitials(user.name)}</div>
            <div class="user-item-info">
                <div class="user-item-name">${escapeHtml(user.name)}</div>
                <div class="user-item-email">${escapeHtml(user.email)}</div>
                <div class="user-item-role">${user.role === 'admin' ? '管理员' : user.role === 'superadmin' ? '超级管理员' : '成员'}</div>
            </div>
            ${currentUser && currentUser.role === 'superadmin' && user.id !== currentUser.id ? `<button class="btn btn-sm btn-secondary" onclick="deleteUser(${user.id})">删除</button>` : ''}
        </div>
    `;
}

// 渲染成员筛选器
function renderAssigneeFilter() {
    const select = document.getElementById('filterAssignee');
    const taskAssignee = document.getElementById('taskAssignee');

    select.innerHTML = '<option value="">所有成员</option>' +
        users.map(user => `<option value="${user.id}">${escapeHtml(user.name)}</option>`).join('');

    taskAssignee.innerHTML = '<option value="">未分配</option>' +
        users.map(user => `<option value="${user.id}">${escapeHtml(user.name)}</option>`).join('');
}

// 渲染小组选择器
function renderGroupSelect() {
    const groupSelect = document.getElementById('taskGroup');
    const filterGroup = document.getElementById('filterGroup');

    const groupOptions = userGroups.map(group => ({
        id: group.id,
        name: group.name,
        role: group.role
    }));

    const options = '<option value="">未分组</option>' +
        groupOptions.map(g => `<option value="${g.id}">${escapeHtml(g.name)}${g.role === 'admin' ? ' (管理员)' : ''}</option>`).join('');

    if (groupSelect) {
        groupSelect.innerHTML = options;
    }

    if (filterGroup) {
        filterGroup.innerHTML = '<option value="">所有小组</option>' +
            groupOptions.map(g => `<option value="${g.id}">${escapeHtml(g.name)}</option>`).join('');
    }
}

// 加载任务列表
async function loadTasks() {
    await renderTasks();
}

// 渲染任务列表
async function renderTasks() {
    const filterStatus = document.getElementById('filterStatus').value;
    const filterPriority = document.getElementById('filterPriority').value;
    const filterAssignee = document.getElementById('filterAssignee').value;
    const filterGroup = document.getElementById('filterGroup').value;

    try {
        const params = new URLSearchParams();
        if (filterStatus) params.append('status', filterStatus);
        if (filterPriority) params.append('priority', filterPriority);
        if (filterAssignee) params.append('assignee_id', filterAssignee);
        if (filterGroup) params.append('group_id', filterGroup);

        const url = `${API_BASE}/tasks?${params.toString()}`;
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.status === 401) {
            alert('登录已过期，请重新登录');
            logout();
            return;
        }

        tasks = await response.json();

        const container = document.getElementById('tasksContainer');
        if (tasks.length === 0) {
            container.innerHTML = '<p class="text-muted">暂无任务</p>';
            return;
        }

        container.innerHTML = tasks.map(task => {
            const groupInfo = task.group_id ? userGroups.find(g => g.id === task.group_id) : null;

            return `
            <div class="task-card status-${task.status} priority-${task.priority}" data-id="${task.id}">
                <div class="task-header">
                    <h3 class="task-title">${escapeHtml(task.title)}</h3>
                    <span class="task-priority priority-${task.priority}">${task.priority}</span>
                </div>
                ${task.description ? `<p class="task-description">${escapeHtml(task.description)}</p>` : ''}
                <div class="task-meta">
                    ${task.tags ? task.tags.map(tag => `<span class="task-tag">#${escapeHtml(tag)}</span>`).join('') : ''}
                </div>
                ${groupInfo ? `<div class="task-group"><span class="task-group-tag">📁 ${escapeHtml(groupInfo.name)}</span></div>` : ''}
                <div class="task-deadline ${isOverdue(task.deadline) ? 'overdue' : ''}">
                    ${task.deadline ? `
                        <span class="deadline-icon">📅</span>
                        <span>${formatDate(task.deadline)}</span>
                    ` : '<span>无截止日期</span>'}
                </div>
                ${task.assignee_id ? `
                    <div class="task-assignee">
                        <div class="task-assignee-avatar">${getInitials(task.assignee_name || '未知')}</div>
                        <span class="task-assignee-name">${escapeHtml(task.assignee_name || '未知')}</span>
                    </div>
                ` : ''}
                <div class="task-actions">
                    <button class="btn btn-sm btn-secondary" onclick="editTask(${task.id})">编辑</button>
                    <button class="btn btn-sm btn-secondary" onclick="deleteTask(${task.id})">删除</button>
                </div>
            </div>
        `}).join('');

    } catch (error) {
        console.error('加载任务失败:', error);
        document.getElementById('tasksContainer').innerHTML = '<p class="text-muted">加载失败</p>';
    }
}

// 加载统计数据
async function loadStats() {
    try {
        const response = await fetch(`${API_BASE}/stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.status === 401) {
            alert('登录已过期，请重新登录');
            logout();
            return;
        }

        const stats = await response.json();

        document.getElementById('stats').innerHTML = `
            <div class="stats-item">
                <span class="stats-label">总成员</span>
                <span class="stats-value">${stats.total_users}</span>
            </div>
            <div class="stats-item">
                <span class="stats-label">总任务</span>
                <span class="stats-value">${stats.total_tasks}</span>
            </div>
            <div class="stats-item">
                <span class="stats-label">待办</span>
                <span class="stats-value" style="color: #6c757d;">${stats.todo_count}</span>
            </div>
            <div class="stats-item">
                <span class="stats-label">进行中</span>
                <span class="stats-value" style="color: #ffc107;">${stats.in_progress_count}</span>
            </div>
            <div class="stats-item">
                <span class="stats-label">已完成</span>
                <span class="stats-value" style="color: #28a745;">${stats.done_count}</span>
            </div>
        `;

        document.getElementById('userRole').innerHTML = `
            <div class="user-role-item">
                <strong>当前角色：</strong>
                <span class="user-role-badge ${currentUser.role}">
                    ${currentUser.role === 'superadmin' ? '超级管理员' : currentUser.role === 'admin' ? '管理员' : '成员'}
                </span>
            </div>
        `;
    } catch (error) {
        console.error('加载统计失败:', error);
    }
}

// 加载我的小组
async function loadMyGroups() {
    try {
        const response = await fetch(`${API_BASE}/my-groups`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.status === 401) {
            alert('登录已过期，请重新登录');
            logout();
            return;
        }

        userGroups = await response.json();
    } catch (error) {
        console.error('加载小组失败:', error);
    }
}

// 邀请码管理
async function loadInviteManager() {
    try {
        const response = await fetch(`${API_BASE}/invites`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.status === 401) {
            alert('登录已过期，请重新登录');
            logout();
            return;
        }

        const invites = await response.json();

        const container = document.getElementById('inviteList');
        if (invites.length === 0) {
            container.innerHTML = '<p class="text-muted">暂无邀请码</p>';
            return;
        }

        container.innerHTML = invites.map(invite => `
            <div class="invite-item">
                <div class="invite-code">${escapeHtml(invite.code)}</div>
                <div class="invite-info">
                    <span class="invite-role">${invite.role === 'admin' ? '管理员' : '普通成员'}</span>
                    <span class="invite-uses">已使用: ${invite.uses}/${invite.max_uses || '∞'}</span>
                    ${invite.expires_at ? `<span class="invite-expire">过期: ${formatDate(invite.expires_at)}</span>` : ''}
                </div>
                <button class="btn btn-sm btn-secondary" onclick="deleteInvite('${invite.code}')">删除</button>
            </div>
        `).join('');
    } catch (error) {
        console.error('加载邀请码失败:', error);
    }
}

// 生成邀请码
async function generateInvite() {
    const role = document.getElementById('inviteRole').value;
    const maxUses = parseInt(document.getElementById('inviteMaxUses').value);
    const expiresDays = parseInt(document.getElementById('inviteExpires').value);

    try {
        const response = await fetch(`${API_BASE}/invites`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ role, max_uses: maxUses, expires_in_days: expiresDays })
        });

        const data = await response.json();

        if (!response.ok) {
            alert(data.error || '生成失败');
            return;
        }

        alert('邀请码生成成功！');
        closeModal('inviteManagerModal');
        document.getElementById('inviteForm').reset();
        loadInviteManager();
    } catch (error) {
        console.error('生成邀请码失败:', error);
        alert('生成失败');
    }
}

// 删除邀请码
async function deleteInvite(code) {
    if (!confirm('确定要删除这个邀请码吗？')) return;

    try {
        const response = await fetch(`${API_BASE}/invites/${code}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.status === 401) {
            alert('登录已过期，请重新登录');
            logout();
            return;
        }

        if (!response.ok) {
            alert('删除失败');
            return;
        }

        alert('删除成功');
        loadInviteManager();
    } catch (error) {
        console.error('删除邀请码失败:', error);
        alert('删除失败');
    }
}

// 显示/隐藏邀请码管理
function showInviteManager() {
    document.getElementById('inviteManagerModal').classList.add('active');
    loadInviteManager();
}

// 显示/隐藏我的小组
function showMyGroups() {
    document.getElementById('myGroupsModal').classList.add('active');
    renderMyGroupsList();
}

// 渲染我的小组列表
function renderMyGroupsList() {
    const container = document.getElementById('myGroupsList');
    if (userGroups.length === 0) {
        container.innerHTML = '<p class="text-muted">您还没有加入任何小组</p>';
        return;
    }

    container.innerHTML = userGroups.map(group => `
        <div class="group-item">
            <div class="group-item-avatar">${getInitials(group.name)}</div>
            <div class="group-item-info">
                <div class="group-item-name">${escapeHtml(group.name)}</div>
                <div class="group-item-desc">${escapeHtml(group.description || '无描述')}</div>
                <div class="group-item-role">${group.role === 'admin' ? '管理员' : '成员'}</div>
            </div>
            ${group.role === 'admin' ? `<button class="btn btn-sm btn-primary" onclick="openGroupMemberManager(${group.id})">管理成员</button>` : ''}
        </div>
    `).join('');
}

// 打开小组成员管理
async function openGroupMemberManager(groupId) {
    const group = userGroups.find(g => g.id === groupId);
    if (!group) return;

    document.getElementById('memberManagerGroupName').textContent = group.name;
    document.getElementById('memberManagerGroupId').value = groupId;
    document.getElementById('groupMemberManagerModal').classList.add('active');

    await loadGroupMembers(groupId);
}

// 加载小组成员
async function loadGroupMembers(groupId) {
    const container = document.getElementById('groupMemberList');
    container.innerHTML = '<p class="text-muted">加载中...</p>';

    try {
        const response = await fetch(`${API_BASE}/groups/${groupId}/members`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            container.innerHTML = '<p class="text-muted">加载失败</p>';
            return;
        }

        const { members } = await response.json();

        if (members.length === 0) {
            container.innerHTML = '<p class="text-muted">暂无成员</p>';
            return;
        }

        container.innerHTML = members.map(member => `
            <div class="user-item">
                <div class="user-item-avatar">${getInitials(member.name)}</div>
                <div class="user-item-info">
                    <div class="user-item-name">${escapeHtml(member.name)} <span class="badge">${member.groupRole === 'admin' ? '管理员' : '成员'}</span></div>
                    <div class="user-item-email">${escapeHtml(member.email)}</div>
                </div>
                ${member.id !== currentUser.id ? `<button class="btn btn-sm btn-secondary" onclick="removeGroupMember(${groupId}, ${member.id})">移除</button>` : ''}
            </div>
        `).join('');

        await loadAddableUsers(groupId);
    } catch (error) {
        console.error('加载小组成员失败:', error);
        container.innerHTML = '<p class="text-muted">加载失败</p>';
    }
}

// 加载可添加的用户列表
async function loadAddableUsers(groupId) {
    const select = document.getElementById('addMemberSelect');
    select.innerHTML = '<option value="">选择用户...</option>';

    try {
        const [memberRes, allUsersRes] = await Promise.all([
            fetch(`${API_BASE}/groups/${groupId}/members`, { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch(`${API_BASE}/users`, { headers: { 'Authorization': `Bearer ${token}` } })
        ]);

        const { members } = await memberRes.json();
        const allUsers = await allUsersRes.json();
        const memberIds = new Set(members.map(m => m.id));

        const addable = allUsers.filter(u => !memberIds.has(u.id));
        select.innerHTML = '<option value="">选择用户...</option>' +
            addable.map(u => `<option value="${u.id}">${escapeHtml(u.name)} (${escapeHtml(u.email)})</option>`).join('');
    } catch (error) {
        console.error('加载可添加用户失败:', error);
    }
}

// 添加小组成员
async function addGroupMember() {
    const groupId = document.getElementById('memberManagerGroupId').value;
    const userId = document.getElementById('addMemberSelect').value;

    if (!userId) {
        alert('请选择要添加的用户');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/groups/${groupId}/members`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ user_id: parseInt(userId) })
        });

        const data = await response.json();

        if (!response.ok) {
            alert(data.error || '添加失败');
            return;
        }

        alert('添加成功');
        document.getElementById('addMemberSelect').value = '';
        await loadGroupMembers(groupId);
        await loadMyGroups();
        loadUsers();
        renderTasks();
    } catch (error) {
        console.error('添加成员失败:', error);
        alert('添加失败');
    }
}

// 移除小组成员
async function removeGroupMember(groupId, userId) {
    if (!confirm('确定要移除该成员吗？')) return;

    try {
        const response = await fetch(`${API_BASE}/groups/${groupId}/members/${userId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();

        if (!response.ok) {
            alert(data.error || '移除失败');
            return;
        }

        alert('移除成功');
        await loadGroupMembers(groupId);
        await loadMyGroups();
        loadUsers();
        renderTasks();
    } catch (error) {
        console.error('移除成员失败:', error);
        alert('移除失败');
    }
}

// 所有小组管理（超级管理员）
function showAllGroupsManager() {
    document.getElementById('allGroupsModal').classList.add('active');
    loadAllGroups();
}

async function loadAllGroups() {
    const container = document.getElementById('allGroupsList');
    container.innerHTML = '<p class="text-muted">加载中...</p>';

    try {
        const response = await fetch(`${API_BASE}/groups`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            container.innerHTML = '<p class="text-muted">加载失败</p>';
            return;
        }

        allGroupsData = await response.json();

        if (allGroupsData.length === 0) {
            container.innerHTML = '<p class="text-muted">暂无小组</p>';
            return;
        }

        container.innerHTML = allGroupsData.map(group => `
            <div class="group-item">
                <div class="group-item-avatar">${getInitials(group.name)}</div>
                <div class="group-item-info">
                    <div class="group-item-name">${escapeHtml(group.name)}</div>
                    <div class="group-item-desc">${escapeHtml(group.description || '无描述')} · ${group.member_count || 0} 名成员 · 创建者: ${escapeHtml(group.creator_name || '未知')}</div>
                </div>
                <button class="btn btn-sm btn-secondary" onclick="openEditGroupModal(${group.id})">编辑</button>
                <button class="btn btn-sm btn-secondary" onclick="deleteGroup(${group.id})" style="margin-left:5px;">删除</button>
            </div>
        `).join('');
    } catch (error) {
        console.error('加载所有小组失败:', error);
        container.innerHTML = '<p class="text-muted">加载失败</p>';
    }
}

function openEditGroupModal(id) {
    const group = allGroupsData.find(g => g.id === id);
    if (!group) return;

    document.getElementById('editGroupId').value = id;
    document.getElementById('editGroupName').value = group.name;
    document.getElementById('editGroupDescription').value = group.description || '';
    document.getElementById('editGroupModal').classList.add('active');
}

async function saveGroupEdit() {
    const id = document.getElementById('editGroupId').value;
    const name = document.getElementById('editGroupName').value.trim();
    const description = document.getElementById('editGroupDescription').value.trim();

    if (!name) {
        alert('请填写小组名称');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/groups/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name, description })
        });

        const data = await response.json();

        if (!response.ok) {
            alert(data.error || '保存失败');
            return;
        }

        alert('保存成功');
        closeModal('editGroupModal');
        loadAllGroups();
        loadMyGroups();
        loadUsers();
        renderTasks();
    } catch (error) {
        console.error('编辑小组失败:', error);
        alert('编辑失败');
    }
}

async function deleteGroup(id) {
    if (!confirm('确定要删除该小组吗？小组中的任务将变为未分组。')) return;

    try {
        const response = await fetch(`${API_BASE}/groups/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();

        if (!response.ok) {
            alert(data.error || '删除失败');
            return;
        }

        alert('删除成功');
        loadAllGroups();
        loadMyGroups();
        loadUsers();
        renderTasks();
    } catch (error) {
        console.error('删除小组失败:', error);
        alert('删除失败');
    }
}

// 打开创建小组模态框
function openCreateGroupModal() {
    document.getElementById('createGroupModal').classList.add('active');
}

// 创建小组
async function createGroup() {
    const name = document.getElementById('groupName').value.trim();
    const description = document.getElementById('groupDescription').value.trim();

    if (!name) {
        alert('请填写小组名称');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/groups`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name, description })
        });

        if (response.status === 401) {
            alert('登录已过期，请重新登录');
            logout();
            return;
        }

        if (!response.ok) {
            const error = await response.json();
            alert(error.error || '创建失败');
            return;
        }

        alert('小组创建成功！');
        closeModal('createGroupModal');
        document.getElementById('groupForm').reset();
        loadMyGroups();
        renderMyGroupsList();
    } catch (error) {
        console.error('创建小组失败:', error);
        alert('创建失败');
    }
}

// 关闭模态框
function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// 添加用户
async function addUser() {
    const name = document.getElementById('userName').value.trim();
    const email = document.getElementById('userEmail').value.trim();
    const password = document.getElementById('userPassword').value.trim();
    const role = document.getElementById('userRole').value;

    if (!name || !email || !password) {
        alert('请填写完整信息');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/users`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name, email, password, role })
        });

        if (response.status === 401) {
            alert('登录已过期，请重新登录');
            logout();
            return;
        }

        if (!response.ok) {
            const error = await response.json();
            alert(error.error || '添加失败');
            return;
        }

        alert('添加成功');
        closeModal('userModal');
        document.getElementById('userForm').reset();
        loadUsers();
        renderTasks();
    } catch (error) {
        console.error('添加用户失败:', error);
        alert('添加失败');
    }
}

// 删除用户
async function deleteUser(id) {
    if (!confirm('确定要删除这个成员吗？')) return;

    try {
        const response = await fetch(`${API_BASE}/users/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.status === 401) {
            alert('登录已过期，请重新登录');
            logout();
            return;
        }

        const data = await response.json();

        if (!response.ok) {
            alert(data.error || '删除失败');
            return;
        }

        alert('删除成功');
        loadUsers();
        renderTasks();
    } catch (error) {
        console.error('删除用户失败:', error);
        alert('删除失败');
    }
}

// 打开添加成员模态框
function openAddUserModal() {
    document.getElementById('userForm').reset();
    document.getElementById('userModal').classList.add('active');
}

// 打开添加任务模态框
function openAddTaskModal() {
    document.getElementById('taskForm').reset();
    document.getElementById('taskId').value = '';
    document.getElementById('taskModalTitle').textContent = '新建任务';
    document.getElementById('taskModal').classList.add('active');
}

// 编辑任务
async function editTask(id) {
    try {
        const response = await fetch(`${API_BASE}/tasks/${id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.status === 401) {
            alert('登录已过期，请重新登录');
            logout();
            return;
        }

        const task = await response.json();

        document.getElementById('taskId').value = task.id;
        document.getElementById('taskTitle').value = task.title;
        document.getElementById('taskDescription').value = task.description || '';
        document.getElementById('taskStatus').value = task.status;
        document.getElementById('taskPriority').value = task.priority;
        document.getElementById('taskDeadline').value = task.deadline || '';
        document.getElementById('taskAssignee').value = task.assignee_id || '';
        document.getElementById('taskGroup').value = task.group_id || '';
        document.getElementById('taskTags').value = task.tags ? task.tags.join(', ') : '';

        document.getElementById('taskModalTitle').textContent = '编辑任务';
        document.getElementById('taskModal').classList.add('active');
    } catch (error) {
        console.error('加载任务失败:', error);
        alert('加载任务失败');
    }
}

// 保存任务
async function saveTask() {
    const id = document.getElementById('taskId').value;
    const title = document.getElementById('taskTitle').value.trim();
    const description = document.getElementById('taskDescription').value.trim();
    const status = document.getElementById('taskStatus').value;
    const priority = document.getElementById('taskPriority').value;
    const deadline = document.getElementById('taskDeadline').value;
    const assignee_id = document.getElementById('taskAssignee').value;
    const tagsInput = document.getElementById('taskTags').value;
    const group_id = document.getElementById('taskGroup').value;

    const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(t => t) : [];

    const data = { title, description, status, priority, assignee_id, deadline, tags, group_id };

    try {
        let url, options;

        if (id) {
            url = `${API_BASE}/tasks/${id}`;
            options = {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(data)
            };
        } else {
            url = `${API_BASE}/tasks`;
            options = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(data)
            };
        }

        const response = await fetch(url, options);

        if (response.status === 401) {
            alert('登录已过期，请重新登录');
            logout();
            return;
        }

        if (!response.ok) {
            const error = await response.json();
            alert(error.error || '保存失败');
            return;
        }

        alert(id ? '更新成功' : '添加成功');
        closeModal('taskModal');
        document.getElementById('taskForm').reset();
        renderTasks();
        loadStats();
    } catch (error) {
        console.error('保存任务失败:', error);
        alert('保存失败');
    }
}

// 删除任务
async function deleteTask(id) {
    if (!confirm('确定要删除这个任务吗？')) return;

    try {
        const response = await fetch(`${API_BASE}/tasks/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.status === 401) {
            alert('登录已过期，请重新登录');
            logout();
            return;
        }

        if (!response.ok) {
            alert('删除失败');
            return;
        }

        alert('删除成功');
        renderTasks();
        loadStats();
    } catch (error) {
        console.error('删除任务失败:', error);
        alert('删除失败');
    }
}

// 获取首字母
function getInitials(name) {
    return name ? name.substring(0, 2).toUpperCase() : '??';
}

// 格式化日期
function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN');
}

// 检查是否逾期
function isOverdue(dateStr) {
    if (!dateStr) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const deadline = new Date(dateStr);
    return deadline < today;
}

// HTML 转义
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
