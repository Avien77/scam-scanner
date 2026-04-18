const { TextractClient, DetectDocumentTextCommand } = require('@aws-sdk/client-textract');
const { linesFromTextractBlocks } = require('../utils/textractBlocks');

let textractClient = null;

function getTextractClient() {
    if (textractClient) {
        return textractClient;
    }

    const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;
    if (!region) {
        throw new Error('Missing AWS region. Set AWS_REGION (or AWS_DEFAULT_REGION).');
    }

    textractClient = new TextractClient({ region });
    return textractClient;
}

function mockExtractResult() {
    const lines = [
        '[Mock OCR — set MOCK_TEXTRACT=true in backend/.env to bypass AWS]',
        'URGENT: Verify your account at http://example.test/verify within 24 hours.',
        'Your security team will never ask for your password by email.',
    ];
    return {
        lines,
        text: lines.join('\n'),
        blockCount: 0,
        mocked: true,
    };
}

function isMockTextract() {
    const v = process.env.MOCK_TEXTRACT;
    return String(v).toLowerCase() === 'true' || v === '1';
}

async function extractTextFromImageBuffer(imageBuffer) {
    if (isMockTextract()) {
        return mockExtractResult();
    }

    const command = new DetectDocumentTextCommand({
        Document: {
            Bytes: imageBuffer,
        },
    });

    let response;
    try {
        response = await getTextractClient().send(command);
    } catch (err) {
        const msg = err.message || '';
        const code = err.name || err.Code || '';
        const unsupported =
            code === 'UnsupportedDocumentException' ||
            /UnsupportedDocumentException/i.test(String(err)) ||
            /unsupported document format/i.test(msg);
        if (unsupported) {
            const hint =
                'AWS Textract needs JPEG, PNG, or TIFF bytes. HEIC/iPhone photos and some WebP files fail unless converted.';
            throw new Error(hint);
        }
        throw err;
    }
    const lines = linesFromTextractBlocks(response.Blocks);

    return {
        lines,
        text: lines.join('\n'),
        blockCount: (response.Blocks || []).length,
        mocked: false,
    };
}

module.exports = {
    extractTextFromImageBuffer,
};
