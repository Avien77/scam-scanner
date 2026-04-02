"""
Train a scam classifier from a labeled CSV and export a single Joblib artifact.

Supported datasets:
- Simple: columns: text, label  (0 = legitimate, 1 = scam)
- Email dataset (matches MLHW4 (2).ipynb): columns like subject, email_text, plus numeric flags, and label

Output:
- models/scam_model.joblib: {"pipeline": sklearn Pipeline, "threshold": 0.5, ...}

Usage (from repo root):
  cd ml
  pip install -r requirements.txt
  python train_scam_model.py

Optional:
  SPAM_CSV_PATH=path/to.csv python train_scam_model.py
"""

from __future__ import annotations

from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.feature_extraction.text import TfidfVectorizer


ROOT = Path(__file__).resolve().parent.parent
DATA_DEFAULT = Path(__file__).resolve().parent / "data" / "spam_sample.csv"
MODEL_DIR = ROOT / "models"
MODEL_PATH = MODEL_DIR / "scam_model.joblib"


NUMERIC_COLS = [
    "num_words",
    "num_characters",
    "num_exclamation_marks",
    "num_links",
    "has_suspicious_link",
    "num_attachments",
    "has_attachment",
    "sender_reputation_score",
    "email_hour",
    "email_day_of_week",
    "is_weekend",
    "num_recipients",
    "contains_money_terms",
    "contains_urgency_terms",
]


def _coalesce_text_row(row: pd.Series) -> str:
    if "text" in row and pd.notna(row["text"]):
        return str(row["text"])
    parts: list[str] = []
    subj = row.get("subject")
    body = row.get("email_text")
    if pd.notna(subj):
        parts.append(str(subj))
    if pd.notna(body):
        parts.append(str(body))
    return "\n".join(parts).strip()


def _build_training_frame(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out["combined_text"] = out.apply(_coalesce_text_row, axis=1)

    # Ensure all numeric cols exist and are numeric (missing → 0).
    for col in NUMERIC_COLS:
        if col not in out.columns:
            out[col] = 0
        out[col] = pd.to_numeric(out[col], errors="coerce").fillna(0)

    return out


def main():
    import os

    csv_path = Path(os.environ.get("SPAM_CSV_PATH", DATA_DEFAULT))
    if not csv_path.is_file():
        raise SystemExit(f"Dataset not found: {csv_path}")

    df = pd.read_csv(csv_path)
    if "label" not in df.columns:
        raise SystemExit('Dataset must contain a "label" column (0=legitimate, 1=scam).')

    df = df.dropna(subset=["label"])
    df = _build_training_frame(df)
    df = df[df["combined_text"].astype(str).str.len() > 0]

    y = pd.to_numeric(df["label"], errors="coerce").fillna(0).astype(int).values
    if len(df) < 20:
        raise SystemExit("Need at least ~20 labeled rows to train reliably.")

    X = df[["combined_text", *NUMERIC_COLS]]

    # Text + numeric features (matches the notebook intent, but deployable from OCR text only).
    pre = ColumnTransformer(
        transformers=[
            (
                "text",
                TfidfVectorizer(
                    max_features=10000,
                    ngram_range=(1, 2),
                    min_df=1,
                    stop_words="english",
                ),
                "combined_text",
            ),
            ("num", Pipeline([("scaler", StandardScaler())]), NUMERIC_COLS),
        ],
        remainder="drop",
    )

    clf = LogisticRegression(
        max_iter=3000,
        class_weight="balanced",
        solver="lbfgs",
    )

    pipeline = Pipeline([("pre", pre), ("clf", clf)])

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y if len(np.unique(y)) > 1 else None
    )

    pipeline.fit(X_train, y_train)
    acc = float(pipeline.score(X_test, y_test)) if len(X_test) else float("nan")
    print(f"Holdout accuracy: {acc:.4f}")

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    bundle = {
        "version": 2,
        "pipeline": pipeline,
        "threshold": 0.5,
        "label_scam": 1,
        "label_legitimate": 0,
        "trained_rows": int(len(df)),
        "source_csv": str(csv_path),
    }
    joblib.dump(bundle, MODEL_PATH)
    print(f"Saved model bundle to {MODEL_PATH}")


if __name__ == "__main__":
    main()
