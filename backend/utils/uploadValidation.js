/**
 * Pure validation for a multer file object (independent paths for testing).
 * @param {{ mimetype?: string } | null | undefined} file
 */
function validateImageFile(file) {
    if (!file) {
        return {
            ok: false,
            status: 400,
            body: {
                error: 'No image file received. Send as multipart/form-data with field name "image".',
            },
        };
    }

    const mimeType = file.mimetype || '';
    if (!mimeType.startsWith('image/')) {
        return {
            ok: false,
            status: 400,
            body: {
                error: 'Unsupported file type. Only image uploads are allowed.',
            },
        };
    }

    return { ok: true };
}

module.exports = { validateImageFile };
