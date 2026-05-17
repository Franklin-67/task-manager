const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const IS_SERVERLESS = process.env.VERCEL || process.env.EDGEONE_PAGES;
const DATA_DIR = IS_SERVERLESS
    ? path.join('/tmp', 'data')
    : path.join(__dirname, '..', 'data');
const SEED_DIR = path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const TASKS_FILE = path.join(DATA_DIR, 'tasks.json');
const INVITES_FILE = path.join(DATA_DIR, 'invites.json');
const GROUPS_FILE = path.join(DATA_DIR, 'groups.json');
const USER_GROUPS_FILE = path.join(DATA_DIR, 'user_groups.json');
const GROUP_REQUESTS_FILE = path.join(DATA_DIR, 'group_requests.json');

const SALT_ROUNDS = 10;

function ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (IS_SERVERLESS && !fs.existsSync(path.join(DATA_DIR, 'users.json'))) {
        const files = ['users.json', 'tasks.json', 'invites.json', 'groups.json', 'user_groups.json', 'group_requests.json'];
        files.forEach(file => {
            const seedPath = path.join(SEED_DIR, file);
            const destPath = path.join(DATA_DIR, file);
            if (fs.existsSync(seedPath) && !fs.existsSync(destPath)) {
                fs.copyFileSync(seedPath, destPath);
            }
        });
    }
}

function readUsers() {
    if (!fs.existsSync(USERS_FILE)) return [];
    try {
        const data = fs.readFileSync(USERS_FILE, 'utf8');
        return JSON.parse(data) || [];
    } catch (error) {
        return [];
    }
}

function writeUsers(users) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
}

function readTasks() {
    if (!fs.existsSync(TASKS_FILE)) return [];
    try {
        const data = fs.readFileSync(TASKS_FILE, 'utf8');
        return JSON.parse(data) || [];
    } catch (error) {
        return [];
    }
}

function writeTasks(tasks) {
    fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2), 'utf8');
}

function readInvites() {
    if (!fs.existsSync(INVITES_FILE)) return [];
    try {
        const data = fs.readFileSync(INVITES_FILE, 'utf8');
        return JSON.parse(data) || [];
    } catch (error) {
        return [];
    }
}

function writeInvites(invites) {
    fs.writeFileSync(INVITES_FILE, JSON.stringify(invites, null, 2), 'utf8');
}

function generateInviteCode(code = null, maxUses = null, expiresAt = null, role = 'member') {
    const codeValue = code || crypto.randomBytes(6).toString('hex');
    return {
        code: codeValue,
        max_uses: maxUses || null,
        uses: 0,
        role: role,
        created_at: new Date().toISOString(),
        expires_at: expiresAt || null
    };
}

function readGroups() {
    if (!fs.existsSync(GROUPS_FILE)) return [];
    try {
        const data = fs.readFileSync(GROUPS_FILE, 'utf8');
        return JSON.parse(data) || [];
    } catch (error) {
        return [];
    }
}

function writeGroups(groups) {
    fs.writeFileSync(GROUPS_FILE, JSON.stringify(groups, null, 2), 'utf8');
}

function readUserGroups() {
    if (!fs.existsSync(USER_GROUPS_FILE)) return [];
    try {
        const data = fs.readFileSync(USER_GROUPS_FILE, 'utf8');
        return JSON.parse(data) || [];
    } catch (error) {
        return [];
    }
}

function writeUserGroups(userGroups) {
    fs.writeFileSync(USER_GROUPS_FILE, JSON.stringify(userGroups, null, 2), 'utf8');
}

function readGroupRequests() {
    if (!fs.existsSync(GROUP_REQUESTS_FILE)) return [];
    try {
        const data = fs.readFileSync(GROUP_REQUESTS_FILE, 'utf8');
        return JSON.parse(data) || [];
    } catch (error) {
        return [];
    }
}

function writeGroupRequests(requests) {
    fs.writeFileSync(GROUP_REQUESTS_FILE, JSON.stringify(requests, null, 2), 'utf8');
}

async function hashPassword(password) {
    return bcrypt.hash(password, SALT_ROUNDS);
}

async function verifyPassword(password, hashedPassword) {
    return bcrypt.compare(password, hashedPassword);
}

async function initializeData() {
    ensureDataDir();

    const users = readUsers();
    const tasks = readTasks();
    const invites = readInvites();
    const groups = readGroups();
    const userGroups = readUserGroups();
    const groupRequests = readGroupRequests();

    if (users.length === 0) {
        const hashedPassword = await hashPassword('admin123');
        writeUsers([{
            id: Date.now(),
            name: '超级管理员',
            email: 'admin@example.com',
            password: hashedPassword,
            role: 'superadmin'
        }]);
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
