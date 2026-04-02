/**
 * Map Textract DetectDocumentText Blocks to trimmed line strings (independent paths for testing).
 * @param {Array<{ BlockType?: string, Text?: string }> | null | undefined} blocks
 * @returns {string[]}
 */
function linesFromTextractBlocks(blocks) {
    if (!blocks || !Array.isArray(blocks)) {
        return [];
    }

    return blocks
        .filter(
            (block) =>
                block &&
                block.BlockType === 'LINE' &&
                typeof block.Text === 'string',
        )
        .map((block) => block.Text.trim())
        .filter(Boolean);
}

module.exports = { linesFromTextractBlocks };
