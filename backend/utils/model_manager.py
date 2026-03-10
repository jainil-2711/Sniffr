"""
model_manager.py — v3
────────────────────────────────────────────────────────────
Handles saving and loading of all model artifacts.

v3: enc_maps now contains sklearn objects (IsolationForest) that cannot
be JSON-serialised. Strategy:
  - sklearn/binary objects → joblib (enc_maps_sklearn.pkl)
  - JSON-serialisable metadata → json (enc_maps_meta.json)
  - Backward compat: loads old encoding_maps.json if new files absent
"""

import json
import joblib
import numpy as np
import pandas as pd
from pathlib import Path

ARTIFACTS_DIR = Path(__file__).parent.parent / "models" / "artifacts"

# Keys in enc_maps that contain sklearn objects (not JSON serialisable)
_SKLEARN_KEYS = {"iso_model"}

# Keys that are plain dicts/scalars → JSON
_JSON_KEYS = {
    "origin_risk", "importer_risk", "exporter_risk", "dest_risk",
    "shipping_line_risk", "hs_risk", "hs_freq", "hs_chapter_risk",
    "hs_vpk_mu", "hs_vpk_sd", "port_dwell_mu", "port_dwell_sd",
    "thresholds", "global_priors", "iso_calibration",
    "origin_tier_low", "origin_tier_high",
    "importer_crit_count",
    "best_crit_threshold", "feature_cols",
}


def _enc_maps_to_json_safe(enc_maps: dict) -> dict:
    """Extract JSON-serialisable subset of enc_maps."""
    out = {}
    for k, v in enc_maps.items():
        if k in _SKLEARN_KEYS:
            continue
        try:
            json.dumps(v)
            out[k] = v
        except (TypeError, ValueError):
            pass
    return out


def save_artifacts(model, label_enc, enc_maps, metrics, feature_imp):
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)

    # Save model (handles both XGBClassifier and CalibratedClassifierCV)
    joblib.dump(model,     ARTIFACTS_DIR / "xgb_model.pkl")
    joblib.dump(label_enc, ARTIFACTS_DIR / "label_encoder.pkl")

    # Save sklearn objects from enc_maps (IsolationForest, etc.)
    sklearn_enc = {k: v for k, v in enc_maps.items() if k in _SKLEARN_KEYS}
    if sklearn_enc:
        joblib.dump(sklearn_enc, ARTIFACTS_DIR / "enc_maps_sklearn.pkl")

    # Save JSON-serialisable enc_maps metadata
    json_enc = _enc_maps_to_json_safe(enc_maps)
    with open(ARTIFACTS_DIR / "enc_maps_meta.json", "w") as f:
        json.dump(json_enc, f)

    # Also save legacy encoding_maps.json for backward compat
    with open(ARTIFACTS_DIR / "encoding_maps.json", "w") as f:
        json.dump(json_enc, f)

    with open(ARTIFACTS_DIR / "metrics.json", "w") as f:
        json.dump(metrics, f, indent=2)
    with open(ARTIFACTS_DIR / "feature_importance.json", "w") as f:
        json.dump(feature_imp, f, indent=2)
    pd.DataFrame(
        list(feature_imp.items()), columns=["feature", "importance"]
    ).sort_values("importance", ascending=False).to_csv(
        ARTIFACTS_DIR / "feature_importance.csv", index=False
    )


def load_artifacts():
    if not (ARTIFACTS_DIR / "xgb_model.pkl").exists():
        return None, None, None, None

    model     = joblib.load(ARTIFACTS_DIR / "xgb_model.pkl")
    label_enc = joblib.load(ARTIFACTS_DIR / "label_encoder.pkl")

    # Load enc_maps: prefer new split format, fall back to legacy
    enc_maps = {}
    meta_path   = ARTIFACTS_DIR / "enc_maps_meta.json"
    legacy_path = ARTIFACTS_DIR / "encoding_maps.json"

    if meta_path.exists():
        with open(meta_path) as f:
            enc_maps = json.load(f)
    elif legacy_path.exists():
        with open(legacy_path) as f:
            enc_maps = json.load(f)

    # Merge sklearn objects back in
    sklearn_path = ARTIFACTS_DIR / "enc_maps_sklearn.pkl"
    if sklearn_path.exists():
        sklearn_enc = joblib.load(sklearn_path)
        enc_maps.update(sklearn_enc)

    with open(ARTIFACTS_DIR / "metrics.json") as f:
        metrics = json.load(f)

    return model, label_enc, enc_maps, metrics


def artifacts_exist() -> bool:
    return (ARTIFACTS_DIR / "xgb_model.pkl").exists()


def get_metrics() -> dict:
    path = ARTIFACTS_DIR / "metrics.json"
    if not path.exists():
        return {}
    with open(path) as f:
        return json.load(f)


def get_feature_importance() -> list:
    path = ARTIFACTS_DIR / "feature_importance.json"
    if not path.exists():
        return []
    with open(path) as f:
        fi = json.load(f)
    return sorted(fi.items(), key=lambda x: -x[1])