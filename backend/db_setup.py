"""
db_setup.py — Seed MongoDB with demo users.
Run once: python db_setup.py

Demo credentials:
  OFF-001 / pass123  → Supervisor      (S. Patel)
  OFF-002 / pass123  → Customs Officer (K. Mehta)
  OFF-003 / pass123  → Customs Officer (J. Singh)
  OFF-004 / pass123  → Risk Analyst    (R. Agarwal)
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from utils.mongo import get_db

DEMO_USERS = [
    {
        "officer_id": "OFF-001",
        "password":   "pass123",
        "name":       "S. Patel",
        "role":       "supervisor",
        "shift":      "Alpha Dock",
    },
    {
        "officer_id": "OFF-002",
        "password":   "pass123",
        "name":       "K. Mehta",
        "role":       "customs_officer",
        "shift":      "Alpha Dock",
    },
    {
        "officer_id": "OFF-003",
        "password":   "pass123",
        "name":       "J. Singh",
        "role":       "customs_officer",
        "shift":      "Alpha Dock",
    },
    {
        "officer_id": "OFF-004",
        "password":   "pass123",
        "name":       "R. Agarwal",
        "role":       "risk_analyst",
        "shift":      "Alpha Dock",
    }
]

if __name__ == "__main__":
    print("Connecting to MongoDB Atlas...")
    try:
        db = get_db()
        print(f"Connected to database: {db.name}")
    except Exception as e:
        print(f"Connection failed: {e}")
        print("Make sure your .env file has the correct MONGO_URI.")
        sys.exit(1)

    # Clear existing users + sessions
    db.users.delete_many({})
    db.sessions.delete_many({})
    print("Cleared existing users and sessions.")

    # Insert demo users
    db.users.insert_many(DEMO_USERS)
    print(f"\nSeeded {len(DEMO_USERS)} demo users:\n")
    for u in DEMO_USERS:
        print(f"  {u['officer_id']} / {u['password']}  →  {u['role'].replace('_', ' ').title()}  ({u['name']})")

    print("\nDone. You can now start the backend: python app.py")