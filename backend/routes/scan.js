const express = require('express');
const { classifyText } = require('../services/scamPredict');
const { normalizeOcrText } = require('../utils/ocrNormalize');

const router = express.Router();

/**
 * POST /api/scan/classify
 * Body: { "text": "..." }
 * Response: { label, score, threshold, disclaimer }
 */
router.post('/classify', (req, res) => {
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

        return res.status(200).json({
            ...result,
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
