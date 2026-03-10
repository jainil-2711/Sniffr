# SmartContainer Risk Engine

**AI/ML Container Inspection Prioritisation System**  
XGBoost · Flask REST API · React Dashboard · Docker-ready

---

## 1. Problem Understanding

Ports process thousands of containers daily. Traditional rule-based screening:
- Misses hidden irregularities that don't fit static rules
- Generates unnecessary inspections (false positives drain resources)
- Fails to adapt as trade patterns shift over time

**This system** replaces static rules with a trained ML model that learns historical risk patterns and scores every incoming container 0–100 in real time — giving port officers a ranked, explainable inspection queue.

**Dataset:** 45,519 historical shipments (Jan–Sep 2020) across 93 origin countries, 2,438 HS codes, 13,676 unique importers.  
**Class distribution:** Critical 1.04% · Low Risk 20.5% · Clear 78.4% — heavily imbalanced, requiring explicit handling.

---

## 2. Approach and Methodology

### Pipeline Overview

```
Historical CSV
      │
      ▼
 Train/Val Split (80/20, stratified)   ← split BEFORE encoding to prevent leakage
      │
      ├─► Train fold → compute_encoding_maps()  ← risk rates derived here only
      │
      ├─► build_features(train, enc_maps)
      ├─► build_features(val,   enc_maps)        ← val uses train-derived maps only
      │
      ▼
 XGBoost (multi:softprob, 600 trees, early stopping)
      │
      ▼
 Hybrid Risk Score (0–100) + Risk Level + Explanation
```

### Leakage Prevention
Encoding maps (importer risk scores, HS code risk rates, exporter risk scores, etc.) are computed **exclusively on the training fold**. Validation rows are encoded using maps that have never seen their labels — matching real-world deployment where the model has no knowledge of incoming shipment outcomes.

### Class Imbalance Handling
Per-sample weights inversely proportional to class frequency. Critical containers receive ~78× the weight of Clear containers, forcing the model to prioritise recall on the rare but high-stakes class.

### Hybrid Risk Score
Raw XGBoost probabilities collapse near 0 or 1 at high accuracy. A 6-component weighted composite prevents binary score clustering:

| Component | Weight | Signal |
|---|---|---|
| Model log-odds | 40% | Stretched ML probability |
| Weight mismatch | 20% | Declared vs measured kg diff |
| Value anomaly | 15% | Value z-score + zero-value flag |
| Dwell time | 10% | Excess port dwell |
| Entity risk | 10% | Origin + importer historical rate |
| Composite anomaly | 5% | Count of triggered anomaly flags |

---

## 3. Model Design

### Feature Engineering (16 features)

| # | Feature | Description |
|---|---|---|
| 1 | `weight_diff_pct` | % difference between declared and measured weight |
| 2 | `weight_diff_abs` | Absolute kg difference |
| 3 | `value_per_kg` | Declared value ÷ weight (detects high-value smuggling) |
| 4 | `value_zscore` | Declared value deviation from batch mean |
| 5 | `dwell_zscore` | Dwell time deviation from batch mean |
| 6 | `Dwell_Time_Hours` | Raw dwell time (Critical avg: 88.7h vs Clear: 40.5h) |
| 7 | `is_night_declaration` | Declared 10pm–5am (33% of all shipments) |
| 8 | `is_weekend` | Declared on Saturday/Sunday |
| 9 | `origin_risk_score` | Historical Critical rate by origin country |
| 10 | `importer_risk_score` | Historical Critical rate by importer ID |
| 11 | `exporter_risk_score` | Historical Critical rate by exporter ID (NEW) |
| 12 | `shipping_line_risk_score` | Historical Critical rate by shipping line (NEW) |
| 13 | `hs_code_risk_score` | Historical Critical rate by HS code |
| 14 | `hs_code_frequency` | HS code rarity (rare codes = more suspicious) |
| 15 | `is_transit` | Trade regime = Transit flag |
| 16 | `anomaly_score` | Composite count of triggered anomaly flags (0–6) |

All entity risk scores use **IQR-based thresholds** from training data only. Unseen entities fall back to the overall historical Critical rate (~1.04%).

### Anomaly Detection (Rule-based, independent of ML)

Six anomaly flags, each contributing +1 to composite score (0–6):
- Weight mismatch > IQR threshold (~9.4%)
- Dwell time > IQR threshold (~100h)
- Value/kg > 95th percentile
- Night-time declaration
- Zero declared value
- Exporter flagged as high-risk (historical rate > 5%)

**Anomaly_Flag = 1** when composite score ≥ 2. Fully auditable, no ML dependency.

### Explainability

Every container receives a 1–3 line plain-English explanation:
```
Weight mismatch 24.3% exceeds threshold 9.4%. Exporter X3K9P2 has elevated 
Critical shipment history. High-risk origin country (CN).
```
Every sentence maps to a specific, verifiable condition — no black-box reasoning.

---

## 4. Key Findings and Insights

**Dwell time is the strongest operational signal**  
Critical containers dwell an average of **88.7 hours** vs 40.5 hours for Clear (2.2× difference). Containers exceeding ~100h have a 14× elevated inspection rate.

**Weight mismatch is highly discriminatory**  
Containers with >15% weight discrepancy (5.3% of shipments) have a **14.0% Critical rate** — 13.5× the baseline rate.

**Exporter identity is underutilised in traditional systems**  
297 exporters have >10% historical Critical rate. 83.1% of real-time exporters appear in historical data, making this a reliable signal.

**Geographic concentration**  
CN accounts for 50.9% of shipments and 65.9% of Critical cases. DE has the highest Critical rate among high-volume origins at 1.8%.

**HS code patterns reveal commodity risk**  
6 HS codes have a 100% historical Critical rate. 10 codes exceed 50% — these commodity types warrant automatic elevated scrutiny regardless of other signals.

**Night declarations: weaker than expected**  
33.3% of all shipments are declared at night, but the Critical rate is actually *lower* at night (0.96% vs 1.07% daytime). The model correctly assigns low weight to this feature.

---

## 5. Working Demo

### Environment Setup

Create a `.env` file in the **backend directory** and paste the following configuration:

```env
MONGO_URI=mongodb+srv://db_user:smartrisk@smartrisk.3amckfd.mongodb.net/smartrisk?retryWrites=true&w=majority&appName=SmartRisk
MONGO_DB=smartrisk
SECRET_KEY=smartrisk-dev-secret-2026
ANTHROPIC_API_KEY=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
```

### Quick Start (Local)

```bash
# Backend
cd backend
pip install -r requirements.txt
python app.py        # → http://localhost:8000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev          # → http://localhost:3000
```

### Quick Start (Docker)

```bash
docker-compose up --build
# Backend  → http://localhost:8000
# Frontend → http://localhost:3000
```

### Usage Flow

1. App auto-trains on `Historical_Data.csv` at startup (progress bar visible)
2. Upload `Real-Time_Data.csv` via drag-and-drop
3. Click **Run Analysis**
4. **Overview tab**: Donut chart, score distribution, critical container list
5. **Results tab**: Paginated full table with filter/search across all containers
6. **Track tab**: Look up any individual container by ID
7. **Model tab**: Feature importance, per-class metrics, leakage-free badge
8. **Config tab**: Tune thresholds and hyperparameters live

> If the uploaded CSV contains a `Clearance_Status` column, the system detects ground truth labels and displays real-world accuracy automatically in the Overview tab.

---

### Output Format (`predictions_output.csv`)

| Column | Description |
|---|---|
| `Container_ID` | Unique shipment identifier |
| `Risk_Score` | 0–100 |
| `Risk_Level` | Critical / Low Risk / Clear |
| `Anomaly_Flag` | 1 if composite anomaly score ≥ 2 |
| `Anomaly_Score` | Raw composite count (0–6) |
| `P_Critical` | Model probability of Critical class (%) |
| `Weight_Diff_Pct` | Weight mismatch % |
| `Explanation_Summary` | 1–3 line plain-English reason |

---

## Project Structure

```
SmartRisk/
├── backend/
│   ├── app.py
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── check_dependencies.py
│   ├── db_setup.py
│   ├── train_now.py
│   ├── data/
│   │   └── Historical_Data.csv
│   ├── core/
│   │   ├── feature_engineer.py
│   │   ├── trainer.py
│   │   ├── predictor.py
│   │   └── explainer.py
│   ├── utils/
│   │   ├── mongo.py
│   │   └── model_manager.py
│   └── models/artifacts/           ← saved model files (auto-created)
├── frontend/
│   ├── App.jsx
│   ├── index.html
│   ├── main.jsx
│   ├── package-lock.json
│   ├── vite.config.js
│   └── package.json
├── Real-Time_Data.csv
├── docker-compose.yml
└── README.md
```

## Requirements

```
flask>=3.0.0
flask-cors>=4.0.0
pandas>=2.0.0
numpy>=1.24.0
scikit-learn>=1.3.0
xgboost>=2.0.0
joblib>=1.3.0
pymongo>=4.6.0
dnspython>=2.4.0
python-dotenv>=1.0.0
requests>=2.31.0
imbalanced-learn>=0.11.0
```
