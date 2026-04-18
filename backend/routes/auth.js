const express = require('express');
const jwt = require('jsonwebtoken');
const { requireAuth, getJwtSecret } = require('../middleware/requireAuth');
const { normalizeEmail, createUser, verifyPassword } = require('../services/userStore');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Stable demo user for preview tokens (scan history, etc.). */
const PREVIEW_USER = {
    id: '00000000-0000-4000-8000-000000000001',
    email: 'demo@preview.local',
};

function isDevBypassAllowed() {
    const raw = process.env.ALLOW_DEV_LOGIN_BYPASS;
    if (raw != null && String(raw).trim() !== '') {
        return String(raw).toLowerCase() === 'true' || raw === '1';
    }
    return process.env.NODE_ENV !== 'production';
}

function validatePassword(password) {
    const p = password == null ? '' : String(password);
    if (p.length < 8) {
        return 'Password must be at least 8 characters.';
    }
    return null;
}

function signToken(user) {
    return jwt.sign({ sub: user.id, email: user.email }, getJwtSecret(), { expiresIn: '7d' });
}

/**
 * POST /api/auth/dev-bypass
 * Issues a real JWT for a fixed preview user (no password). Disabled when ALLOW_DEV_LOGIN_BYPASS=false
 * or in production (unless explicitly set to true).
 */
router.post('/dev-bypass', (req, res) => {
    try {
        if (!isDevBypassAllowed()) {
            return res.status(403).json({
                error: 'Demo login is disabled. Set ALLOW_DEV_LOGIN_BYPASS=true in backend/.env (not for production).',
            });
        }
        const token = jwt.sign(
            { sub: PREVIEW_USER.id, email: PREVIEW_USER.email },
            getJwtSecret(),
            { expiresIn: '30d' },
        );
        return res.status(200).json({
            token,
            user: { id: PREVIEW_USER.id, email: PREVIEW_USER.email },
        });
    } catch (err) {
        console.error('dev-bypass failed:', err);
        return res.status(500).json({ error: 'Could not issue demo token.' });
    }
});

/**
 * POST /api/auth/register
 * Body: { "email": "...", "password": "..." }
 */
router.post('/register', (req, res) => {
    try {
        const email = normalizeEmail(req.body?.email);
        const password = req.body?.password;

        if (!email || !EMAIL_RE.test(email)) {
            return res.status(400).json({ error: 'Valid email is required.' });
        }
        const pwErr = validatePassword(password);
        if (pwErr) {
            return res.status(400).json({ error: pwErr });
        }

        const created = createUser(email, password);
        if (!created.ok) {
            if (created.code === 'EMAIL_IN_USE') {
                return res.status(409).json({ error: 'An account with this email already exists.' });
            }
            return res.status(500).json({ error: 'Could not create account.' });
        }

        const token = signToken(created.user);
        return res.status(201).json({
            token,
            user: { id: created.user.id, email: created.user.email },
        });
    } catch (err) {
        console.error('Register failed:', err);
        return res.status(500).json({ error: 'Registration failed.' });
    }
});

/**
 * POST /api/auth/login
 * Body: { "email": "...", "password": "..." }
 */
router.post('/login', (req, res) => {
    try {
        const email = normalizeEmail(req.body?.email);
        const password = req.body?.password;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required.' });
        }

        const user = verifyPassword(email, password);
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        const token = signToken(user);
        return res.status(200).json({
            token,
            user: { id: user.id, email: user.email },
        });
    } catch (err) {
        console.error('Login failed:', err);
        return res.status(500).json({ error: 'Login failed.' });
    }
});

/**
 * GET /api/auth/me
 * Header: Authorization: Bearer <token>
 */
router.get('/me', requireAuth, (req, res) => {
    return res.status(200).json({ user: req.user });
});

module.exports = router;
