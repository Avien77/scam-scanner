/**
 * Normalize OCR text before downstream ML / storage (independent paths for testing).
 * @param {string | null | undefined} text
 * @returns {string}
 */
function normalizeOcrText(text) {
    if (text == null) {
        return '';
    }
    if (typeof text !== 'string') {
        return '';
    }
    const trimmed = text.trim();
    if (trimmed.length === 0) {
        return '';
    }
    return trimmed.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

module.exports = { normalizeOcrText };
