const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const TASKS_FILE = path.join(DATA_DIR, 'tasks.json');
const INVITES_FILE = path.join(DATA_DIR, 'invites.json');
const GROUPS_FILE = path.join(DATA_DIR, 'groups.json');
const USER_GROUPS_FILE = path.join(DATA_DIR, 'user_groups.json');
const GROUP_REQUESTS_FILE = path.join(DATA_DIR, 'group_requests.json');

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 密码哈希盐值（实际项目中应该从环境变量读取）
const SALT_ROUNDS = 10;

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

// 读取邀请码数据
function readInvites() {
    if (!fs.existsSync(INVITES_FILE)) {
        return [];
    }
    try {
        const data = fs.readFileSync(INVITES_FILE, 'utf8');
        return JSON.parse(data) || [];
    } catch (error) {
        console.error('读取邀请码数据失败:', error.message);
        return [];
    }
}

// 写入邀请码数据
function writeInvites(invites) {
    const content = JSON.stringify(invites, null, 2);
    fs.writeFileSync(INVITES_FILE, content, 'utf8');
}

// 生成邀请码
function generateInviteCode(code = null, maxUses = null, expiresAt = null) {
    const codeValue = code || crypto.randomBytes(6).toString('hex');
    return {
        code: codeValue,
        max_uses: maxUses || null,
        uses: 0,
        created_at: new Date().toISOString(),
        expires_at: expiresAt || null
    };
}

// 读取小组数据
function readGroups() {
    if (!fs.existsSync(GROUPS_FILE)) {
        return [];
    }
    try {
        const data = fs.readFileSync(GROUPS_FILE, 'utf8');
        return JSON.parse(data) || [];
    } catch (error) {
        console.error('读取小组数据失败:', error.message);
        return [];
    }
}

// 写入小组数据
function writeGroups(groups) {
    const content = JSON.stringify(groups, null, 2);
    fs.writeFileSync(GROUPS_FILE, content, 'utf8');
}

// 读取用户-小组关联数据
function readUserGroups() {
    if (!fs.existsSync(USER_GROUPS_FILE)) {
        return [];
    }
    try {
        const data = fs.readFileSync(USER_GROUPS_FILE, 'utf8');
        return JSON.parse(data) || [];
    } catch (error) {
        console.error('读取用户-小组关联数据失败:', error.message);
        return [];
    }
}

// 写入用户-小组关联数据
function writeUserGroups(userGroups) {
    const content = JSON.stringify(userGroups, null, 2);
    fs.writeFileSync(USER_GROUPS_FILE, content, 'utf8');
}

// 读取小组申请数据
function readGroupRequests() {
    if (!fs.existsSync(GROUP_REQUESTS_FILE)) {
        return [];
    }
    try {
        const data = fs.readFileSync(GROUP_REQUESTS_FILE, 'utf8');
        return JSON.parse(data) || [];
    } catch (error) {
        console.error('读取小组申请数据失败:', error.message);
        return [];
    }
}

// 写入小组申请数据
function writeGroupRequests(requests) {
    const content = JSON.stringify(requests, null, 2);
    fs.writeFileSync(GROUP_REQUESTS_FILE, content, 'utf8');
}

// 哈希密码
function hashPassword(password) {
    return bcrypt.hash(password, SALT_ROUNDS);
}

// 验证密码
function verifyPassword(password, hashedPassword) {
    return bcrypt.compare(password, hashedPassword);
}

// 初始化数据
async function initializeData() {
    const users = readUsers();
    const tasks = readTasks();
    const invites = readInvites();
    const groups = readGroups();
    const userGroups = readUserGroups();
    const groupRequests = readGroupRequests();

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

    if (invites.length === 0) {
        writeInvites([]);
    }

    if (groups.length === 0) {
        writeGroups([]);
    }

    if (userGroups.length === 0) {
        writeUserGroups([]);
    }

    if (groupRequests.length === 0) {
        writeGroupRequests([]);
    }
}

module.exports = {
    readUsers,
    writeUsers,
    readTasks,
    writeTasks,
    readInvites,
    writeInvites,
    generateInviteCode,
    readGroups,
    writeGroups,
    readUserGroups,
    writeUserGroups,
    readGroupRequests,
    writeGroupRequests,
    hashPassword,
    verifyPassword,
    initializeData
};
