# Apply the final audit patch

From Terminal on macOS, assuming both folders are in `~/Downloads`:

```bash
cd ~/Downloads
rsync -av smart-scheduling-final-audit-patch/ smart-scheduling-deploy/
cd smart-scheduling-deploy/backend
```

Activate the same Apple-Silicon Python 3.11 environment you used previously, then regenerate data and retrain because the audited generator and model inputs changed:

```bash
source ~/Downloads/smart-scheduling-upgraded-source/backend/.venv/bin/activate
python data/generate.py
python train.py
```

Copying source code without retraining is not sufficient. `best_model.joblib`, `preprocessor.joblib`, and `benchmark_results.json` must all come from this new audited training run.

Then test backend:

```bash
python -m uvicorn main:app --reload --port 8000
```

In a second Terminal:

```bash
cd ~/Downloads/smart-scheduling-deploy/frontend
npm install
npm run build
```

After verifying localhost, stage the regenerated datasets/model artifacts and source changes, commit, and push.
