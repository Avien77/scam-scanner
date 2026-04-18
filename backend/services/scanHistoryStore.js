const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const HISTORY_FILE = path.join(DATA_DIR, 'scan_history.json');

const MAX_TEXT_CHARS = 8000;
const MAX_SCANS_PER_USER = 100;
const PREVIEW_CHARS = 400;

function readAll() {
    if (!fs.existsSync(HISTORY_FILE)) {
        return [];
    }
    try {
        const parsed = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function writeAll(rows) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(rows, null, 2), 'utf8');
}

function previewFromText(text) {
    const t = String(text || '');
    if (t.length <= PREVIEW_CHARS) {
        return t;
    }
    return `${t.slice(0, PREVIEW_CHARS)}…`;
}

/**
 * @param {string} userId
 * @param {{ text: string, label: string, score: number, threshold: number }} payload
 * @returns {string} new scan id
 */
function appendScan(userId, { text, label, score, threshold }) {
    const rows = readAll();
    const rec = {
        id: crypto.randomUUID(),
        userId,
        text: String(text || '').slice(0, MAX_TEXT_CHARS),
        label,
        score: Number(score),
        threshold: Number(threshold),
        createdAt: new Date().toISOString(),
    };

    const others = rows.filter((r) => r.userId !== userId);
    const mine = rows.filter((r) => r.userId === userId);
    mine.push(rec);
    mine.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const kept = mine.slice(-MAX_SCANS_PER_USER);
    writeAll([...others, ...kept]);
    return rec.id;
}

/**
 * @param {string} userId
 * @param {number} [limit=25]
 */
function listForUser(userId, limit = 25) {
    const cap = Math.min(Math.max(Number(limit) || 25, 1), 100);
    const mine = readAll().filter((r) => r.userId === userId);
    mine.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return mine.slice(0, cap).map((r) => ({
        id: r.id,
        createdAt: r.createdAt,
        label: r.label,
        score: r.score,
        threshold: r.threshold,
        preview: previewFromText(r.text),
    }));
}

/**
 * @param {string} userId
 * @param {string} scanId
 */
function getForUser(userId, scanId) {
    const row = readAll().find((r) => r.id === scanId && r.userId === userId);
    if (!row) {
        return null;
    }
    return {
        id: row.id,
        createdAt: row.createdAt,
        label: row.label,
        score: row.score,
        threshold: row.threshold,
        text: row.text,
    };
}

module.exports = {
    appendScan,
    listForUser,
    getForUser,
};
