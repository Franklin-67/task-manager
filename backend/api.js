const express = require('express');
const router = express.Router();
const { readUsers, writeUsers, readTasks, writeTasks } = require('./data');

let users = [];
let tasks = [];

// 初始化数据
function initialize() {
    users = readUsers();
    tasks = readTasks();

    // 如果没有用户，添加默认管理员
    if (users.length === 0) {
        users.push({
            id: Date.now(),
            name: '管理员',
            email: 'admin@example.com',
            role: 'admin'
        });
        writeUsers(users);
    }
}

initialize();

// 获取所有用户
router.get('/users', (req, res) => {
    res.json(users.sort((a, b) => a.name.localeCompare(b.name)));
});

// 创建用户
router.post('/users', (req, res) => {
    const { name, email } = req.body;

    if (!name || !email) {
        return res.status(400).json({ error: 'Name and email are required' });
    }

    // 检查邮箱是否已存在
    if (users.some(u => u.email === email)) {
        return res.status(409).json({ error: 'Email already exists' });
    }

    const newUser = {
        id: Date.now(),
        name,
        email,
        role: 'member'
    };

    users.push(newUser);
    writeUsers(users);
    res.json(newUser);
});

// 删除用户
router.delete('/users/:id', (req, res) => {
    const initialLength = users.length;
    users = users.filter(u => u.id != req.params.id);

    if (users.length === initialLength) {
        return res.status(404).json({ error: 'User not found' });
    }

    writeUsers(users);
    res.json({ success: true });
});

// 获取所有任务
router.get('/tasks', (req, res) => {
    const { assignee_id, status, priority } = req.query;

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
router.get('/tasks/:id', (req, res) => {
    const task = tasks.find(t => t.id == req.params.id);
    if (!task) {
        return res.status(404).json({ error: 'Task not found' });
    }
    const assignee = users.find(u => u.id == task.assignee_id);
    res.json({
        ...task,
        assignee_name: assignee ? assignee.name : null
    });
});

// 创建任务
router.post('/tasks', (req, res) => {
    const { title, description, status, priority, tags, assignee_id, deadline } = req.body;

    if (!title) {
        return res.status(400).json({ error: 'Title is required' });
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
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };

    tasks.push(newTask);
    writeTasks(tasks);
    res.json(newTask);
});

// 更新任务
router.put('/tasks/:id', (req, res) => {
    const { title, description, status, priority, tags, assignee_id, deadline } = req.body;

    const taskIndex = tasks.findIndex(t => t.id == req.params.id);
    if (taskIndex === -1) {
        return res.status(404).json({ error: 'Task not found' });
    }

    const task = tasks[taskIndex];

    if (title !== undefined) task.title = title;
    if (description !== undefined) task.description = description;
    if (status) task.status = status;
    if (priority) task.priority = priority;
    if (tags) task.tags = tags;
    if (assignee_id !== undefined) task.assignee_id = assignee_id;
    if (deadline) task.deadline = deadline;

    task.updated_at = new Date().toISOString();

    tasks[taskIndex] = task;
    writeTasks(tasks);
    res.json({ success: true });
});

// 删除任务
router.delete('/tasks/:id', (req, res) => {
    const initialLength = tasks.length;
    tasks = tasks.filter(t => t.id != req.params.id);

    if (tasks.length === initialLength) {
        return res.status(404).json({ error: 'Task not found' });
    }

    writeTasks(tasks);
    res.json({ success: true });
});

// 统计数据
router.get('/stats', (req, res) => {
    res.json({
        total_users: users.length,
        total_tasks: tasks.length,
        todo_count: tasks.filter(t => t.status === 'todo').length,
        in_progress_count: tasks.filter(t => t.status === 'in_progress').length,
        done_count: tasks.filter(t => t.status === 'done').length
    });
});

module.exports = router;
