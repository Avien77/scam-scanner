const path = require('path');
const { spawnSync } = require('child_process');

const PREDICT_SCRIPT = path.join(__dirname, '..', '..', 'ml', 'predict.py');

function resolvePythonArgs() {
    if (process.env.PYTHON_PATH) {
        return { command: process.env.PYTHON_PATH, args: [] };
    }
    if (process.platform === 'win32') {
        return { command: 'py', args: ['-3'] };
    }
    return { command: 'python3', args: [] };
}

/**
 * Run ml/predict.py on text. Requires trained models/scam_model.joblib.
 * @param {string} text
 * @returns {{ label: 'scam'|'legitimate', score: number, threshold: number }}
 */
function classifyText(text) {
    const { command, args: prefixArgs } = resolvePythonArgs();
    const args = [...prefixArgs, PREDICT_SCRIPT];
    const input = JSON.stringify({ text: text ?? '' });

    const result = spawnSync(command, args, {
        input,
        encoding: 'utf8',
        maxBuffer: 2 * 1024 * 1024,
        windowsHide: true,
    });

    if (result.error) {
        throw new Error(
            `Could not run Python (${command}). Install Python 3, add to PATH, or set PYTHON_PATH in backend/.env. ${result.error.message}`,
        );
    }

    if (result.status !== 0) {
        let detail = result.stderr?.trim() || result.stdout?.trim() || `exit ${result.status}`;
        try {
            const errObj = JSON.parse(result.stdout);
            if (errObj.error) detail = errObj.error;
        } catch {
            // keep detail
        }
        throw new Error(detail);
    }

    const parsed = JSON.parse(result.stdout);
    if (parsed.error) {
        throw new Error(parsed.error);
    }
    return {
        label: parsed.label,
        score: parsed.score,
        threshold: parsed.threshold,
    };
}

module.exports = { classifyText };
