const { TextractClient, DetectDocumentTextCommand } = require('@aws-sdk/client-textract');

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

async function extractTextFromImageBuffer(imageBuffer) {
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
    const lines = (response.Blocks || [])
        .filter((block) => block.BlockType === 'LINE' && typeof block.Text === 'string')
        .map((block) => block.Text.trim())
        .filter(Boolean);

    return {
        lines,
        text: lines.join('\n'),
        blockCount: (response.Blocks || []).length,
    };
}

module.exports = {
    extractTextFromImageBuffer,
};
