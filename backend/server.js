const path = require('path');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const uploadRoutes = require('./routes/upload');
const scanRoutes = require('./routes/scan');
const authRoutes = require('./routes/auth');

// Load .env from backend/ folder (works when you run `npm run backend` from repo root)
dotenv.config({ path: path.join(__dirname, '.env') });

if (!process.env.JWT_SECRET && process.env.NODE_ENV !== 'production') {
    console.warn(
        '[auth] JWT_SECRET not set — using a dev-only default. Set JWT_SECRET in backend/.env for anything shared or production.',
    );
}

const rawDemo = process.env.ALLOW_DEV_LOGIN_BYPASS;
let allowDemoLog;
if (rawDemo != null && String(rawDemo).trim() !== '') {
    allowDemoLog = String(rawDemo).toLowerCase() === 'true' || rawDemo === '1';
} else {
    allowDemoLog = process.env.NODE_ENV !== 'production';
}
if (allowDemoLog) {
    console.warn(
        '[auth] POST /api/auth/dev-bypass is enabled (passwordless demo). Set ALLOW_DEV_LOGIN_BYPASS=false to disable.',
    );
}

if (String(process.env.MOCK_TEXTRACT).toLowerCase() === 'true' || process.env.MOCK_TEXTRACT === '1') {
    console.warn('[ocr] MOCK_TEXTRACT is on — upload/extract-text returns fake text (no AWS Textract).');
}

const app = express();
const PORT = process.env.BACKEND_PORT || 3001;

app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/scan', scanRoutes);

app.get('/api/health', (_req, res) => {
    res.status(200).json({ ok: true });
});

// Listen on all interfaces so phones on the same Wi‑Fi can reach this machine (not only localhost).
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend server is running on port ${PORT} (all interfaces — use your PC LAN IP from your phone)`);
});
