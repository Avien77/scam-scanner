"""
stdin: JSON object {"text": "..."}
stdout: JSON {"label":"scam"|"legitimate","score":float,"threshold":float}

Supports:
- v2 bundle: {"pipeline": sklearn Pipeline, "threshold": 0.5, ...}
- legacy bundle: {"vectorizer","mean","std","weights",...}
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
MODEL_PATH = ROOT / "models" / "scam_model.joblib"


URL_RE = re.compile(r"(https?://\S+|www\.\S+)", re.IGNORECASE)
MONEY_RE = re.compile(r"(\$|usd|dollars|money|cash|wire|transfer|gift\s*card|bitcoin|crypto)", re.IGNORECASE)
URGENCY_RE = re.compile(
    r"(urgent|immediately|act\s+now|final\s+notice|last\s+chance|within\s+\d+\s*(hours|days)|expires?\s+soon)",
    re.IGNORECASE,
)
SHORTENER_RE = re.compile(r"\b(bit\.ly|t\.co|tinyurl\.com|goo\.gl)\b", re.IGNORECASE)


def _safe_int(x) -> int:
    try:
        return int(x)
    except Exception:
        return 0


def _features_from_text(text: str) -> dict:
    t = text or ""
    words = re.findall(r"\S+", t)
    urls = URL_RE.findall(t)
    has_suspicious = 1 if (SHORTENER_RE.search(t) is not None) else 0
    return {
        "combined_text": t,
        "num_words": len(words),
        "num_characters": len(t),
        "num_exclamation_marks": t.count("!"),
        "num_links": len(urls),
        "has_suspicious_link": has_suspicious,
        "num_attachments": 0,
        "has_attachment": 0,
        "sender_reputation_score": 0.0,
        "email_hour": 12,
        "email_day_of_week": 0,
        "is_weekend": 0,
        "num_recipients": 1,
        "contains_money_terms": 1 if MONEY_RE.search(t) is not None else 0,
        "contains_urgency_terms": 1 if URGENCY_RE.search(t) is not None else 0,
    }


def _legacy_predict(bundle: dict, text: str) -> tuple[str, float, float]:
    vectorizer = bundle["vectorizer"]
    mean = bundle["mean"]
    std = bundle["std"]
    w = bundle["weights"]
    threshold = float(bundle.get("threshold", 0.5))

    X_raw = vectorizer.transform([text]).toarray().astype(float)
    std_safe = np.where(std == 0, 1.0, std)
    X_scaled = (X_raw - mean) / std_safe
    ones = np.ones((X_scaled.shape[0], 1))
    Xb = np.hstack((ones, X_scaled))
    score = float((Xb @ w)[0])
    label = "scam" if score >= threshold else "legitimate"
    return label, score, threshold


def main():
    raw = sys.stdin.read()
    try:
        payload = json.loads(raw) if raw.strip() else {}
    except json.JSONDecodeError:
        print(json.dumps({"error": "Invalid JSON"}))
        sys.exit(1)

    text = payload.get("text")
    if text is None:
        print(json.dumps({"error": 'Missing "text" field'}))
        sys.exit(1)
    text = str(text)

    if not MODEL_PATH.is_file():
        print(
            json.dumps(
                {
                    "error": "Model not found. Run: cd ml && pip install -r requirements.txt && python train_scam_model.py",
                }
            )
        )
        sys.exit(1)

    bundle = joblib.load(MODEL_PATH)
    threshold = float(bundle.get("threshold", 0.5))

    if "pipeline" in bundle:
        pipeline = bundle["pipeline"]
        row = _features_from_text(text)
        X = pd.DataFrame([row])
        if hasattr(pipeline, "predict_proba"):
            proba = float(pipeline.predict_proba(X)[0][1])
        else:
            # Fallback: try decision_function and sigmoid it
            decision = float(pipeline.decision_function(X)[0])
            proba = float(1.0 / (1.0 + np.exp(-decision)))
        label = "scam" if proba >= threshold else "legitimate"
        print(json.dumps({"label": label, "score": proba, "threshold": threshold}))
        return

    label, score, threshold = _legacy_predict(bundle, text)
    print(json.dumps({"label": label, "score": score, "threshold": threshold}))


if __name__ == "__main__":
    main()
