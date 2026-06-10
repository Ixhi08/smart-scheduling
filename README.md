# Smart Scheduling — AI-Powered Healthcare Appointment Predictor

A full-stack ML system that predicts appointment durations and simulates clinic scheduling efficiency.

**Built with:** React + TypeScript · FastAPI · scikit-learn · XGBoost · Recharts

---

## What it does

- **Predict** — Enter a patient's visit type, age, insurance, and other factors to get an AI-predicted appointment duration with confidence interval
- **Model Comparison** — Benchmark results for Random Forest, XGBoost, KNN, and Neural Network (MAE, RMSE, R²)
- **Clinic Simulation** — Discrete-event simulation comparing fixed 20-minute slots vs AI-predicted slots across a full clinic day

---

## Setup

### 1. Backend (FastAPI + ML)

```bash
cd backend
pip install -r requirements.txt

# Generate dataset + train models (only needed once)
python data/generate.py
python train.py

# Start API server
uvicorn main:app --reload --port 8000
```

The API will be live at `http://localhost:8000`.  
Interactive docs: `http://localhost:8000/docs`

### 2. Frontend (React)

```bash
cd frontend
npm install
npm start
```

Frontend runs at `http://localhost:3000`.

---

## Deploying

**Backend:** Deploy to [Render](https://render.com) or [Railway](https://railway.app) as a Python web service.  
Set start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

**Frontend:** Deploy to [Vercel](https://vercel.com). Set environment variable:  
`REACT_APP_API_URL=https://your-backend-url.com`

---

## Model Performance (test set, n=400)

| Model          | MAE (min) | RMSE (min) | R²    |
|----------------|-----------|------------|-------|
| Neural Network | **3.74**  | **4.93**   | **0.825** |
| Random Forest  | 3.99      | 5.35       | 0.794 |
| XGBoost        | 4.02      | 5.32       | 0.796 |
| KNN            | 4.62      | 6.24       | 0.719 |

Neural Network deployed. Average prediction error: **±3.74 minutes**.

---

## Dataset

2,000 synthetic patient records generated from published primary care appointment duration distributions (Tai-Seale et al., 2017, JAMA Internal Medicine). Features: visit type (15 categories), patient age, insurance type, provider type, day of week, number of chronic conditions, first visit flag, late arrival minutes.

---

## Project structure

```
smart-scheduling/
├── backend/
│   ├── data/
│   │   ├── generate.py          # Synthetic dataset generator
│   │   └── smart_scheduling_data.csv
│   ├── models/
│   │   ├── best_model.joblib    # Trained Neural Network
│   │   ├── preprocessor.joblib
│   │   └── benchmark_results.json
│   ├── main.py                  # FastAPI endpoints
│   ├── train.py                 # Training pipeline
│   ├── simulate.py              # Clinic simulation engine
│   └── requirements.txt
└── frontend/
    └── src/
        ├── pages/
        │   ├── PredictPage.tsx
        │   ├── BenchmarkPage.tsx
        │   └── SimulatePage.tsx
        ├── components/Nav.tsx
        ├── types/index.ts
        ├── api.ts
        └── App.tsx
```
