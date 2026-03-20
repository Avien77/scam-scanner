const express = require('express');
const multer = require('multer');
const { extractTextFromImageBuffer } = require('../services/textractService');

const router = express.Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
    },
});

router.post('/extract-text', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                error: 'No image file received. Send as multipart/form-data with field name "image".',
            });
        }

        const mimeType = req.file.mimetype || '';
        if (!mimeType.startsWith('image/')) {
            return res.status(400).json({
                error: 'Unsupported file type. Only image uploads are allowed.',
            });
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