jest.mock('child_process', () => ({
    spawnSync: jest.fn(),
}));

describe('scamPredict.classifyText', () => {
    beforeEach(() => {
        jest.resetModules();
        delete process.env.PYTHON_PATH;
    });

    test('returns parsed result from predictor stdout', () => {
        const { spawnSync } = require('child_process');
        spawnSync.mockReturnValue({
            error: null,
            status: 0,
            stdout: JSON.stringify({ label: 'scam', score: 0.91, threshold: 0.5 }),
            stderr: '',
        });

        const { classifyText } = require('../services/scamPredict');
        const out = classifyText('hello');

        expect(out).toEqual({ label: 'scam', score: 0.91, threshold: 0.5 });
        expect(spawnSync).toHaveBeenCalled();
    });

    test('throws a helpful error when Python cannot be executed', () => {
        const { spawnSync } = require('child_process');
        spawnSync.mockReturnValue({
            error: new Error('spawn py ENOENT'),
            status: null,
            stdout: '',
            stderr: '',
        });

        const { classifyText } = require('../services/scamPredict');
        expect(() => classifyText('hi')).toThrow(/Install Python 3|PYTHON_PATH/i);
    });

    test('throws model-missing error from predictor JSON', () => {
        const { spawnSync } = require('child_process');
        spawnSync.mockReturnValue({
            error: null,
            status: 1,
            stdout: JSON.stringify({ error: 'Model not found. Run: cd ml && ... train_scam_model.py' }),
            stderr: '',
        });

        const { classifyText } = require('../services/scamPredict');
        expect(() => classifyText('hi')).toThrow(/Model not found/i);
    });
});

