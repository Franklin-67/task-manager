// API 基础地址
const API_BASE = '/api';

// 当前用户信息
let currentUser = null;
let token = null;
let userGroups = [];

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    // 检查是否已登录
    const savedToken = localStorage.getItem('authToken');
    const savedUser = localStorage.getItem('currentUser');

    if (savedToken && savedUser) {
        token = savedToken;
        currentUser = JSON.parse(savedUser);
        showApp();
    } else {
        showLogin();
    }

    // 登录表单提交
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await login();
    });

    // 注册表单提交
    document.getElementById('registerForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await register();
    });

    // 添加/保存用户
    document.getElementById('userForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await addUser();
    });

    // 保存任务
    document.getElementById('taskForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveTask();
    });
});

// 显示登录页面
function showLogin() {
    document.getElementById('loginPage').style.display = 'flex';
    document.getElementById('appPage').style.display = 'none';
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('registerForm').style.display = 'none';
}

// 显示注册页面
function showRegister() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'block';
}

// 显示应用
function showApp() {
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('appPage').style.display = 'block';
    document.getElementById('currentUserEmail').textContent = currentUser.email;

    // 如果是管理员，显示添加成员按钮
    if (currentUser.role === 'admin') {
        document.getElementById('addUserBtn').style.display = 'inline-block';
    }

    loadUsers();
    loadTasks();
    loadStats();
    renderAssigneeFilter();
    loadMyGroups();
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

        // 保存到本地存储
        localStorage.setItem('authToken', token);
        localStorage.setItem('currentUser', JSON.stringify(currentUser));

        alert('登录成功');
        showApp();
    } catch (error) {
        console.error('登录失败:', error);
        alert('登录失败，请稍后重试');
    }
}

// 注册
async function register() {
    const name = document.getElementById('registerName').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value.trim();
    const role = document.getElementById('registerRole').value;

    if (!name || !email || !password) {
        alert('请填写完整信息');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password, role })
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
    userGroups = [];
    location.reload();
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

// 渲染小组选择器
function renderGroupSelector() {
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

// 加载小组列表（超级管理员）
async function loadGroups() {
    try {
        const response = await fetch(`${API_BASE}/groups`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.status === 401) {
            alert('登录已过期，请重新登录');
            logout();
            return;
        }

        const groups = await response.json();
        renderGroupsList(groups);
    } catch (error) {
        console.error('加载小组列表失败:', error);
    }
}

// 渲染小组列表
function renderGroupsList(groups) {
    const container = document.getElementById('groupsContainer');
    if (!container) return;

    if (groups.length === 0) {
        container.innerHTML = '<p class="text-muted">暂无小组</p>';
        return;
    }

    container.innerHTML = groups.map(group => `
        <div class="group-item">
            <div class="group-item-avatar">${getInitials(group.name)}</div>
            <div class="group-item-info">
                <div class="group-item-name">${escapeHtml(group.name)}</div>
                <div class="group-item-email">${escapeHtml(group.description || '无描述')}</div>
            </div>
            <button class="btn btn-sm btn-secondary" onclick="viewGroupMembers(${group.id})">成员</button>
        </div>
    `).join('');
}

// 加载小组成员列表
async function viewGroupMembers(groupId) {
    try {
        const response = await fetch(`${API_BASE}/my-groups`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const groups = await response.json();
        const group = groups.find(g => g.id === groupId);

        if (!group) {
            alert('小组不存在');
            return;
        }

        const memberList = document.getElementById('groupMembersList');
        const groupMembers = document.getElementById('groupMembersModal');

        memberList.innerHTML = group.members.map(member => `
            <div class="user-item">
                <div class="user-item-avatar">${getInitials(member.name)}</div>
                <div class="user-item-info">
                    <div class="user-item-name">${escapeHtml(member.name)}</div>
                    <div class="user-item-email">${escapeHtml(member.email)}</div>
                    <div class="user-item-role">${member.role === 'admin' ? '管理员' : '成员'}</div>
                </div>
            </div>
        `).join('');

        groupMembers.classList.add('active');
    } catch (error) {
        console.error('加载小组成员失败:', error);
        alert('加载失败');
    }
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

        const users = await response.json();

        const userList = document.getElementById('userList');
        if (users.length === 0) {
            userList.innerHTML = '<p class="text-muted">暂无成员</p>';
            return;
        }

        userList.innerHTML = users.map(user => `
            <div class="user-item">
                <div class="user-item-avatar">${getInitials(user.name)}</div>
                <div class="user-item-info">
                    <div class="user-item-name">${escapeHtml(user.name)}</div>
                    <div class="user-item-email">${escapeHtml(user.email)}</div>
                    <div class="user-item-role">${user.role === 'admin' ? '管理员' : '成员'}</div>
                </div>
                <button class="btn btn-sm btn-secondary" onclick="deleteUser(${user.id})">删除</button>
            </div>
        `).join('');

        renderAssigneeFilter(users);
    } catch (error) {
        console.error('加载用户失败:', error);
        document.getElementById('userList').innerHTML = '<p class="text-muted">加载失败</p>';
    }
}

// 渲染成员筛选器
function renderAssigneeFilter(users = []) {
    const select = document.getElementById('filterAssignee');
    const taskAssignee = document.getElementById('taskAssignee');

    select.innerHTML = '<option value="">所有成员</option>' +
        users.map(user => `<option value="${user.id}">${escapeHtml(user.name)}</option>`).join('');

    taskAssignee.innerHTML = '<option value="">未分配</option>' +
        users.map(user => `<option value="${user.id}">${escapeHtml(user.name)}</option>`).join('');
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

        const tasks = await response.json();

        const container = document.getElementById('tasksContainer');
        if (tasks.length === 0) {
            container.innerHTML = '<p class="text-muted">暂无任务</p>';
            return;
        }

        container.innerHTML = tasks.map(task => {
            // 显示分组信息
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
                ${task.assignee_name ? `
                    <div class="task-assignee">
                        <div class="task-assignee-avatar">${getInitials(task.assignee_name)}</div>
                        <span class="task-assignee-name">${escapeHtml(task.assignee_name)}</span>
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
    } catch (error) {
        console.error('加载统计失败:', error);
    }
}

// 打开添加用户模态框
function openAddUserModal() {
    document.getElementById('userForm').reset();
    document.getElementById('userModal').classList.add('active');
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
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ name, email, password, role })
        });

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
        document.getElementById('taskTags').value = task.tags ? task.tags.join(', ') : '';
        document.getElementById('taskGroup').value = task.group_id || '';

        document.getElementById('taskModalTitle').textContent = '编辑任务';
        document.getElementById('taskModal').classList.add('active');
    } catch (error) {
        console.error('加载任务失败:', error);
        alert('加载任务失败');
    }
}

// 关闭模态框
function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
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
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(data)
            };
        } else {
            url = `${API_BASE}/tasks`;
            options = {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(data)
            };
        }

        const response = await fetch(url, options);

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

// 删除用户
async function deleteUser(id) {
    if (!confirm('确定要删除这个成员吗？')) return;

    try {
        const response = await fetch(`${API_BASE}/users/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            alert('删除失败');
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

// 删除任务
async function deleteTask(id) {
    if (!confirm('确定要删除这个任务吗？')) return;

    try {
        const response = await fetch(`${API_BASE}/tasks/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

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
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
