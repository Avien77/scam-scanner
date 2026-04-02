const { linesFromTextractBlocks } = require('../utils/textractBlocks');

describe('linesFromTextractBlocks', () => {
    test('path: null blocks → empty array', () => {
        expect(linesFromTextractBlocks(null)).toEqual([]);
    });

    test('path: undefined blocks → empty array', () => {
        expect(linesFromTextractBlocks(undefined)).toEqual([]);
    });

    test('path: non-array → empty array', () => {
        expect(linesFromTextractBlocks({})).toEqual([]);
    });

    test('path: empty array → empty array', () => {
        expect(linesFromTextractBlocks([])).toEqual([]);
    });

    test('path: only WORD blocks → no lines', () => {
        const blocks = [
            { BlockType: 'WORD', Text: 'hello' },
            { BlockType: 'PAGE', Text: 'x' },
        ];
        expect(linesFromTextractBlocks(blocks)).toEqual([]);
    });

    test('path: LINE blocks with text → trimmed strings', () => {
        const blocks = [
            { BlockType: 'LINE', Text: '  first  ' },
            { BlockType: 'LINE', Text: 'second' },
        ];
        expect(linesFromTextractBlocks(blocks)).toEqual(['first', 'second']);
    });

    test('path: LINE with empty/whitespace text dropped', () => {
        const blocks = [
            { BlockType: 'LINE', Text: '   ' },
            { BlockType: 'LINE', Text: 'keep' },
            { BlockType: 'LINE', Text: '' },
        ];
        expect(linesFromTextractBlocks(blocks)).toEqual(['keep']);
    });

    test('path: LINE with non-string Text ignored', () => {
        const blocks = [{ BlockType: 'LINE', Text: 99 }, { BlockType: 'LINE', Text: 'ok' }];
        expect(linesFromTextractBlocks(blocks)).toEqual(['ok']);
    });
});
