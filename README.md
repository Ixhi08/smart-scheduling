# Smart Scheduling

AI-powered healthcare appointment duration predictor and clinic scheduling optimizer.

Built over ~2 years as an independent research project — started as a Bayesian prototype, rebuilt as a full-stack ML system with a discrete-event simulation engine and production web interface.

**Live demo:** (https://smart-scheduling-app.vercel.app/)

---

## What it does

Healthcare clinics default to fixed appointment slots (usually 20 minutes) regardless of visit complexity. This wastes time for simple visits and rushes complex ones, causing cascading delays across the clinic day.

Smart Scheduling predicts how long an appointment will actually take — based on visit type, patient age, insurance, provider, day of week, chronic conditions, and first-visit status — and generates an optimized clinic schedule from those predictions.

**Results on simulated clinic days:**

| Metric | Fixed scheduling | AI scheduling |
|---|---|---|
| Daily overtime | ~130 min | ~30 min |
| Overtime reduction | — | **~77%** |
| Avg prediction error | — | **±3.74 min** |
| Variance explained (R²) | — | **0.825** |

---

## Model comparison

Four models trained and benchmarked on 2,000 patient records (80/20 train/test split):

| Model | MAE (min) | RMSE (min) | R² |
|---|---|---|---|
| **Neural Network** | **3.74** | **4.93** | **0.825** |
| Random Forest | 3.99 | 5.35 | 0.794 |
| XGBoost | 3.99 | 5.28 | 0.800 |
| KNN | 4.62 | 6.25 | 0.719 |

Neural Network deployed. Features: visit type (15 categories), age, insurance type, provider type, day of week, chronic condition count, first-visit flag, late arrival minutes.

---

## Stack

**Backend:** FastAPI · scikit-learn · XGBoost · NumPy · Pandas · Joblib  
**Frontend:** React · TypeScript · Recharts · Lucide  
**Deployment:** Vercel (frontend) · Render (backend)

---

## Setup

### Backend

```bash
cd backend
pip3 install -r requirements.txt

# First time only — generates dataset and trains all 4 models
python3 data/generate.py
python3 train.py

# Start API
uvicorn main:app --reload --port 8000
```

API runs at `http://localhost:8000`. Interactive docs at `http://localhost:8000/docs`.

### Frontend

```bash
cd frontend
npm install
npm start
```

Frontend runs at `http://localhost:3000`. Set `REACT_APP_API_URL` to your backend URL for deployment.

---

## API endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/predict` | Predict duration for one patient |
| `GET` | `/benchmark` | Model comparison results |
| `POST` | `/simulate` | Full clinic day simulation |
| `GET` | `/visit-types` | Valid input values for dropdowns |

---

## Project structure

```
smart-scheduling/
├── backend/
│   ├── data/generate.py          # Synthetic dataset generator
│   ├── models/                   # Trained model + benchmark results
│   ├── main.py                   # FastAPI endpoints
│   ├── train.py                  # Training pipeline (4 models)
│   └── simulate.py               # Discrete-event clinic simulation
└── frontend/
    └── src/
        ├── pages/
        │   ├── PredictPage.tsx   # Patient intake + prediction
        │   ├── BenchmarkPage.tsx # Model comparison charts
        │   └── SimulatePage.tsx  # Clinic day simulation
        ├── api.ts
        └── types/index.ts
```

---

## Dataset

2,000 synthetic records generated from published primary care appointment duration distributions (Tai-Seale et al., 2017, *JAMA Internal Medicine*). Synthetic data was used due to HIPAA constraints on real patient records — distributions, age effects, insurance multipliers, and provider type effects are grounded in published literature.

---

## Background

This project started in 10th grade as a Bayesian prototype with a simple symptom dataset. In 11th grade it was rebuilt with supervised ML, a multi-model benchmark, a discrete-event simulation, and a full-stack web interface.
