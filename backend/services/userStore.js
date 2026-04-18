const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

function readUsers() {
    if (!fs.existsSync(USERS_FILE)) {
        return [];
    }
    try {
        const raw = fs.readFileSync(USERS_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : parsed.users || [];
    } catch {
        return [];
    }
}

function writeUsers(users) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
}

function normalizeEmail(email) {
    return String(email || '')
        .trim()
        .toLowerCase();
}

function findUserByEmail(email) {
    const norm = normalizeEmail(email);
    return readUsers().find((u) => u.email === norm) || null;
}

function createUser(email, passwordPlain) {
    const norm = normalizeEmail(email);
    if (findUserByEmail(norm)) {
        return { ok: false, code: 'EMAIL_IN_USE' };
    }
    const passwordHash = bcrypt.hashSync(passwordPlain, 10);
    const user = {
        id: crypto.randomUUID(),
        email: norm,
        passwordHash,
        createdAt: new Date().toISOString(),
    };
    const users = readUsers();
    users.push(user);
    writeUsers(users);
    return { ok: true, user: { id: user.id, email: user.email } };
}

function verifyPassword(email, passwordPlain) {
    const user = findUserByEmail(email);
    if (!user) {
        return null;
    }
    const ok = bcrypt.compareSync(passwordPlain, user.passwordHash);
    if (!ok) {
        return null;
    }
    return { id: user.id, email: user.email };
}

module.exports = {
    normalizeEmail,
    findUserByEmail,
    createUser,
    verifyPassword,
};
