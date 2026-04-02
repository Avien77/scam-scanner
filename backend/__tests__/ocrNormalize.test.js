const { normalizeOcrText } = require('../utils/ocrNormalize');

describe('normalizeOcrText', () => {
    test('path: null → empty string', () => {
        expect(normalizeOcrText(null)).toBe('');
    });

    test('path: undefined → empty string', () => {
        expect(normalizeOcrText(undefined)).toBe('');
    });

    test('path: non-string → empty string', () => {
        expect(normalizeOcrText(123)).toBe('');
    });

    test('path: whitespace only → empty string', () => {
        expect(normalizeOcrText('   \n\t  ')).toBe('');
    });

    test('path: normal text → trimmed', () => {
        expect(normalizeOcrText('  hello world  ')).toBe('hello world');
    });

    test('path: CRLF → LF newlines preserved as \\n', () => {
        expect(normalizeOcrText('line1\r\nline2')).toBe('line1\nline2');
    });

    test('path: lone CR → LF', () => {
        expect(normalizeOcrText('a\rb')).toBe('a\nb');
    });
});
