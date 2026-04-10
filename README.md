# TechnoElevate — Operations Platform

Full-stack operations dashboard for staffing/professional services delivery management.

## Stack
- **Frontend**: React 18 + Vite + Recharts (port 3000)
- **Backend**: Node.js + Express (port 4000)
- **Database**: PostgreSQL (port 5433)

## Quick Start

### 1. Configure DB password
Edit `backend/.env` — set `DB_PASSWORD` to your postgres password.

### 2. Create & seed database
```bash
cd backend
node seed.js
```

### 3. Start backend
```bash
cd backend
node server.js
```

### 4. Start frontend
```bash
cd frontend
npm run dev
```

Open **http://localhost:3000**

## Features
- **Attention Engine** — AI-prioritized critical issues (HIGH/MED/LOW) with one-click actions
- **Talent Lifecycle** — Bench → In Process → Interviewing → Offered → Deployed with real counts
- **Bench Idle Chart** — 4-week trend bar chart
- **Pipeline Kanban** — 6-stage requirement kanban with stall detection
- **Managed Services** — Project cards with blocking issue callouts
- **Contracts Panel** — SOW expiry, overdue invoices, utilization bars
- **Engagement Checklist** — 7-stage compliance tracking per deployment
- **Health Metrics** — Win rate, time-to-submit, revenue at risk, bench cost

## API Endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/attention | Priority issues |
| PATCH | /api/attention/:id/resolve | Resolve issue |
| GET | /api/talent/lifecycle | Talent counts + bench data |
| GET | /api/pipeline | Requirements pipeline |
| PATCH | /api/pipeline/:id/stage | Advance req stage |
| GET | /api/projects | Managed services projects |
| PATCH | /api/projects/:id/resolve | Resolve blocking issue |
| GET | /api/contracts | Contracts & SOWs |
| GET | /api/engagements | Engagement checklists |
| PATCH | /api/engagements/checklist/:id/complete | Mark item complete |
| GET | /api/health | Health metrics |
