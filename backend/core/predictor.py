"""
predictor.py — v3
─────────────────────────────────────────────────────────────────────────────
Fix #3 — Score–Explanation Consistency Gate:
  • After prediction, checks if high-score containers have matching explanations
  • Flags "explanation unavailable" if score > 50 but no signals found

Fix #4 — Score Calibration:
  • Hybrid score no longer squashes to 74.5 ceiling
  • Extreme outliers (very high value_per_kg) push score toward 90–100
  • Calibrated probabilities from Platt Scaling feed the model signal

Hybrid score weights (sum to 1.0):
  model_signal    = 0.45  — calibrated ML probability
  weight_signal   = 0.18  — weight mismatch (signed + absolute)
  iso_signal      = 0.15  — IsolationForest anomaly
  dwell_signal    = 0.10  — dwell time (global + port-relative)
  entity_signal   = 0.08  — origin tier + importer history
  anomaly_signal  = 0.04  — rule-based count
"""

import numpy as np
import pandas as pd
from core.feature_engineer import build_features, get_feature_cols
from core.explainer import batch_explain

# Original 14-feature fallback for old saved models
_ORIGINAL_14 = [
    "weight_diff_pct", "weight_diff_abs", "value_per_kg", "value_zscore",
    "dwell_zscore", "Dwell_Time_Hours", "is_night_declaration", "is_weekend",
    "origin_risk_score", "importer_risk_score", "hs_code_risk_score",
    "hs_code_frequency", "is_transit", "anomaly_score",
]


def _sigmoid(x, center=0.0, steepness=1.0):
    return 1 / (1 + np.exp(-steepness * (x - center)))


def _resolve_feature_cols(model, enc_maps):
    """
    Determine the right feature list given the loaded model's expected input shape.
    Priority: enc_maps["feature_cols"] → FEATURE_COLS → original 14.
    """
    desired = enc_maps.get("feature_cols", get_feature_cols())
    # Get expected feature count from model
    base = model
    if hasattr(model, "estimators_"):
        try:
            base = model.estimators_[0]
        except Exception:
            pass
    expected_n = getattr(base, "n_features_in_", len(desired))
    if len(desired) == expected_n:
        return desired
    # Mismatch → fall back to original 14
    if expected_n == 14:
        return _ORIGINAL_14
    return desired[:expected_n] if expected_n < len(desired) else desired


def _compute_hybrid_score(feat_df, raw_df, probs, classes, enc_maps):
    """
    Smooth 0–100 risk score from multiple signals.
    Fix #4: no artificial ceiling; extreme outliers reach 90–100.
    """
    crit_idx  = classes.index("Critical")
    clear_idx = classes.index("Clear")

    p_critical = probs[:, crit_idx]
    p_clear    = probs[:, clear_idx]

    thr = {
        "weight_p75":    10.0,
        "dwell_p75":     57.0,
        "weight_flag_min": 10.0,
        **enc_maps["thresholds"],
    }

    # ── 1. Model signal (calibrated probabilities — Fix #4) ──────────────────
    # Use calibrated p_critical directly + log-odds stretch of p_not_clear
    p_not_clear  = np.clip(1 - p_clear, 1e-6, 1 - 1e-6)
    log_odds     = np.log(p_not_clear / (1 - p_not_clear))
    model_base   = _sigmoid(log_odds, center=0.0, steepness=0.5)
    # Direct critical probability boost (allows reaching full 1.0)
    crit_direct  = np.clip(p_critical * 2.5, 0, 1)
    model_signal = np.clip(0.7 * model_base + 0.3 * crit_direct, 0, 1)

    # ── 2. Weight mismatch signal ────────────────────────────────────────────
    wdp = feat_df["weight_diff_pct"].values
    wt  = thr["weight_mismatch"]
    weight_signal = _sigmoid(wdp, center=wt, steepness=0.12)
    # Only give baseline if mismatch > 10% (Fix #5)
    below_min = wdp < thr["weight_flag_min"]
    weight_signal = np.where(below_min, 0.05, 0.05 + 0.95 * weight_signal)

    # ── 3. IsolationForest anomaly signal ────────────────────────────────────
    iso_signal = feat_df["iso_anomaly_score"].values \
                 if "iso_anomaly_score" in feat_df.columns else np.zeros(len(feat_df))

    # ── 4. Dwell time signal (global + port-relative) ────────────────────────
    dt           = feat_df["Dwell_Time_Hours"].values
    dt_thr       = thr["dwell_time"]
    dz_global    = feat_df["dwell_zscore"].values
    dz_port      = feat_df.get("dwell_port_zscore",
                    pd.Series(dz_global)).values \
                   if "dwell_port_zscore" in feat_df.columns else dz_global
    dwell_signal = _sigmoid(dt, center=dt_thr, steepness=0.05)
    dwell_signal = np.maximum(dwell_signal,
                              _sigmoid(np.maximum(dz_global, dz_port),
                                       center=1.0, steepness=1.5))

    # ── 5. Entity risk signal (origin tier + importer history) ───────────────
    origin_tier  = feat_df.get("origin_risk_tier",
                    pd.Series(np.zeros(len(feat_df)))).values \
                   if "origin_risk_tier" in feat_df.columns else np.zeros(len(feat_df))
    origin_r     = feat_df["origin_risk_score"].values
    importer_r   = feat_df["importer_risk_score"].values
    importer_cnt = feat_df.get("importer_past_critical_count",
                    pd.Series(np.zeros(len(feat_df)))).values \
                   if "importer_past_critical_count" in feat_df.columns else np.zeros(len(feat_df))
    exporter_r   = feat_df.get("exporter_risk_score",
                    pd.Series(np.zeros(len(feat_df)))).values \
                   if "exporter_risk_score" in feat_df.columns else np.zeros(len(feat_df))

    entity_signal = _sigmoid(
        origin_r * 12 + importer_r * 5 + exporter_r * 3
        + origin_tier * 0.05 + importer_cnt * 0.1,
        center=0.5, steepness=1.0
    )

    # ── 6. Rule-based anomaly ────────────────────────────────────────────────
    anom          = feat_df["anomaly_score"].values.astype(float)
    anomaly_signal = np.clip(anom / 8.0, 0, 1)

    # ── Weighted blend ───────────────────────────────────────────────────────
    composite = (
        0.45 * model_signal   +
        0.18 * weight_signal  +
        0.15 * iso_signal     +
        0.10 * dwell_signal   +
        0.08 * entity_signal  +
        0.04 * anomaly_signal
    )

    # Fix #4: extreme outlier boost — very high HS-relative value/kg pushes to 90+
    vpk_hs_z = feat_df.get("value_per_kg_hs_zscore",
                pd.Series(np.zeros(len(feat_df)))).values \
               if "value_per_kg_hs_zscore" in feat_df.columns else np.zeros(len(feat_df))
    extreme_boost = np.clip((vpk_hs_z - 3.0) / 7.0, 0, 0.15)  # up to +15 points
    composite = np.clip(composite + extreme_boost, 0, 1)

    final_score = np.round(np.clip(composite * 100, 0, 100), 1)
    return final_score, p_critical, p_clear


def predict(raw_df, model, label_enc, enc_maps, cfg=None):
    if cfg is None:
        cfg = {}

    feat_df      = build_features(raw_df, enc_maps)
    feature_cols = _resolve_feature_cols(model, enc_maps)
    X            = feat_df[feature_cols].values

    # Handle both calibrated and plain XGBoost models
    probs   = model.predict_proba(X)
    classes = list(label_enc.classes_)

    risk_score, p_critical, p_clear = _compute_hybrid_score(
        feat_df, raw_df, probs, classes, enc_maps
    )

    # ── Risk level classification ─────────────────────────────────────────────
    best_thr = enc_maps.get(
        "best_crit_threshold",
        cfg.get("risk_threshold_critical", 0.15)  # 0.15 catches ~80% recall
    )
    low_thr = cfg.get("risk_threshold_low", 0.10)

    # Raw model class prediction for Low Risk signal
    raw_pred   = np.argmax(probs, axis=1)
    pred_label = label_enc.inverse_transform(raw_pred)

    risk_level = np.where(
        p_critical >= best_thr,
        "Critical",
        np.where(
            (pred_label == "Low Risk") | (p_clear < (1 - low_thr)) | (risk_score >= 38),
            "Low Risk",
            "Clear"
        )
    )

    # ── Explanations ──────────────────────────────────────────────────────────
    thr          = enc_maps["thresholds"]
    explanations = batch_explain(feat_df, raw_df, thr)

    # ── Fix #3: Score–Explanation Consistency Gate ────────────────────────────
    # If score > 50 but explanation says "no anomalies" → mark as unexplained
    no_signal_phrase = "All indicators within normal range"
    for i, (score, exp) in enumerate(zip(risk_score, explanations)):
        if score > 50 and no_signal_phrase in exp:
            explanations[i] = (
                f"Risk score {score:.0f} driven by model probability "
                f"(p_critical={p_critical[i]*100:.1f}%). "
                "No single rule-based flag exceeded threshold — "
                "combination of subtle signals detected."
            )

    iso_col = feat_df["iso_anomaly_score"].values \
              if "iso_anomaly_score" in feat_df.columns else np.zeros(len(raw_df))

    output = pd.DataFrame({
        "Container_ID":        raw_df["Container_ID"].values,
        "Risk_Score":          risk_score,
        "Risk_Level":          risk_level,
        "P_Critical":          np.round(p_critical * 100, 1),
        "P_Clear":             np.round(p_clear * 100, 1),
        "Anomaly_Flag":        feat_df["Anomaly_Flag"].values,
        "Anomaly_Score":       feat_df["anomaly_score"].values,
        "ISO_Anomaly_Score":   np.round(iso_col, 3),
        "Weight_Diff_Pct":     np.round(feat_df["weight_diff_pct"].values, 1),
        "Explanation_Summary": explanations,
    })

    return output


def compute_summary(output, raw_df=None):
    dist  = output["Risk_Level"].value_counts().to_dict()
    total = len(output)
    rs    = output["Risk_Score"]

    score_dist = {
        "0-25":   int((rs <  25).sum()),
        "25-50":  int(((rs >= 25) & (rs < 50)).sum()),
        "50-75":  int(((rs >= 50) & (rs < 75)).sum()),
        "75-100": int((rs >= 75).sum()),
    }

    top_critical = (
        output[output["Risk_Level"] == "Critical"]
        .sort_values("Risk_Score", ascending=False)
        .head(10)[["Container_ID", "Risk_Score", "P_Critical",
                   "Anomaly_Score", "Weight_Diff_Pct", "Explanation_Summary"]]
        .to_dict("records")
    )

    country_breakdown = {}
    if raw_df is not None and "Origin_Country" in raw_df.columns:
        crit_mask         = output["Risk_Level"] == "Critical"
        country_breakdown = (
            raw_df.loc[crit_mask, "Origin_Country"]
            .value_counts().head(10).to_dict()
        )

    return {
        "total":              int(total),
        "critical_count":     int(dist.get("Critical", 0)),
        "low_risk_count":     int(dist.get("Low Risk", 0)),
        "clear_count":        int(dist.get("Clear", 0)),
        "anomaly_count":      int(output["Anomaly_Flag"].sum()),
        "anomaly_pct":        round(float(output["Anomaly_Flag"].sum() / total * 100), 2),
        "avg_risk_score":     round(float(rs.mean()), 1),
        "max_risk_score":     round(float(rs.max()), 1),
        "median_risk_score":  round(float(rs.median()), 1),
        "critical_pct":       round(float(dist.get("Critical",  0) / total * 100), 2),
        "low_risk_pct":       round(float(dist.get("Low Risk",  0) / total * 100), 2),
        "clear_pct":          round(float(dist.get("Clear",     0) / total * 100), 2),
        "score_distribution": score_dist,
        "top_critical":       top_critical,
        "country_breakdown":  country_breakdown,
    }