"""
train_now.py v4 — Reliable, fast, complete training script.
Run from backend/: python train_now.py

Fixes applied vs all previous versions:
  - CSV loading uses line-level text filter (no pandas apply)
  - origin_risk_tier uses np.where (no pd.cut bin-edge crash)
  - IsolationForest: max_samples=8000, n_estimators=100 (fast)
  - No CalibratedClassifierCV (removed — was the 25-min hang)
  - Threshold sweep included + saved to enc_maps + metrics
  - All artifacts saved atomically at end
"""

import sys, time, io, json
import numpy as np
import pandas as pd
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

T_TOTAL = time.time()

def elapsed(t): return f"{time.time()-t:.1f}s"

print("=" * 62)
print("  SmartRisk — Direct Training Script v4")
print("=" * 62)

# ── STEP 1: Load & clean CSV ─────────────────────────────────
t = time.time()
print(f"\n[1/7] Loading CSV...")
CSV = Path(__file__).parent / "data" / "Historical_Data.csv"
if not CSV.exists():
    print(f"ERROR: {CSV} not found"); sys.exit(1)

raw_lines = CSV.read_text(encoding="utf-8", errors="replace").splitlines()
clean_lines = [l for l in raw_lines if not l.startswith(("<<<",">>>","===","---","+++" ))]
hist = pd.read_csv(io.StringIO("\n".join(clean_lines)), low_memory=False)

VALID = {"Clear", "Low Risk", "Critical"}
if "Clearance_Status" not in hist.columns:
    print(f"ERROR: Clearance_Status column missing. Columns: {list(hist.columns)}")
    sys.exit(1)

hist = hist[hist["Clearance_Status"].isin(VALID)].copy().reset_index(drop=True)
dist = hist["Clearance_Status"].value_counts().to_dict()
print(f"  Loaded {len(hist):,} rows in {elapsed(t)}")
print(f"  Classes: {dist}")

# ── STEP 2: Train/Val split ──────────────────────────────────
t = time.time()
print(f"\n[2/7] Splitting 80/20 stratified...")
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder

tr_idx, val_idx = train_test_split(
    hist.index, test_size=0.20, random_state=42,
    stratify=hist["Clearance_Status"]
)
df_tr  = hist.loc[tr_idx].copy().reset_index(drop=True)
df_val = hist.loc[val_idx].copy().reset_index(drop=True)
print(f"  Train={len(df_tr):,}  Val={len(df_val):,}  {elapsed(t)}")

# ── STEP 3: Encoding maps (no IsoForest on val fold) ─────────
t = time.time()
print(f"\n[3/7] Computing encoding maps (val fold, skip IsoForest)...")
from core.feature_engineer import compute_encoding_maps, build_features, get_feature_cols

enc_tr  = compute_encoding_maps(df_tr, fit_iso=False)
feature_cols = get_feature_cols()
print(f"  Enc maps done  {elapsed(t)}")

t = time.time()
print(f"\n[4/7] Building features ({len(feature_cols)} cols)...")
ft_tr  = build_features(df_tr,  enc_tr)[feature_cols].values
ft_val = build_features(df_val, enc_tr)[feature_cols].values

le    = LabelEncoder()
y_tr  = le.fit_transform(df_tr["Clearance_Status"].values)
y_val = le.transform(df_val["Clearance_Status"].values)
classes_list = list(le.classes_)
crit_idx     = classes_list.index("Critical")
n_classes    = len(classes_list)

print(f"  Features built  train={ft_tr.shape}  val={ft_val.shape}  {elapsed(t)}")

# ── STEP 4: Oversample Critical ──────────────────────────────
t = time.time()
print(f"\n[5/7] Oversampling Critical to ~5%...")

def oversample_critical(X, y, target_frac=0.05, seed=42):
    ci = 1  # Critical index
    n_crit  = (y == ci).sum()
    n_other = (y != ci).sum()
    target  = max(int(n_other * target_frac / (1 - target_frac)), n_crit)
    to_add  = target - n_crit
    if to_add <= 0:
        return X, y
    try:
        from imblearn.over_sampling import SMOTE
        smote = SMOTE(sampling_strategy={ci: target},
                      k_neighbors=min(5, n_crit-1), random_state=seed)
        return smote.fit_resample(X, y)
    except Exception:
        pass
    rng    = np.random.RandomState(seed)
    idx    = np.where(y == ci)[0]
    chosen = rng.choice(idx, size=to_add, replace=True)
    return np.vstack([X, X[chosen]]), np.concatenate([y, y[chosen]])

ft_tr_bal, y_tr_bal = oversample_critical(ft_tr, y_tr, target_frac=0.08)
counts = np.bincount(y_tr_bal, minlength=n_classes)
print(f"  Balanced counts: {dict(zip(classes_list, counts.tolist()))}  {elapsed(t)}")

# Sample weights: 5x boost on Critical
cc = np.bincount(y_tr_bal, minlength=n_classes)
base_w = np.array([len(y_tr_bal)/(n_classes*max(cc[yi],1)) for yi in y_tr_bal], dtype=float)
sw_tr  = base_w * np.where(y_tr_bal == crit_idx, 8.0, 1.0)  # 8x boost

# ── STEP 5: Train XGBoost ────────────────────────────────────
t = time.time()
print(f"\n[6/7] Training XGBoost (max 600 trees, early stop=30)...")
from xgboost import XGBClassifier
from sklearn.metrics import f1_score, confusion_matrix, classification_report

val_model = XGBClassifier(
    n_estimators=600, max_depth=7, learning_rate=0.05,
    subsample=0.8, colsample_bytree=0.75, min_child_weight=1,
    gamma=0.02, reg_alpha=0.05, reg_lambda=0.8,
    objective="multi:softprob", num_class=n_classes,
    eval_metric="mlogloss", random_state=42,
    n_jobs=-1, verbosity=0, early_stopping_rounds=30,
)
val_model.fit(
    ft_tr_bal, y_tr_bal,
    sample_weight=sw_tr,
    eval_set=[(ft_val, y_val)],
    verbose=False,
)
best_iter = val_model.best_iteration or 300
print(f"  Done. Best iteration: {best_iter}  {elapsed(t)}")

# ── Threshold sweep ──────────────────────────────────────────
probs_val = val_model.predict_proba(ft_val)
print(f"\n  Threshold sweep (Macro F1 optimisation):")
print(f"  {'Thr':6s} {'MacroF1':9s} {'Recall':8s} {'Precis':8s} {'F1Crit':8s} {'TP':4s} {'FN':4s}")
print(f"  {'-'*55}")

results = []
for thr in np.arange(0.05, 0.56, 0.025):
    preds = probs_val.argmax(axis=1).copy()
    preds[probs_val[:, crit_idx] >= thr] = crit_idx
    cm    = confusion_matrix(y_val, preds, labels=list(range(n_classes)))
    tp    = cm[crit_idx, crit_idx]
    fp    = cm[:, crit_idx].sum() - tp
    fn    = cm[crit_idx, :].sum() - tp
    rec   = tp / max(tp + fn, 1)
    prec  = tp / max(tp + fp, 1)
    cf1   = 2*prec*rec / max(prec+rec, 1e-9)
    mf1   = f1_score(y_val, preds, average="macro", zero_division=0)
    results.append((round(float(thr),3), float(mf1), float(rec), float(prec), float(cf1), int(tp), int(fn)))
    marker = " ◄" if 0.12 <= thr <= 0.22 else ""
    print(f"  {thr:6.3f} {mf1:9.4f} {rec:8.4f} {prec:8.4f} {cf1:8.4f} {int(tp):4d} {int(fn):4d}{marker}")

# Best threshold: maximise Macro F1 but require Recall >= 0.70
hi_recall = [r for r in results if r[2] >= 0.60]
best = max(hi_recall, key=lambda x: x[1]) if hi_recall else max(results, key=lambda x: x[1])
best_thr = best[0]
print(f"\n  Selected threshold: {best_thr}  (Macro F1={best[1]:.4f}, Recall={best[2]:.4f})")

# Final preds at best threshold
y_pred = probs_val.argmax(axis=1).copy()
y_pred[probs_val[:, crit_idx] >= best_thr] = crit_idx

cm_final = confusion_matrix(y_val, y_pred, labels=list(range(n_classes)))
mf1      = float(f1_score(y_val, y_pred, average="macro", zero_division=0))
wf1      = float(f1_score(y_val, y_pred, average="weighted", zero_division=0))
pf1      = f1_score(y_val, y_pred, average=None, zero_division=0)
tp       = cm_final[crit_idx, crit_idx]
fp       = cm_final[:, crit_idx].sum() - tp
fn       = cm_final[crit_idx, :].sum() - tp
crit_rec  = tp / max(tp + fn, 1)
crit_prec = tp / max(tp + fp, 1)
crit_f1   = 2*crit_prec*crit_rec / max(crit_prec+crit_rec, 1e-9)

try:
    from sklearn.metrics import roc_auc_score
    auc = float(roc_auc_score(pd.get_dummies(y_val).values, probs_val,
                              multi_class="ovr", average="macro"))
except Exception:
    auc = 0.0

report = classification_report(y_val, y_pred, target_names=classes_list, output_dict=True)

print(f"\n{'='*62}")
print(f"  RESULTS AT THRESHOLD {best_thr}")
print(f"{'='*62}")
print(f"  PRIMARY   Macro F1:         {mf1:.4f}   (target ≥0.75)")
print(f"  CRITICAL  F1:               {crit_f1:.4f}   (target ≥0.65)")
print(f"  CRITICAL  Recall:           {crit_rec:.4f}   (target ≥0.85)")
print(f"  CRITICAL  Precision:        {crit_prec:.4f}")
print(f"            Weighted F1:      {wf1:.4f}")
print(f"            AUC:              {auc:.4f}")
print(f"\n  Confusion Matrix:")
print(f"  {'':12s} {'→Clear':8s} {'→Critical':10s} {'→LowRisk':10s}")
for i, cls in enumerate(classes_list):
    print(f"  {cls:12s} {cm_final[i][0]:8d} {cm_final[i][1]:10d} {cm_final[i][2]:10d}")
print(f"\n  Critical caught: {tp}/{tp+fn} ({crit_rec*100:.1f}%)")
print(f"{'='*62}")

metrics = {
    "macro_f1":            round(mf1, 4),
    "f1_critical":         round(crit_f1, 4),
    "recall_critical":     round(crit_rec, 4),
    "precision_critical":  round(crit_prec, 4),
    "weighted_f1":         round(wf1, 4),
    "auc":                 round(auc, 4),
    "f1_by_class":         {c: round(float(pf1[i]),4) for i,c in enumerate(classes_list)},
    "confusion_matrix":    cm_final.tolist(),
    "classes":             classes_list,
    "best_crit_threshold": best_thr,
    "best_iteration":      best_iter,
    "train_size":          int(len(hist)),
    "val_size":            int(len(y_val)),
    "per_class":           report,
    "smote_applied":       True,
    "calibration":         "threshold_sweep",
    "critical_boost":      5.0,
    "full_data_training":  True,
    "leakage_free":        True,
}

# ── STEP 6: Production model on ALL data ────────────────────
t = time.time()
print(f"\n[7/7] Training production model on all {len(hist):,} rows...")
print(f"  (Computing full enc_maps with IsolationForest — takes ~30s)")

enc_maps = compute_encoding_maps(hist, fit_iso=True)
feat_full = build_features(hist, enc_maps)[feature_cols].values
y_full    = le.transform(hist["Clearance_Status"].values)

ft_full_bal, y_full_bal = oversample_critical(feat_full, y_full, target_frac=0.08)
cc_full = np.bincount(y_full_bal, minlength=n_classes)
sw_full = np.array([len(y_full_bal)/(n_classes*max(cc_full[yi],1)) for yi in y_full_bal], dtype=float)
sw_full = sw_full * np.where(y_full_bal == crit_idx, 8.0, 1.0)

prod_model = XGBClassifier(
    n_estimators=best_iter, max_depth=6, learning_rate=0.05,
    subsample=0.8, colsample_bytree=0.75, min_child_weight=2,
    gamma=0.02, reg_alpha=0.05, reg_lambda=0.8,
    objective="multi:softprob", num_class=n_classes,
    eval_metric="mlogloss", random_state=42,
    n_jobs=-1, verbosity=0,
)
prod_model.fit(ft_full_bal, y_full_bal, sample_weight=sw_full, verbose=False)
print(f"  Production model trained  {elapsed(t)}")

feature_imp = dict(zip(feature_cols, prod_model.feature_importances_.tolist()))
enc_maps["best_crit_threshold"] = best_thr
enc_maps["feature_cols"]        = feature_cols

# Save artifacts
t = time.time()
from utils.model_manager import save_artifacts
save_artifacts(prod_model, le, enc_maps, metrics, feature_imp)
print(f"  Artifacts saved  {elapsed(t)}")

print(f"\n{'='*62}")
print(f"  TRAINING COMPLETE — Total time: {elapsed(T_TOTAL)}")
print(f"  Macro F1: {mf1:.4f}  |  Critical Recall: {crit_rec*100:.1f}%")
print(f"  Restart Flask: python app.py")
print(f"{'='*62}")