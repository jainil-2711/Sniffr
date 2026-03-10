"""
app.py — SmartContainer Risk Engine v2.0
Auto-trains on startup. Upload CSV to predict.
"""

import json
import threading
import traceback
import pandas as pd
from pathlib import Path
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

# MongoDB — optional: if MONGO_URI not set, auth endpoints return 503
try:
    from utils.mongo import (
        login_user, get_user_from_token, logout_token,
        save_inspection, get_all_inspections,
        get_officer_inspections, get_container_status,
    )
    _mongo_available = True
except Exception as _mongo_err:
    _mongo_available = False
    print(f"[WARNING] MongoDB not available: {_mongo_err}")

import sys
sys.path.insert(0, str(Path(__file__).parent))

from core.feature_engineer import get_feature_cols
from core.trainer           import train
from core.predictor         import predict, compute_summary
from utils.model_manager    import (
    save_artifacts, load_artifacts,
    artifacts_exist, get_metrics, get_feature_importance
)

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})  # allow Live Server, Vite, and any other dev origin

HISTORICAL_CSV   = Path(__file__).parent / "data" / "Historical_Data.csv"
PREDICTIONS_PATH = Path(__file__).parent / "outputs" / "predictions_output.csv"
CONFIG_PATH      = Path(__file__).parent / "models" / "artifacts" / "model_config.json"
PREDICTIONS_PATH.parent.mkdir(exist_ok=True)

_predictions_store = {}
_train_status      = {"state": "idle", "message": "", "progress": 0}
_model_cache       = {}  # {"model":..., "label_enc":..., "enc_maps":...}

DEFAULT_CONFIG = {
    "n_estimators":              600,   # 600 + early_stop=30 is faster and equally good
    "max_depth":                 6,
    "learning_rate":             0.05,
    "val_split":                 0.20,
    "risk_threshold_critical":   0.15,   # 0.15 gives ~80% recall; overridden by threshold sweep
    "risk_threshold_low":        0.10,
}


def load_config():
    if CONFIG_PATH.exists():
        with open(CONFIG_PATH) as f:
            cfg = json.load(f)
        for k, v in DEFAULT_CONFIG.items():
            cfg.setdefault(k, v)
        return cfg
    return DEFAULT_CONFIG.copy()


def save_config(cfg):
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(CONFIG_PATH, "w") as f:
        json.dump(cfg, f, indent=2)


def do_train():
    global _train_status
    if not HISTORICAL_CSV.exists():
        _train_status = {"state": "error", "message": "Historical Data.csv not found", "progress": 0}
        return
    try:
        import io as _io, traceback as _tb
        _train_status = {"state": "training", "message": "Loading historical data...", "progress": 10}
        _raw   = HISTORICAL_CSV.read_text(encoding="utf-8", errors="replace").splitlines()
        _clean = [l for l in _raw if not l.startswith(("<<<",">>>","===","---","+++"))]
        hist   = pd.read_csv(_io.StringIO("\n".join(_clean)), low_memory=False)
        if "Clearance_Status" not in hist.columns:
            raise ValueError(f"Clearance_Status missing. Columns: {list(hist.columns)[:8]}")
        hist = hist[hist["Clearance_Status"].isin(["Clear","Low Risk","Critical"])].copy().reset_index(drop=True)
        print(f"[train] Loaded {len(hist):,} rows: {hist['Clearance_Status'].value_counts().to_dict()}")
        cfg = load_config()
        n_valid = int(len(hist)*cfg['val_split'])
        _train_status = {"state": "training", "message": f"Feature engineering + encoding ({len(hist):,} rows)...", "progress": 20}
        _train_status = {"state": "training", "message": f"Training XGBoost on {len(hist)-n_valid:,} rows (val={n_valid:,}), oversampling Critical class...", "progress": 35}
        model, label_enc, enc_maps, metrics, feature_imp = train(
            hist, get_feature_cols(),
            n_estimators=cfg["n_estimators"],
            max_depth=cfg["max_depth"],
            learning_rate=cfg["learning_rate"],
            val_split=cfg["val_split"],
        )
        _train_status = {"state": "training", "message": f"Saving artifacts — Macro F1: {metrics['macro_f1']:.4f}, Critical Recall: {metrics['recall_critical']*100:.1f}%...", "progress": 90}
        save_artifacts(model, label_enc, enc_maps, metrics, feature_imp)
        _train_status = {
            "state":    "ready",
            "message":  f"Ready — {metrics['train_size']:,} train / {metrics['val_size']:,} val. " \
                        f"Macro F1: {metrics['macro_f1']:.4f} | F1-Critical: {metrics['f1_critical']:.4f} | " \
                        f"Recall-Critical: {metrics['recall_critical']*100:.1f}% | " \
                        f"SMOTE: {'✓' if metrics.get('smote_applied') else '✗'} | Threshold: {metrics.get('best_crit_threshold', 'N/A')}",
            "progress": 100,
        }
    except Exception as e:
        import traceback as _tb2
        tb_str = _tb2.format_exc()
        print(f"[train ERROR] {tb_str}")
        _train_status = {"state": "error", "message": f"{type(e).__name__}: {e}", "trace": tb_str, "progress": 0}


# Auto-train on startup — run synchronously so errors surface immediately
if not artifacts_exist():
    print("[SmartRisk] No artifacts found — training now (synchronous)...")
    do_train()
    print(f"[SmartRisk] Training complete. Status: {_train_status['state']} — {_train_status['message']}")
else:
    _train_status = {"state": "ready", "message": "Model loaded from saved artifacts.", "progress": 100}
    print("[SmartRisk] Artifacts loaded. Ready.")


@app.route("/api/inject-threshold", methods=["POST"])
def inject_threshold():
    """
    Update best_crit_threshold in enc_maps + metrics without retraining.
    Useful for demo tuning. POST {"threshold": 0.15}
    """
    try:
        thr = float(request.json.get("threshold", 0.15))
        thr = max(0.05, min(0.50, thr))
        if not _model_cache:
            m_obj, le_obj, em_obj, _ = load_artifacts()
            _model_cache.update({"model": m_obj, "label_enc": le_obj, "enc_maps": em_obj})
        _model_cache["enc_maps"]["best_crit_threshold"] = thr
        m = get_metrics(); m["best_crit_threshold"] = thr
        fi = dict(get_feature_importance())
        save_artifacts(_model_cache["model"], _model_cache["label_enc"],
                       _model_cache["enc_maps"], m, fi)
        return jsonify({"success": True, "threshold": thr,
                        "message": f"Threshold updated to {thr}"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/debug-train")
def debug_train():
    """Run training synchronously and return full result + any error."""
    import traceback as tb
    try:
        do_train()
        return jsonify({"status": _train_status, "success": True})
    except Exception as e:
        return jsonify({"error": str(e), "trace": tb.format_exc(), "success": False}), 500


@app.route("/api/status")
def status():
    return jsonify({
        "status":        "online",
        "model_trained": artifacts_exist(),
        "train_status":  _train_status,
        "version":       "2.0.0",
    })


@app.route("/api/predict", methods=["POST"])
def predict_batch():
    global _predictions_store
    if not artifacts_exist():
        return jsonify({"error": "Model not ready. Please wait for training to complete."}), 400
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded."}), 400
    try:
        raw_df = pd.read_csv(request.files["file"])
        required = ["Container_ID", "Declared_Weight", "Measured_Weight", "Declared_Value", "Dwell_Time_Hours"]
        missing  = [c for c in required if c not in raw_df.columns]
        if missing:
            return jsonify({"error": f"Missing columns: {missing}"}), 400

        # If the upload includes Clearance_Status (ground-truth labels), hold it out
        # for accuracy reporting — never pass it into the feature pipeline.
        ground_truth = None
        if "Clearance_Status" in raw_df.columns:
            ground_truth = raw_df["Clearance_Status"].values
            raw_df = raw_df.drop(columns=["Clearance_Status"])

        model, label_enc, enc_maps, _ = load_artifacts()
        # Cache for inject-threshold endpoint
        _model_cache["model"]     = model
        _model_cache["label_enc"] = label_enc
        _model_cache["enc_maps"]  = enc_maps
        cfg    = load_config()
        output = predict(raw_df, model, label_enc, enc_maps, cfg)
        summary = compute_summary(output, raw_df)

        # If ground truth was provided, compute real accuracy metrics
        accuracy_report = None
        if ground_truth is not None:
            from sklearn.metrics import classification_report, confusion_matrix
            try:
                rep = classification_report(ground_truth, output["Risk_Level"].values, output_dict=True)
                cm  = confusion_matrix(ground_truth, output["Risk_Level"].values,
                                       labels=["Critical", "Low Risk", "Clear"])
                accuracy_report = {
                    "available":        True,
                    "per_class":        rep,
                    "confusion_matrix": cm.tolist(),
                    "classes":          ["Critical", "Low Risk", "Clear"],
                }
            except Exception:
                accuracy_report = {"available": False}

        output.to_csv(PREDICTIONS_PATH, index=False)
        _predictions_store = output.set_index("Container_ID").to_dict("index")

        # Enrich preview with original fields for display
        enriched = output.copy()
        for col in ["Origin_Country", "Declared_Value", "Declared_Weight",
                    "Measured_Weight", "Dwell_Time_Hours", "HS_Code",
                    "Trade_Regime (Import / Export / Transit)", "Importer_ID",
                    "Exporter_ID", "Destination_Port", "Destination_Country", "Shipping_Line"]:
            if col in raw_df.columns:
                enriched[col] = raw_df[col].values

        resp = {
            "success":     True,
            "summary":     summary,
            "predictions": enriched.to_dict("records"),
            "total_rows":  len(output),
        }
        if accuracy_report:
            resp["accuracy_report"] = accuracy_report
        return jsonify(resp)
    except Exception as e:
        return jsonify({"error": str(e), "trace": traceback.format_exc()}), 500


@app.route("/api/container/<container_id>")
def get_container(container_id):
    if not _predictions_store:
        return jsonify({"error": "No predictions loaded yet."}), 404
    # Try both string and int key
    row = _predictions_store.get(str(container_id)) or _predictions_store.get(int(container_id) if container_id.isdigit() else None)
    if not row:
        return jsonify({"error": f"Container {container_id} not found."}), 404
    return jsonify({"container_id": container_id, **row})


@app.route("/api/metrics")
def api_metrics():
    if not artifacts_exist():
        return jsonify({"error": "Model not trained."}), 400
    return jsonify(get_metrics())


@app.route("/api/feature-importance")
def api_feat_importance():
    if not artifacts_exist():
        return jsonify({"error": "Model not trained."}), 400
    fi = get_feature_importance()
    return jsonify([{"feature": k, "importance": round(v, 6)} for k, v in fi])


@app.route("/api/model-config", methods=["GET"])
def get_config():
    return jsonify(load_config())


@app.route("/api/model-config", methods=["POST"])
def update_config():
    global _train_status
    data = request.get_json() or {}
    cfg  = load_config()
    cfg.update({k: v for k, v in data.items() if k in DEFAULT_CONFIG})
    save_config(cfg)
    retrain_keys = {"n_estimators", "max_depth", "learning_rate", "val_split"}
    if any(k in data for k in retrain_keys):
        _train_status = {"state": "retraining", "message": "Retraining with new config...", "progress": 5}
        threading.Thread(target=do_train, daemon=True).start()
        return jsonify({"success": True, "retraining": True, "message": "Config saved. Retraining started."})
    return jsonify({"success": True, "retraining": False, "message": "Config saved."})


@app.route("/api/retrain", methods=["POST"])
def retrain():
    global _train_status
    _train_status = {"state": "retraining", "message": "Retraining...", "progress": 5}
    threading.Thread(target=do_train, daemon=True).start()
    return jsonify({"success": True})


@app.route("/api/download")
def download():
    if not PREDICTIONS_PATH.exists():
        return jsonify({"error": "No predictions available."}), 404
    return send_file(PREDICTIONS_PATH, mimetype="text/csv", as_attachment=True,
                     download_name="smartrisk_predictions.csv")


@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve(path):
    d = Path(__file__).parent.parent / "frontend" / "dist"
    if d.exists():
        t = d / path
        if t.exists() and t.is_file():
            return send_file(t)
        return send_file(d / "index.html")
    return jsonify({"message": "SmartContainer Risk Engine API v2.0"}), 200


# ── Auth helpers ─────────────────────────────────────────────────

def _require_auth(allowed_roles=None):
    """Extract token from Authorization header, return user or None."""
    if not _mongo_available:
        return None, ("MongoDB not configured.", 503)
    auth = request.headers.get("Authorization", "")
    token = auth.replace("Bearer ", "").strip()
    user  = get_user_from_token(token)
    if not user:
        return None, ("Unauthorized.", 401)
    if allowed_roles and user["role"] not in allowed_roles:
        return None, ("Forbidden: insufficient role.", 403)
    return user, None


# ── Auth endpoints ────────────────────────────────────────────────

@app.route("/api/auth/login", methods=["POST"])
def auth_login():
    if not _mongo_available:
        return jsonify({"error": "MongoDB not configured. Add MONGO_URI to .env"}), 503
    data = request.get_json() or {}
    officer_id = (data.get("officer_id") or "").strip().upper()
    password   = (data.get("password") or "").strip()
    role       = (data.get("role") or "").strip()
    if not officer_id or not password:
        return jsonify({"error": "Officer ID and password required."}), 400
    try:
        user, token = login_user(officer_id, password)
        # Optionally verify role matches what they selected
        if role and user["role"] != role:
            return jsonify({"error": f"Officer {officer_id} is not a {role.replace('_',' ')}."}), 403
        return jsonify({"success": True, "token": token, "user": user})
    except ValueError as e:
        return jsonify({"error": str(e)}), 401


@app.route("/api/auth/me", methods=["GET"])
def auth_me():
    user, err = _require_auth()
    if err:
        return jsonify({"error": err[0]}), err[1]
    return jsonify(user)


@app.route("/api/auth/logout", methods=["POST"])
def auth_logout():
    auth  = request.headers.get("Authorization", "")
    token = auth.replace("Bearer ", "").strip()
    if token and _mongo_available:
        logout_token(token)
    return jsonify({"success": True})


# ── Inspection endpoints ──────────────────────────────────────────

@app.route("/api/inspections", methods=["GET"])
def all_inspections():
    """Supervisor only — see all officer actions."""
    user, err = _require_auth(allowed_roles=["supervisor", "risk_analyst"])
    if err:
        return jsonify({"error": err[0]}), err[1]
    try:
        return jsonify(get_all_inspections(limit=1000))
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/inspections/mine", methods=["GET"])
def my_inspections():
    """Officer — see their own history."""
    user, err = _require_auth(allowed_roles=["customs_officer"])
    if err:
        return jsonify({"error": err[0]}), err[1]
    try:
        return jsonify(get_officer_inspections(user["officer_id"]))
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/container/<container_id>/action", methods=["POST"])
def container_action(container_id):
    """Officer records an inspection decision on a container."""
    user, err = _require_auth(allowed_roles=["customs_officer"])
    if err:
        return jsonify({"error": err[0]}), err[1]
    data = request.get_json() or {}
    action       = data.get("action", "inspected")       # claimed|inspected|cleared|detained|seized
    final_status = data.get("final_status", None)
    notes        = data.get("notes", "")
    allowed_actions = {"claimed", "inspected", "cleared", "detained", "seized"}
    if action not in allowed_actions:
        return jsonify({"error": f"Invalid action. Must be one of: {allowed_actions}"}), 400
    try:
        save_inspection(user["officer_id"], container_id, action, final_status, notes)
        return jsonify({"success": True, "container_id": container_id, "action": action})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/container/<container_id>/status", methods=["GET"])
def container_status(container_id):
    """Get the latest recorded inspection status for a container."""
    if not _mongo_available:
        return jsonify({"status": None})
    try:
        doc = get_container_status(container_id)
        return jsonify(doc or {"status": "pending"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    print("SmartContainer Risk Engine v2.0 → http://localhost:8000")
    app.run(debug=True, host="0.0.0.0", port=8000)