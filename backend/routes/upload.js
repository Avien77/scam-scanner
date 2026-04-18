const express = require('express');
const multer = require('multer');
const { extractTextFromImageBuffer } = require('../services/textractService');
const { validateImageFile } = require('../utils/uploadValidation');
const { requireAuth } = require('../middleware/requireAuth');

const router = express.Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
    },
});

router.post('/extract-text', requireAuth, upload.single('image'), async (req, res) => {
    try {
        const validation = validateImageFile(req.file);
        if (!validation.ok) {
            return res.status(validation.status).json(validation.body);
        }

        const result = await extractTextFromImageBuffer(req.file.buffer);

        return res.status(200).json({
            success: true,
            text: result.text,
            lines: result.lines,
            metadata: {
                blockCount: result.blockCount,
                fileName: req.file.originalname,
                mimeType: req.file.mimetype,
                sizeBytes: req.file.size,
                mockOcr: Boolean(result.mocked),
            },
        });
    } catch (error) {
        console.error('Textract extraction failed:', error);
        return res.status(500).json({
            error: 'Failed to extract text from image.',
            details: error.message,
        });
    }
});

module.exports = router;