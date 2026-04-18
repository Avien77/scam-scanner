const jwt = require('jsonwebtoken');

function getJwtSecret() {
    const s = process.env.JWT_SECRET;
    if (s && String(s).trim()) {
        return String(s).trim();
    }
    if (process.env.NODE_ENV === 'production') {
        throw new Error('JWT_SECRET is required in production.');
    }
    return 'scam-scanner-dev-secret-change-me';
}

function requireAuth(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Sign in required. Send Authorization: Bearer <token>.' });
    }
    const token = header.slice('Bearer '.length).trim();
    if (!token) {
        return res.status(401).json({ error: 'Missing token.' });
    }
    try {
        const payload = jwt.verify(token, getJwtSecret());
        const sub = payload.sub;
        const email = payload.email;
        if (!sub || !email) {
            return res.status(401).json({ error: 'Invalid token payload.' });
        }
        req.user = { id: String(sub), email: String(email) };
        return next();
    } catch {
        return res.status(401).json({ error: 'Invalid or expired token.' });
    }
}

module.exports = { requireAuth, getJwtSecret };
