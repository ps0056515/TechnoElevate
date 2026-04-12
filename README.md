# TechnoElevate — Operations Platform

Full-stack operations dashboard for staffing and professional services delivery management. Centralises talent pipeline, requirements, managed-services projects, contracts/SOWs, engagement compliance checklists, and real-time KPI health metrics in a single interface.

---

## Table of Contents

- [Stack](#stack)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [Features](#features)
- [API Endpoints](#api-endpoints)
- [Database Schema](#database-schema)
- [Demo Credentials](#demo-credentials)
- [Documentation](#documentation)

---

## Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18 + Vite + Recharts (dev port **3000**) |
| **Backend** | Node.js + Express (port **4000**) |
| **Database** | PostgreSQL (default port **5432**) |

---

## Quick Start

### Prerequisites
- Node.js ≥ 18
- PostgreSQL ≥ 14

### 1. Clone the repo

```bash
git clone <repo-url>
cd TechnoElevate-git
```

### 2. Configure environment

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` and set at minimum your `DB_PASSWORD`. See [Environment Variables](#environment-variables) for all options.

### 3. Install dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 4. Create & seed the database

```bash
cd backend
node seed.js
```

This creates the `techno_elevate` database (if it does not exist), applies the schema, and inserts demo data.

### 5. Start the backend

```bash
cd backend
npm run dev       # nodemon (auto-reload)
# or
npm start         # plain node
```

### 6. Start the frontend

```bash
cd frontend
npm run dev
```

Open **http://localhost:3000**

---

## Environment Variables

Create `backend/.env` (copy from `backend/.env.example`):

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4000` | Express server port |
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_NAME` | `techno_elevate` | Database name |
| `DB_USER` | `postgres` | Database user |
| `DB_PASSWORD` | `postgres` | Database password |

---

## Project Structure

```
TechnoElevate-git/
├── backend/
│   ├── db.js               # PostgreSQL connection pool (pg)
│   ├── server.js           # Express app entry point
│   ├── routes/
│   │   └── dashboard.js    # All API route handlers
│   ├── schema.sql          # PostgreSQL DDL
│   ├── seed.js             # DB setup + demo data
│   ├── .env.example        # Environment variable template
│   └── package.json
├── frontend/
│   ├── index.html
│   ├── vite.config.js      # Dev server + /api proxy → :4000
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx         # Auth gate + navigation routing
│   │   ├── ThemeContext.jsx
│   │   ├── styles/
│   │   │   └── globals.css
│   │   └── components/
│   │       ├── LoginPage.jsx
│   │       ├── Sidebar.jsx
│   │       ├── DashboardOverview.jsx
│   │       ├── AttentionEngine.jsx
│   │       ├── TalentLifecycle.jsx
│   │       ├── Pipeline.jsx
│   │       ├── ManagedServices.jsx
│   │       ├── ContractsPanel.jsx
│   │       ├── EngagementChecklist.jsx
│   │       ├── HealthMetrics.jsx
│   │       ├── LeadsPage.jsx
│   │       ├── RequirementsPage.jsx
│   │       ├── ProjectsPage.jsx
│   │       ├── TalentPage.jsx
│   │       ├── ContractsPage.jsx
│   │       ├── AdminPage.jsx
│   │       ├── SettingsPage.jsx
│   │       └── admin/
│   │           ├── AdminModal.jsx
│   │           ├── AdminTable.jsx
│   │           ├── FormField.jsx
│   │           ├── TalentAdmin.jsx
│   │           ├── RequirementsAdmin.jsx
│   │           ├── ProjectsAdmin.jsx
│   │           ├── ContractsAdmin.jsx
│   │           ├── AttentionAdmin.jsx
│   │           └── HealthAdmin.jsx
│   └── package.json
├── docs/
│   ├── API_REFERENCE.md
│   ├── ARCHITECTURE.md
│   ├── SETUP_GUIDE.md
│   ├── DEPLOYMENT.md
│   ├── USER_MANUAL.md
│   ├── RFP_TEMPLATE.md
│   ├── CASE_STUDIES.md
│   └── COMPETITIVE_ANALYSIS.md
├── CONTRIBUTING.md
├── CHANGELOG.md
└── README.md
```

---

## Features

| Feature | Description |
|---------|-------------|
| **Attention Engine** | Priority-sorted critical issues (HIGH / MED / LOW) with one-click resolution |
| **Talent Lifecycle** | Bench → In Process → Interviewing → Offered → Deployed funnel with live counts |
| **Bench Idle Chart** | 4-week trend bar chart showing idle hours |
| **Pipeline Kanban** | 6-stage requirement kanban (Intake → Sourcing → Submission → Screening → Interviewing → Closure) with stall detection |
| **Managed Services** | Project cards showing health stage (Green / At Risk / Blocked / Completed) with blocking-issue callouts |
| **Contracts Panel** | SOW expiry tracking, overdue invoices, utilisation bars, days-remaining countdown |
| **Engagement Checklist** | 7-stage compliance tracking per active deployment |
| **Health Metrics** | Win rate, time-to-submit, revenue at risk, bench cost KPIs |
| **Leads** | CRM-style lead tracking with stage pipeline |
| **Admin Panel** | Full CRUD for talent, requirements, projects, contracts, attention issues, and health KPIs |
| **Multi-theme** | Light / dark and accent-colour theming via ThemeContext |

---

## API Endpoints

### System

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/ping` | Health check — returns `{ status, timestamp }` |

### Attention Engine

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/attention` | All unresolved attention issues, ordered by priority then staleness |
| PATCH | `/api/attention/:id/resolve` | Mark an attention issue as resolved |

### Talent

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/talent/lifecycle` | Status counts, bench idle weekly rows, full talent list |
| PATCH | `/api/talent/:id/status` | Update a talent record's status `{ status }` |

### Requirements Pipeline

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/pipeline` | All requirements ordered by priority and staleness |
| PATCH | `/api/pipeline/:id/stage` | Advance a requirement to a new stage `{ stage }` |

### Projects (Managed Services)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/projects` | All projects ordered by health stage severity |
| PATCH | `/api/projects/:id/resolve` | Clear blocking issue, set stage to `green` |

### Contracts

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/contracts` | All contracts with computed `days_remaining` |

### Engagements & Checklist

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/engagements` | `{ engagements, checklistItems }` |
| PATCH | `/api/engagements/checklist/:id/complete` | Mark a checklist item complete |

### Health Metrics

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | All KPI health metric rows |
| PUT | `/api/health/:id` | Update a metric value `{ metric_value }` |

### Admin CRUD

All admin routes require no authentication in the current build (demo). Protect behind auth middleware before production use.

| Resource | GET list | POST create | PUT update | DELETE |
|----------|----------|-------------|------------|--------|
| **Talent** | `GET /api/admin/talent` | `POST /api/admin/talent` | `PUT /api/admin/talent/:id` | `DELETE /api/admin/talent/:id` |
| **Requirements** | `GET /api/admin/requirements` | `POST /api/admin/requirements` | `PUT /api/admin/requirements/:id` | `DELETE /api/admin/requirements/:id` |
| **Projects** | `GET /api/admin/projects` | `POST /api/admin/projects` | `PUT /api/admin/projects/:id` | `DELETE /api/admin/projects/:id` |
| **Contracts** | `GET /api/admin/contracts` | `POST /api/admin/contracts` | `PUT /api/admin/contracts/:id` | `DELETE /api/admin/contracts/:id` |
| **Attention** | `GET /api/admin/attention` | `POST /api/admin/attention` | `PUT /api/admin/attention/:id` | `DELETE /api/admin/attention/:id` |

---

## Database Schema

| Table | Purpose |
|-------|---------|
| `attention_issues` | Priority issues with entity references, stall tracking, resolution status |
| `talent` | People records: status, bench dates, idle hours, skills array |
| `bench_idle_weekly` | Weekly bench idle hours for trend charts |
| `requirements` | Open job requirements with 6-stage pipeline, stall and priority flags |
| `projects` | Managed-services project cards with health stage and blocking issue |
| `contracts` | SOW/contract records with dates, value, invoice status, utilisation |
| `engagements` | Active deployment records; FK to `talent` |
| `engagement_checklist_items` | Per-engagement compliance checklist lines; FK to `engagements` |
| `health_metrics` | KPI rows: key, label, value, unit, trend direction |
| `leads` | CRM lead records with stage, value, source, contact info |

For the full DDL see [`backend/schema.sql`](backend/schema.sql).

---

## Demo Credentials

| User | Email | Password | Role |
|------|-------|----------|------|
| Sarah K. | sarah@techno.com | admin123 | Delivery Lead |
| Admin User | admin@techno.com | admin123 | Administrator |
| Ops Manager | ops@techno.com | ops123 | Operations |

---

## Documentation

| Document | Description |
|----------|-------------|
| [API Reference](docs/API_REFERENCE.md) | Full endpoint docs with request/response examples |
| [Architecture](docs/ARCHITECTURE.md) | System design, component map, DB entity relationships |
| [Setup Guide](docs/SETUP_GUIDE.md) | Detailed local development setup |
| [Deployment Guide](docs/DEPLOYMENT.md) | Production deployment (Railway, Render, VPS) |
| [User Manual](docs/USER_MANUAL.md) | Feature-by-feature user guide |
| [RFP Template](docs/RFP_TEMPLATE.md) | Enterprise RFP response template |
| [Case Studies](docs/CASE_STUDIES.md) | Real-world impact stories |
| [Competitive Analysis](docs/COMPETITIVE_ANALYSIS.md) | Market landscape and differentiation |
| [Contributing](CONTRIBUTING.md) | Development workflow, coding standards, PR process |
| [Changelog](CHANGELOG.md) | Version history |

---

TechnoElevate © 2026 · Operations Platform v1.0
