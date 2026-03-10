<<<<<<< HEAD
"""
Run this script first: python check_dependencies.py
It will tell you exactly what to install.
"""
import subprocess, sys

required = {
    "flask":       "flask==3.0.3",
    "flask_cors":  "flask-cors==4.0.1",
    "pandas":      "pandas==2.2.2",
    "numpy":       "numpy==1.26.4",
    "sklearn":     "scikit-learn==1.4.2",
    "xgboost":     "xgboost==2.0.3",
    "joblib":      "joblib==1.4.2",
}

missing = []
for mod, pkg in required.items():
    try:
        __import__(mod)
        print(f"  OK  {mod}")
    except ImportError:
        print(f"  MISSING  {mod}  ({pkg})")
        missing.append(pkg)

if missing:
    print(f"\n{len(missing)} package(s) missing. Run this command:\n")
    print(f"  {sys.executable} -m pip install {' '.join(missing)}")
    print()
    # Offer to install automatically
    answer = input("Install now? (y/n): ").strip().lower()
    if answer == 'y':
        subprocess.check_call([sys.executable, "-m", "pip", "install"] + missing)
        print("\nDone. Now run: python app.py")
else:
=======
"""
Run this script first: python check_dependencies.py
It will tell you exactly what to install.
"""
import subprocess, sys

required = {
    "flask":       "flask==3.0.3",
    "flask_cors":  "flask-cors==4.0.1",
    "pandas":      "pandas==2.2.2",
    "numpy":       "numpy==1.26.4",
    "sklearn":     "scikit-learn==1.4.2",
    "xgboost":     "xgboost==2.0.3",
    "joblib":      "joblib==1.4.2",
}

missing = []
for mod, pkg in required.items():
    try:
        __import__(mod)
        print(f"  OK  {mod}")
    except ImportError:
        print(f"  MISSING  {mod}  ({pkg})")
        missing.append(pkg)

if missing:
    print(f"\n{len(missing)} package(s) missing. Run this command:\n")
    print(f"  {sys.executable} -m pip install {' '.join(missing)}")
    print()
    # Offer to install automatically
    answer = input("Install now? (y/n): ").strip().lower()
    if answer == 'y':
        subprocess.check_call([sys.executable, "-m", "pip", "install"] + missing)
        print("\nDone. Now run: python app.py")
else:
>>>>>>> 13699a5bf869325a4d8f4661f1e216b6b5bd997e
    print("\nAll dependencies OK. Run: python app.py")