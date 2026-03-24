# AI Product Verification Engineer Agent

AI-assisted verification workflow for commodity and legacy ICs.

The app can:
- extract requirements from a datasheet PDF
- generate a verification test plan
- generate an Arduino bench script
- run in simulation mode or hardware mode
- stream readings live to a dashboard
- compute SPC and follow-up tests
- generate a PDF report
- answer natural-language questions about the run

## Current Modes

### Simulation Mode
Uses a deterministic mock 7400-style device model to demonstrate the full pipeline, including anomalies, SPC, follow-up plans, and batch comparison.

### Hardware Mode
Flashes an Arduino sketch, drives the DUT inputs, reads output voltages over serial, and runs the same analysis pipeline on captured measurements.

## Stack
- Backend: FastAPI + Python
- Frontend: Next.js + TypeScript
- Bench control: Arduino Uno + serial streaming
- Report output: PDF generation

## Quick Start

### 1. Configure environment
Create `.env` from `.env.example` and set your Bedrock credentials.

### 2. Install backend dependencies
```bash
python -m pip install -r requirements.txt
```

### 3. Install frontend dependencies
```bash
cd frontend
npm install
```

### 4. Run backend
```bash
uvicorn backend.main:app --reload
```

### 5. Run frontend
```bash
cd frontend
npm run dev
```

## Repo Notes
- `.env`, logs, build output, `node_modules`, and generated Arduino files are ignored.
- Use `.env.example` as the public template.
- `ARCHITECTURE.md` is the living product/design reference.

## Product Direction
The strongest commercial direction for this project is not "replace all verification engineers". It is:

`AI-driven incoming inspection and adaptive screening for commodity and legacy ICs`

That means helping teams automatically screen purchased ICs, detect weak/counterfeit/drifting batches, and reduce manual datasheet-to-test work.
