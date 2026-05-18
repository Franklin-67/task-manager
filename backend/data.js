const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { getStorageProvider } = require('./storage');

const SALT_ROUNDS = 10;

async function readUsers()       { return getStorageProvider().getCollection('users'); }
async function writeUsers(data)  { return getStorageProvider().setCollection('users', data); }
async function readTasks()       { return getStorageProvider().getCollection('tasks'); }
async function writeTasks(data)  { return getStorageProvider().setCollection('tasks', data); }
async function readInvites()     { return getStorageProvider().getCollection('invites'); }
async function writeInvites(data){ return getStorageProvider().setCollection('invites', data); }
async function readGroups()      { return getStorageProvider().getCollection('groups'); }
async function writeGroups(data) { return getStorageProvider().setCollection('groups', data); }
async function readUserGroups()  { return getStorageProvider().getCollection('user_groups'); }
async function writeUserGroups(data) { return getStorageProvider().setCollection('user_groups', data); }
async function readGroupRequests()   { return getStorageProvider().getCollection('group_requests'); }
async function writeGroupRequests(data) { return getStorageProvider().setCollection('group_requests', data); }

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

async function hashPassword(password) {
    return bcrypt.hash(password, SALT_ROUNDS);
}

async function verifyPassword(password, hashedPassword) {
    return bcrypt.compare(password, hashedPassword);
}

async function initializeData() {
    return getStorageProvider().initialize();
}

module.exports = {
    readUsers, writeUsers,
    readTasks, writeTasks,
    readInvites, writeInvites,
    generateInviteCode,
    readGroups, writeGroups,
    readUserGroups, writeUserGroups,
    readGroupRequests, writeGroupRequests,
    hashPassword, verifyPassword,
    initializeData
};
