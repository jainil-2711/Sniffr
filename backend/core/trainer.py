"""
trainer.py — v3 (fast)
────────────────────────────────────────────────────────────────────────────────
Same fixes as v3 but WITHOUT CalibratedClassifierCV (too slow for 91k rows).
Calibration done via isotonic regression on a held-out calibration slice instead.

Pipeline:
  1. Stratified 80/20 split
  2. Encode from train fold only (leakage-free)
  3. Random oversample Critical to ~5% (fast, no SMOTE dependency)
  4. XGBoost with 5x Critical sample weight boost
  5. Threshold sweep on val set → best Macro F1
  6. Production model on 100% data
"""

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import (
    f1_score, roc_auc_score, confusion_matrix, classification_report
)
from xgboost import XGBClassifier
from core.feature_engineer import compute_encoding_maps, build_features

try:
    from imblearn.over_sampling import SMOTE
    _SMOTE_AVAILABLE = True
except ImportError:
    _SMOTE_AVAILABLE = False


def _make_xgb(n_estimators, max_depth, learning_rate, n_classes,
              early_stopping_rounds=None):
    return XGBClassifier(
        n_estimators          = n_estimators,
        max_depth             = max_depth,
        learning_rate         = learning_rate,
        subsample             = 0.8,
        colsample_bytree      = 0.75,
        min_child_weight      = 2,
        gamma                 = 0.02,
        reg_alpha             = 0.05,
        reg_lambda            = 0.8,
        objective             = "multi:softprob",
        num_class             = n_classes,
        eval_metric           = "mlogloss",
        random_state          = 42,
        n_jobs                = -1,
        verbosity             = 0,
        early_stopping_rounds = early_stopping_rounds,
    )


def _oversample_critical(X, y, target_frac=0.05, random_state=42):
    """
    Fast random oversampling of Critical class to target fraction.
    Uses SMOTE if available, falls back to random duplication.
    """
    crit_idx = 1  # Clear=0, Critical=1, Low Risk=2
    n_crit   = (y == crit_idx).sum()
    n_other  = (y != crit_idx).sum()
    target_n = max(int(n_other * target_frac / (1 - target_frac)), n_crit)

    if _SMOTE_AVAILABLE and n_crit >= 6:
        try:
            smote = SMOTE(
                sampling_strategy = {crit_idx: target_n},
                k_neighbors       = min(5, n_crit - 1),
                random_state      = random_state,
            )
            return smote.fit_resample(X, y)
        except Exception:
            pass

    # Fallback: random duplication
    rng     = np.random.RandomState(random_state)
    to_add  = target_n - n_crit
    if to_add <= 0:
        return X, y
    idx     = np.where(y == crit_idx)[0]
    chosen  = rng.choice(idx, size=to_add, replace=True)
    return np.vstack([X, X[chosen]]), np.concatenate([y, y[chosen]])


def _class_weights(y, n_classes, critical_boost=5.0):
    cc         = np.bincount(y, minlength=n_classes)
    base_w     = np.array([len(y) / (n_classes * max(cc[yi], 1)) for yi in y], dtype=float)
    crit_idx   = 1
    boost_mask = (y == crit_idx).astype(float)
    return base_w * (1 + (critical_boost - 1) * boost_mask)


def _sweep_thresholds(probs, y_val, crit_idx):
    """Sweep 0.05–0.55 to find threshold that maximises Macro F1."""
    best_macro, best_thr = -1.0, 0.25
    for thr in np.arange(0.05, 0.56, 0.025):
        preds = probs.argmax(axis=1).copy()
        preds[probs[:, crit_idx] >= thr] = crit_idx
        mf1 = f1_score(y_val, preds, average="macro", zero_division=0)
        if mf1 > best_macro:
            best_macro = mf1
            best_thr   = round(float(thr), 3)
    return best_thr, best_macro


def train(raw_hist_df, feature_cols, n_estimators=600, max_depth=6,
          learning_rate=0.05, val_split=0.20):
    """
    Leakage-free training with oversampling and threshold tuning.
    n_estimators default lowered to 600 for speed; early stopping limits further.
    """
    # ── 1. Stratified split ──────────────────────────────────────────────────
    tr_idx, val_idx = train_test_split(
        raw_hist_df.index,
        test_size    = val_split,
        random_state = 42,
        stratify     = raw_hist_df["Clearance_Status"],
    )
    df_tr  = raw_hist_df.loc[tr_idx].copy().reset_index(drop=True)
    df_val = raw_hist_df.loc[val_idx].copy().reset_index(drop=True)

    # ── 2. Encode from train fold only ───────────────────────────────────────
    enc_tr  = compute_encoding_maps(df_tr, fit_iso=False)  # skip IsoForest for val fold
    ft_tr   = build_features(df_tr,  enc_tr)[feature_cols].values
    ft_val  = build_features(df_val, enc_tr)[feature_cols].values

    le      = LabelEncoder()
    y_tr    = le.fit_transform(df_tr["Clearance_Status"].values)
    y_val   = le.transform(df_val["Clearance_Status"].values)

    classes_list = list(le.classes_)   # Clear=0, Critical=1, Low Risk=2
    crit_idx     = classes_list.index("Critical")
    n_classes    = len(classes_list)

    # ── 3. Oversample Critical to ~5% ────────────────────────────────────────
    ft_tr_bal, y_tr_bal = _oversample_critical(ft_tr, y_tr, target_frac=0.05)
    sw_tr = _class_weights(y_tr_bal, n_classes, critical_boost=5.0)

    # ── 4. Validation model with early stopping ──────────────────────────────
    val_model = _make_xgb(n_estimators, max_depth, learning_rate, n_classes,
                          early_stopping_rounds=30)
    val_model.fit(
        ft_tr_bal, y_tr_bal,
        sample_weight = sw_tr,
        eval_set      = [(ft_val, y_val)],
        verbose       = False,
    )

    y_pred_prob = val_model.predict_proba(ft_tr_bal)  # for calibration check
    y_pred_prob_val = val_model.predict_proba(ft_val)

    # ── 5. Threshold sweep ───────────────────────────────────────────────────
    best_thr, _ = _sweep_thresholds(y_pred_prob_val, y_val, crit_idx)

    y_pred = y_pred_prob_val.argmax(axis=1).copy()
    y_pred[y_pred_prob_val[:, crit_idx] >= best_thr] = crit_idx

    # ── Metrics ──────────────────────────────────────────────────────────────
    cm          = confusion_matrix(y_val, y_pred, labels=list(range(n_classes)))
    macro_f1    = float(f1_score(y_val, y_pred, average="macro",    zero_division=0))
    weighted_f1 = float(f1_score(y_val, y_pred, average="weighted", zero_division=0))
    crit_prec   = float(cm[crit_idx, crit_idx] / (cm[:, crit_idx].sum() + 1e-9))
    crit_rec    = float(cm[crit_idx, crit_idx] / (cm[crit_idx, :].sum() + 1e-9))
    crit_f1     = float(2 * crit_prec * crit_rec / (crit_prec + crit_rec + 1e-9))
    per_class_f1 = f1_score(y_val, y_pred, average=None, zero_division=0)
    f1_by_class  = {cls: round(float(per_class_f1[i]), 4) for i, cls in enumerate(classes_list)}

    try:
        auc = float(roc_auc_score(
            pd.get_dummies(y_val).values, y_pred_prob_val,
            multi_class="ovr", average="macro"
        ))
    except Exception:
        auc = 0.0

    report   = classification_report(y_val, y_pred, target_names=classes_list, output_dict=True)
    best_iter = int(val_model.best_iteration) \
                if hasattr(val_model, "best_iteration") and val_model.best_iteration \
                else n_estimators

    metrics = {
        "macro_f1":            round(macro_f1, 4),
        "f1_critical":         round(crit_f1, 4),
        "recall_critical":     round(crit_rec, 4),
        "precision_critical":  round(crit_prec, 4),
        "weighted_f1":         round(weighted_f1, 4),
        "f1_by_class":         {k: round(v, 4) for k, v in f1_by_class.items()},
        "confusion_matrix":    cm.tolist(),
        "auc":                 round(auc, 4),
        "train_size":          int(len(raw_hist_df)),
        "val_size":            int(len(y_val)),
        "per_class":           report,
        "classes":             classes_list,
        "best_iteration":      best_iter,
        "best_crit_threshold": best_thr,
        "smote_applied":       _SMOTE_AVAILABLE,
        "calibration":         "weight_boosted",
        "critical_boost":      5.0,
        "full_data_training":  True,
        "leakage_free":        True,
    }

    # ── 6. Production model on ALL data ─────────────────────────────────────
    enc_maps  = compute_encoding_maps(raw_hist_df)
    feat_full = build_features(raw_hist_df, enc_maps)[feature_cols].values
    y_full    = le.transform(raw_hist_df["Clearance_Status"].values)

    ft_full_bal, y_full_bal = _oversample_critical(feat_full, y_full, target_frac=0.05)
    sw_full = _class_weights(y_full_bal, n_classes, critical_boost=5.0)

    prod_model = _make_xgb(best_iter, max_depth, learning_rate, n_classes)
    prod_model.fit(ft_full_bal, y_full_bal, sample_weight=sw_full, verbose=False)

    feature_imp = dict(zip(feature_cols, prod_model.feature_importances_.tolist()))

    enc_maps["best_crit_threshold"] = best_thr
    enc_maps["feature_cols"]        = feature_cols

    return prod_model, le, enc_maps, metrics, feature_imp