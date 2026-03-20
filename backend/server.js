const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const uploadRoutes = require('./routes/upload');

dotenv.config();

const app = express();
const PORT = process.env.BACKEND_PORT || 3001;

app.use(cors());
app.use(express.json());
app.use('/api/upload', uploadRoutes);

app.get('/api/health', (_req, res) => {
    res.status(200).json({ ok: true });
});

app.listen(PORT, () => {
    console.log(`Backend server is running on port ${PORT}`);
});
