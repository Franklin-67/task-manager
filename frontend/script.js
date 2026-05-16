// API 基础地址
const API_BASE = '/api';

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    loadUsers();
    loadTasks();
    loadStats();
    renderAssigneeFilter();
});

// 加载用户列表
async function loadUsers() {
    try {
        const response = await fetch(`${API_BASE}/users`);
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

    try {
        const params = new URLSearchParams();
        if (filterStatus) params.append('status', filterStatus);
        if (filterPriority) params.append('priority', filterPriority);
        if (filterAssignee) params.append('assignee_id', filterAssignee);

        const url = `${API_BASE}/tasks?${params.toString()}`;
        const response = await fetch(url);
        const tasks = await response.json();

        const container = document.getElementById('tasksContainer');
        if (tasks.length === 0) {
            container.innerHTML = '<p class="text-muted">暂无任务</p>';
            return;
        }

        container.innerHTML = tasks.map(task => `
            <div class="task-card status-${task.status} priority-${task.priority}" data-id="${task.id}">
                <div class="task-header">
                    <h3 class="task-title">${escapeHtml(task.title)}</h3>
                    <span class="task-priority priority-${task.priority}">${task.priority}</span>
                </div>
                ${task.description ? `<p class="task-description">${escapeHtml(task.description)}</p>` : ''}
                <div class="task-meta">
                    ${task.tags ? task.tags.map(tag => `<span class="task-tag">#${escapeHtml(tag)}</span>`).join('') : ''}
                </div>
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
        `).join('');

    } catch (error) {
        console.error('加载任务失败:', error);
        document.getElementById('tasksContainer').innerHTML = '<p class="text-muted">加载失败</p>';
    }
}

// 打开添加用户模态框
function openAddUserModal() {
    document.getElementById('userForm').reset();
    document.getElementById('userModal').classList.add('active');
}

// 加载统计数据
async function loadStats() {
    try {
        const response = await fetch(`${API_BASE}/stats`);
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
        const response = await fetch(`${API_BASE}/tasks/${id}`);
        const task = await response.json();

        document.getElementById('taskId').value = task.id;
        document.getElementById('taskTitle').value = task.title;
        document.getElementById('taskDescription').value = task.description || '';
        document.getElementById('taskStatus').value = task.status;
        document.getElementById('taskPriority').value = task.priority;
        document.getElementById('taskDeadline').value = task.deadline || '';
        document.getElementById('taskAssignee').value = task.assignee_id || '';
        document.getElementById('taskTags').value = task.tags ? task.tags.join(', ') : '';

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

// 添加/保存用户
document.getElementById('userForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('userName').value.trim();
    const email = document.getElementById('userEmail').value.trim();

    if (!name || !email) {
        alert('请填写完整信息');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email })
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
        loadTasks();
    } catch (error) {
        console.error('添加用户失败:', error);
        alert('添加失败');
    }
});

// 保存任务
document.getElementById('taskForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const id = document.getElementById('taskId').value;
    const title = document.getElementById('taskTitle').value.trim();
    const description = document.getElementById('taskDescription').value.trim();
    const status = document.getElementById('taskStatus').value;
    const priority = document.getElementById('taskPriority').value;
    const deadline = document.getElementById('taskDeadline').value;
    const assignee_id = document.getElementById('taskAssignee').value;
    const tagsInput = document.getElementById('taskTags').value;

    const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(t => t) : [];

    const data = { title, description, status, priority, assignee_id, deadline, tags };

    try {
        let url, options;

        if (id) {
            url = `${API_BASE}/tasks/${id}`;
            options = {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            };
        } else {
            url = `${API_BASE}/tasks`;
            options = {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
});

// 删除用户
async function deleteUser(id) {
    if (!confirm('确定要删除这个成员吗？')) return;

    try {
        const response = await fetch(`${API_BASE}/users/${id}`, {
            method: 'DELETE'
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
            method: 'DELETE'
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
