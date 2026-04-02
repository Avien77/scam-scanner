const { validateImageFile } = require('../utils/uploadValidation');

describe('validateImageFile', () => {
    test('path: missing file → 400 and no-image error', () => {
        const actual = validateImageFile(null);
        expect(actual).toEqual({
            ok: false,
            status: 400,
            body: {
                error: 'No image file received. Send as multipart/form-data with field name "image".',
            },
        });
    });

    test('path: undefined file → same as missing', () => {
        const actual = validateImageFile(undefined);
        expect(actual.ok).toBe(false);
        expect(actual.status).toBe(400);
        expect(actual.body.error).toMatch(/No image file received/);
    });

    test('path: non-image mimetype → 400 unsupported type', () => {
        const file = { mimetype: 'application/pdf', originalname: 'x.pdf', size: 1 };
        const actual = validateImageFile(file);
        expect(actual).toEqual({
            ok: false,
            status: 400,
            body: {
                error: 'Unsupported file type. Only image uploads are allowed.',
            },
        });
    });

    test('path: empty mimetype string → unsupported (not image/)', () => {
        const file = { mimetype: '', originalname: 'x' };
        const actual = validateImageFile(file);
        expect(actual.ok).toBe(false);
        expect(actual.body.error).toMatch(/Unsupported file type/);
    });

    test('path: image/jpeg → ok', () => {
        const file = { mimetype: 'image/jpeg', originalname: 'a.jpg', size: 100 };
        expect(validateImageFile(file)).toEqual({ ok: true });
    });

    test('path: image/png → ok', () => {
        const file = { mimetype: 'image/png', originalname: 'b.png', size: 200 };
        expect(validateImageFile(file)).toEqual({ ok: true });
    });
});
