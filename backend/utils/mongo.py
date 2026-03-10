"""
mongo.py — MongoDB Atlas connection + auth helpers
Simple plaintext passwords (demo only).
"""

import os
import ssl
import uuid
import datetime
from pathlib import Path
from dotenv import load_dotenv
from pymongo import MongoClient, ASCENDING, DESCENDING

load_dotenv(Path(__file__).parent.parent / ".env")

_client = None
_db     = None


def get_db():
    global _client, _db
    if _db is not None:
        return _db
    uri = os.getenv("MONGO_URI", "")
    db_name = os.getenv("MONGO_DB", "smartrisk")
    if not uri:
        raise RuntimeError("MONGO_URI not set in .env")

    # Force-disable TLS verification — fixes Python 3.14 / Windows SSL error
    _client = MongoClient(
        uri,
        serverSelectionTimeoutMS=15000,
        tls=True,
        tlsAllowInvalidCertificates=True,
        tlsAllowInvalidHostnames=True,
    )

    _client.admin.command("ping")   # raises if unreachable
    _db = _client[db_name]

    # Ensure indexes
    _db.users.create_index("officer_id", unique=True)
    _db.sessions.create_index("token", unique=True)
    _db.sessions.create_index("expires_at", expireAfterSeconds=0)
    _db.inspections.create_index([("container_id", ASCENDING)])
    _db.inspections.create_index([("officer_id", ASCENDING)])
    _db.inspections.create_index([("timestamp", DESCENDING)])

    return _db


# ── Auth helpers ────────────────────────────────────────────────

def login_user(officer_id: str, password: str):
    db   = get_db()
    user = db.users.find_one({"officer_id": officer_id})
    if not user:
        raise ValueError("Officer ID not found.")
    if user["password"] != password:
        raise ValueError("Incorrect password.")
    token = str(uuid.uuid4())
    db.sessions.insert_one({
        "token":      token,
        "officer_id": officer_id,
        "role":       user["role"],
        "expires_at": datetime.datetime.utcnow() + datetime.timedelta(hours=12),
    })
    return {
        "officer_id": user["officer_id"],
        "name":       user["name"],
        "role":       user["role"],
        "shift":      user.get("shift", ""),
    }, token


def get_user_from_token(token: str):
    if not token:
        return None
    db  = get_db()
    ses = db.sessions.find_one({
        "token":      token,
        "expires_at": {"$gt": datetime.datetime.utcnow()},
    })
    if not ses:
        return None
    user = db.users.find_one({"officer_id": ses["officer_id"]})
    if not user:
        return None
    return {
        "officer_id": user["officer_id"],
        "name":       user["name"],
        "role":       user["role"],
        "shift":      user.get("shift", ""),
    }


def logout_token(token: str):
    get_db().sessions.delete_one({"token": token})


# ── Inspection helpers ───────────────────────────────────────────

def save_inspection(officer_id: str, container_id: str, action: str,
                    final_status: str = None, notes: str = ""):
    db  = get_db()
    now = datetime.datetime.utcnow()
    db.inspections.update_one(
        {"container_id": str(container_id), "officer_id": officer_id},
        {"$set": {
            "action":       action,
            "final_status": final_status,
            "notes":        notes,
            "timestamp":    now,
        }, "$setOnInsert": {"created_at": now}},
        upsert=True,
    )


def get_all_inspections(limit: int = 500):
    db   = get_db()
    docs = list(db.inspections.find({}, {"_id": 0}).sort("timestamp", DESCENDING).limit(limit))
    for d in docs:
        d["timestamp"] = d["timestamp"].isoformat() if d.get("timestamp") else None
    return docs


def get_officer_inspections(officer_id: str):
    db   = get_db()
    docs = list(db.inspections.find({"officer_id": officer_id}, {"_id": 0}).sort("timestamp", DESCENDING))
    for d in docs:
        d["timestamp"] = d["timestamp"].isoformat() if d.get("timestamp") else None
    return docs


def get_container_status(container_id: str):
    db  = get_db()
    doc = db.inspections.find_one(
        {"container_id": str(container_id)},
        {"_id": 0},
        sort=[("timestamp", DESCENDING)],
    )
    if doc and doc.get("timestamp"):
        doc["timestamp"] = doc["timestamp"].isoformat()
    return doc