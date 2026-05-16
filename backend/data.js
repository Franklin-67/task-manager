const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const TASKS_FILE = path.join(DATA_DIR, 'tasks.json');

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 读取用户数据
function readUsers() {
    if (!fs.existsSync(USERS_FILE)) {
        return [];
    }
    try {
        const data = fs.readFileSync(USERS_FILE, 'utf8');
        return JSON.parse(data) || [];
    } catch (error) {
        console.error('读取用户数据失败:', error.message);
        return [];
    }
}

// 写入用户数据
function writeUsers(users) {
    const content = JSON.stringify(users, null, 2);
    fs.writeFileSync(USERS_FILE, content, 'utf8');
}

// 读取任务数据
function readTasks() {
    if (!fs.existsSync(TASKS_FILE)) {
        return [];
    }
    try {
        const data = fs.readFileSync(TASKS_FILE, 'utf8');
        return JSON.parse(data) || [];
    } catch (error) {
        console.error('读取任务数据失败:', error.message);
        return [];
    }
}

// 写入任务数据
function writeTasks(tasks) {
    const content = JSON.stringify(tasks, null, 2);
    fs.writeFileSync(TASKS_FILE, content, 'utf8');
}

// 初始化数据
function initializeData() {
    const users = readUsers();
    const tasks = readTasks();

    if (users.length === 0) {
        // 插入默认管理员
        writeUsers([
            { id: Date.now(), name: '管理员', email: 'admin@example.com', role: 'admin' }
        ]);
    }

    if (tasks.length === 0) {
        writeTasks([]);
    }
}

module.exports = {
    readUsers,
    writeUsers,
    readTasks,
    writeTasks,
    initializeData
};
