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

    const response = await getTextractClient().send(command);
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
