const fs = require('fs');
const path = require('path');

const COLLECTIONS = ['users', 'tasks', 'invites', 'groups', 'user_groups', 'group_requests'];

// ─── File Storage Provider ───────────────────────────────────────────

class FileStorageProvider {
    constructor() {
        const isServerless = process.env.EDGEONE_PAGES;
        this.dataDir = isServerless
            ? path.join('/tmp', 'data')
            : path.join(__dirname, '..', 'data');
        this.seedDir = path.join(__dirname, '..', 'data');
    }

    _ensureDir() {
        try {
            if (!fs.existsSync(this.dataDir)) {
                fs.mkdirSync(this.dataDir, { recursive: true });
            }
        } catch {
            // /tmp may not be writable in some environments
        }
    }

    _filePath(name) {
        return path.join(this.dataDir, name + '.json');
    }

    async getCollection(name) {
        this._ensureDir();
        const fp = this._filePath(name);
        try {
            if (!fs.existsSync(fp)) return [];
            const data = fs.readFileSync(fp, 'utf8');
            return JSON.parse(data) || [];
        } catch {
            return [];
        }
    }

    async setCollection(name, data) {
        try {
            this._ensureDir();
            fs.writeFileSync(this._filePath(name), JSON.stringify(data, null, 2), 'utf8');
        } catch (err) {
            console.error('FileStorageProvider.setCollection error:', err.message);
        }
    }

    async initialize() {
        this._ensureDir();

        const users = await this.getCollection('users');

        if (users.length === 0) {
            const bcrypt = require('bcryptjs');
            const hashed = await bcrypt.hash('admin123', 10);
            await this.setCollection('users', [{
                id: Date.now(),
                name: '超级管理员',
                email: 'admin@example.com',
                password: hashed,
                role: 'superadmin'
            }]);
        }

        for (const name of COLLECTIONS) {
            await this.getCollection(name); // ensures empty file exists
        }
    }
}

// ─── KV Storage Provider ─────────────────────────────────────────────

class KVStorageProvider {
    constructor(kv) {
        this.kv = kv;
    }

    async getCollection(name) {
        try {
            const data = await this.kv.get(name, 'json');
            return Array.isArray(data) ? data : [];
        } catch {
            return [];
        }
    }

    async setCollection(name, data) {
        await this.kv.put(name, JSON.stringify(data));
    }

    async initialize() {
        let users = await this.getCollection('users');

        if (users.length === 0) {
            // Try seeding from bundled data files
            for (const name of COLLECTIONS) {
                const seedPath = path.join(__dirname, '..', 'data', name + '.json');
                try {
                    if (fs.existsSync(seedPath)) {
                        const seedData = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
                        if (Array.isArray(seedData) && seedData.length > 0) {
                            await this.setCollection(name, seedData);
                        }
                    }
                } catch {}
            }
            users = await this.getCollection('users');
        }

        if (users.length === 0) {
            const bcrypt = require('bcryptjs');
            const hashed = await bcrypt.hash('admin123', 10);
            users = [{
                id: Date.now(),
                name: '超级管理员',
                email: 'admin@example.com',
                password: hashed,
                role: 'superadmin'
            }];
            await this.setCollection('users', users);
        }

        for (const name of COLLECTIONS) {
            const existing = await this.getCollection(name);
            if (existing.length === 0 && existing.length === 0) {
                await this.setCollection(name, []);
            }
        }
    }
}

// ─── Factory ─────────────────────────────────────────────────────────

let provider = null;

function getStorageProvider() {
    if (provider) return provider;

    if (process.env.EDGEONE_PAGES) {
        const kv = globalThis.TASK_KV;
        if (kv && typeof kv.get === 'function') {
            provider = new KVStorageProvider(kv);
            return provider;
        }
    }

    provider = new FileStorageProvider();
    return provider;
}

module.exports = { getStorageProvider, FileStorageProvider, KVStorageProvider };
