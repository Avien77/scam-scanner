# Scam classifier (logistic regression + TF‑IDF + heuristics)

This trains a **deployable** scam classifier for the app pipeline:

Image → AWS Textract → extracted text → ML model → **scam / legitimate**

It supports both:
- A simple CSV with `text,label`
- The richer email dataset used in `MLHW4 (2).ipynb` (e.g. `subject`, `email_text`, numeric flags, `label`)

At runtime (backend), we only have OCR text. `predict.py` derives the numeric feature flags from the text (counts of words/links/urgency/money terms, etc.) so the model still works end-to-end.

## Setup

```bash
cd ml
pip install -r requirements.txt
```

Windows (if `python` is not on PATH):

```bash
py -3 -m pip install -r requirements.txt
```

## Train

Default dataset: `ml/data/spam_sample.csv`.

```bash
python train_scam_model.py
```

Custom CSV:

```bash
# PowerShell
$env:SPAM_CSV_PATH="C:\path\to\labeled.csv"; python train_scam_model.py
```

Output: `models/scam_model.joblib`

## Predict (CLI check)

```bash
echo {"text":"You won $5000 click here now"} | python predict.py
```

## Backend

`npm run backend` calls `ml/predict.py` via Python for `POST /api/scan/classify`.

Optional `backend/.env`:

- `PYTHON_PATH` — full path to `python.exe` if `py` / `python3` is not found.
