const path = require('path');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const uploadRoutes = require('./routes/upload');
const scanRoutes = require('./routes/scan');

// Load .env from backend/ folder (works when you run `npm run backend` from repo root)
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.BACKEND_PORT || 3001;

app.use(cors());
app.use(express.json());
app.use('/api/upload', uploadRoutes);
app.use('/api/scan', scanRoutes);

app.get('/api/health', (_req, res) => {
    res.status(200).json({ ok: true });
});

// Listen on all interfaces so phones on the same Wi‑Fi can reach this machine (not only localhost).
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend server is running on port ${PORT} (all interfaces — use your PC LAN IP from your phone)`);
});
