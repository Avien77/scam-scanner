const express = require('express');
const { classifyText } = require('../services/scamPredict');
const { normalizeOcrText } = require('../utils/ocrNormalize');
const { requireAuth } = require('../middleware/requireAuth');
const { appendScan, listForUser, getForUser } = require('../services/scanHistoryStore');

const router = express.Router();

/**
 * GET /api/scan/history?limit=25
 * Recent scans for the signed-in user (newest first).
 */
router.get('/history', requireAuth, (req, res) => {
    try {
        const limit = req.query?.limit;
        const scans = listForUser(req.user.id, limit);
        return res.status(200).json({ scans });
    } catch (error) {
        console.error('Scan history list failed:', error);
        return res.status(500).json({ error: 'Could not load scan history.' });
    }
});

/**
 * GET /api/scan/history/:id
 * Full text for one scan (must belong to the signed-in user).
 */
router.get('/history/:id', requireAuth, (req, res) => {
    try {
        const row = getForUser(req.user.id, req.params.id);
        if (!row) {
            return res.status(404).json({ error: 'Scan not found.' });
        }
        return res.status(200).json({ scan: row });
    } catch (error) {
        console.error('Scan history detail failed:', error);
        return res.status(500).json({ error: 'Could not load scan.' });
    }
});

/**
 * POST /api/scan/classify
 * Body: { "text": "..." }
 * Response: { label, score, threshold, scanId?, disclaimer }
 */
router.post('/classify', requireAuth, (req, res) => {
    try {
        const raw = req.body?.text;
        const text = normalizeOcrText(
            raw == null ? '' : typeof raw === 'string' ? raw : String(raw),
        );

        if (!text) {
            return res.status(400).json({
                error: 'No text to classify. Send JSON body { "text": "..." }.',
            });
        }

        const result = classifyText(text);

        let scanId = null;
        try {
            scanId = appendScan(req.user.id, {
                text,
                label: result.label,
                score: result.score,
                threshold: result.threshold,
            });
        } catch (histErr) {
            console.error('Scan history save failed:', histErr);
        }

        return res.status(200).json({
            ...result,
            scanId,
            disclaimer:
                'Heuristic model for education only — not legal or financial advice. Do not rely on this as a sole safety decision.',
        });
    } catch (error) {
        console.error('Scam classify failed:', error);
        const message = error.message || 'Classification failed.';
        const isModelMissing = /Model not found|train_scam_model/i.test(message);
        return res.status(isModelMissing ? 503 : 500).json({
            error: message,
        });
    }
});

module.exports = router;
