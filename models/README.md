# Trained scam classifier

After training, this folder contains `scam_model.joblib` (not committed if large).

Train from the repo root:

```bash
cd ml
pip install -r requirements.txt
python train_scam_model.py
```

Use your own dataset (same columns as `ml/data/spam_sample.csv`: `text`, `label` where `0` = legitimate, `1` = scam):

```bash
set SPAM_CSV_PATH=C:\path\to\your.csv
python train_scam_model.py
```

The backend calls `ml/predict.py` to score text; without a trained model file, `POST /api/scan/classify` returns an error explaining how to train.
