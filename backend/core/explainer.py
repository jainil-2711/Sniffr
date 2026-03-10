"""
explainer.py — v3
────────────────────────────────────────────────────────────
Human-readable explanation per container.
Rule-based + context-aware: no ML dependency, fully auditable.

v3: uses new features (origin tier, importer count, HS-relative value/kg,
    port dwell z-score, signed weight discrepancy, self-dealing flag).
"""

import pandas as pd
from typing import Dict


def explain(feat_row: pd.Series, raw_row: pd.Series, thresholds: Dict) -> str:
    flags = []

    wt = feat_row.get("weight_diff_pct", 0)
    flag_min = thresholds.get("weight_flag_min", 10.0)
    if wt > thresholds["weight_mismatch"]:
        signed = feat_row.get("weight_discrepancy_signed_pct", 0)
        direction = "under-declared" if signed < 0 else "over-declared"
        flags.append(
            f"Weight mismatch {wt:.1f}% ({direction}) — threshold {thresholds['weight_mismatch']:.1f}%"
        )
    elif wt > thresholds.get("weight_p75", 10):
        flags.append(f"Elevated weight mismatch {wt:.1f}%")

    dwell = raw_row.get("Dwell_Time_Hours", 0)
    dwell_port_z = feat_row.get("dwell_port_zscore", 0)
    if dwell > thresholds["dwell_time"]:
        port = raw_row.get("Destination_Port", "unknown")
        flags.append(
            f"Dwell time {dwell:.0f}h exceeds threshold {thresholds['dwell_time']:.0f}h "
            f"(port z-score: {dwell_port_z:.1f})"
        )
    elif dwell_port_z > 2.0:
        port = raw_row.get("Destination_Port", "unknown")
        flags.append(f"Dwell time unusually high vs {port} port average (z={dwell_port_z:.1f})")

    # HS-relative value/kg flag
    vpk_hs_z = feat_row.get("value_per_kg_hs_zscore", 0)
    vk = feat_row.get("value_per_kg", 0)
    if vpk_hs_z > 3.0:
        hs = raw_row.get("HS_Code", "")
        flags.append(
            f"Value/kg ${vk:,.0f} is {vpk_hs_z:.1f}σ above HS-{str(hs)[:2]} chapter average"
        )
    elif vk > thresholds["value_per_kg"]:
        flags.append(f"High value-to-weight ratio ${vk:,.0f}/kg")

    iso = feat_row.get("iso_anomaly_score", 0)
    if iso >= 0.75:
        flags.append(f"ML anomaly detector flagged strongly (score {iso:.2f})")
    elif iso >= 0.55:
        flags.append(f"Unusual pattern detected by anomaly model (score {iso:.2f})")

    # Origin risk tier
    tier = feat_row.get("origin_risk_tier", 0)
    origin_r = feat_row.get("origin_risk_score", 0)
    if tier >= 2 or origin_r > 0.03:
        country = raw_row.get("Origin_Country", "unknown")
        flags.append(f"High-risk origin country — {country} (historical rate {origin_r*100:.1f}%)")
    elif origin_r > 0.01:
        country = raw_row.get("Origin_Country", "unknown")
        flags.append(f"Elevated risk origin country ({country})")

    # Importer history
    imp_count = feat_row.get("importer_past_critical_count", 0)
    if imp_count > 0:
        import math
        raw_count = round(math.expm1(imp_count))
        flags.append(f"Importer has {raw_count} prior Critical shipment(s)")
    elif feat_row.get("importer_risk_score", 0) > 0.03:
        flags.append("Importer linked to prior Critical shipments")

    if feat_row.get("exporter_risk_score", 0) > 0.03:
        flags.append("Exporter linked to prior Critical shipments")

    if feat_row.get("dest_risk_score", 0) > 0.03:
        dest = raw_row.get("Destination_Country", "unknown")
        flags.append(f"High-risk destination country ({dest})")

    if feat_row.get("hs_code_risk_score", 0) > 0.03:
        hs = raw_row.get("HS_Code", "")
        flags.append(f"HS code {hs} associated with past inspections")
    elif feat_row.get("hs_chapter_risk_score", 0) > 0.03:
        hs = raw_row.get("HS_Code", "")
        flags.append(f"HS chapter ({str(hs)[:2]}) has elevated critical rate")

    if feat_row.get("same_importer_exporter", 0) == 1:
        flags.append("Importer and Exporter are same entity (self-dealing flag)")

    if feat_row.get("is_night_declaration", 0) == 1:
        flags.append("Declared outside business hours (night/early morning)")

    if raw_row.get("Declared_Value", 1) == 0:
        flags.append("Zero declared value")

    anomaly_s = feat_row.get("anomaly_score", 0)
    if anomaly_s >= 6:
        flags.append(f"Very high composite anomaly score ({int(anomaly_s)}/8)")
    elif anomaly_s >= 4:
        flags.append(f"High composite anomaly score ({int(anomaly_s)}/8)")

    if not flags:
        return "All indicators within normal range. No anomalies detected."

    return ". ".join(flags[:3]) + "."


def batch_explain(feat_df: pd.DataFrame, raw_df: pd.DataFrame, thresholds: Dict) -> list:
    explanations = []
    for i in range(len(feat_df)):
        explanations.append(explain(feat_df.iloc[i], raw_df.iloc[i], thresholds))
    return explanations