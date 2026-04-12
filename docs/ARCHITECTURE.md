# TechnoElevate — Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         BROWSER (port 3000)                     │
│                                                                 │
│  React 18 + Vite                                                │
│  ┌──────────┐  ┌──────────────────────────────────────────┐    │
│  │ Sidebar  │  │           Main Content Area              │    │
│  │  Nav     │  │  Dashboard / Leads / Requirements /      │    │
│  │          │  │  Projects / Talent / Contracts /         │    │
│  │          │  │  Admin / Settings                        │    │
│  └──────────┘  └──────────────────────────────────────────┘    │
│                         │  fetch /api/*                        │
└─────────────────────────┼───────────────────────────────────────┘
                          │  Vite proxy → :4000
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    EXPRESS API (port 4000)                       │
│                                                                 │
│   server.js                                                     │
│   ├── CORS + JSON middleware                                    │
│   ├── GET /api/ping                                             │
│   └── /api  →  routes/dashboard.js                             │
│                 ├── Attention Engine routes                     │
│                 ├── Talent Lifecycle routes                     │
│                 ├── Requirements Pipeline routes               │
│                 ├── Projects routes                             │
│                 ├── Contracts routes                            │
│                 ├── Engagements & Checklist routes              │
│                 ├── Health Metrics routes                       │
│                 └── Admin CRUD routes                           │
│                         │  pg Pool                             │
└─────────────────────────┼───────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                   POSTGRESQL (port 5432)                        │
│                   database: techno_elevate                      │
│                                                                 │
│  attention_issues  │  talent  │  bench_idle_weekly              │
│  requirements      │  projects │  contracts                     │
│  engagements       │  engagement_checklist_items                │
│  health_metrics    │  leads                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Frontend Component Map

```
App.jsx  (auth gate + nav state)
├── LoginPage.jsx
└── (authenticated)
    ├── Sidebar.jsx
    └── Main content (switched by activeNav)
        ├── DashboardOverview.jsx
        │   ├── HealthMetrics.jsx
        │   ├── AttentionEngine.jsx
        │   ├── TalentLifecycle.jsx  (+ Recharts BarChart)
        │   ├── Pipeline.jsx
        │   ├── ManagedServices.jsx
        │   ├── ContractsPanel.jsx
        │   └── EngagementChecklist.jsx
        ├── LeadsPage.jsx
        ├── RequirementsPage.jsx
        ├── ProjectsPage.jsx
        ├── TalentPage.jsx
        │   ├── TalentLifecycle.jsx
        │   └── EngagementChecklist.jsx
        ├── ContractsPage.jsx
        │   └── ContractsPanel.jsx
        ├── AdminPage.jsx
        │   ├── TalentAdmin.jsx
        │   ├── RequirementsAdmin.jsx
        │   ├── ProjectsAdmin.jsx
        │   ├── ContractsAdmin.jsx
        │   ├── AttentionAdmin.jsx
        │   └── HealthAdmin.jsx
        │       └── shared: AdminTable.jsx, AdminModal.jsx, FormField.jsx
        └── SettingsPage.jsx
```

---

## Database Entity Relationships

```
talent (id)
  │
  ├──< bench_idle_weekly          (weekly aggregates, no FK)
  │
  └──< engagements (talent_id)
           │
           └──< engagement_checklist_items (engagement_id)

requirements (id)                 (standalone, no FK)

projects (id)                     (standalone, no FK)

contracts (id)                    (standalone, no FK)

attention_issues (id)             (references entity by string id, no strict FK)

health_metrics (id)               (standalone KPI rows)

leads (id)                        (standalone CRM records)
```

---

## Database Schema Detail

### `attention_issues`

| Column | Type | Notes |
|--------|------|-------|
| `id` | SERIAL PK | |
| `priority` | VARCHAR(10) | CHECK: `HIGH`, `MED`, `LOW` |
| `entity_name` | VARCHAR(100) | Display name of the affected entity |
| `entity_type` | VARCHAR(50) | E.g. `talent`, `requirement`, `project` |
| `entity_id` | VARCHAR(50) | String reference to the entity |
| `issue_description` | TEXT | |
| `action_label` | VARCHAR(100) | CTA button text |
| `days_stalled` | INTEGER | Default 0 |
| `resolved` | BOOLEAN | Default FALSE |
| `created_at` | TIMESTAMP | Default NOW() |

---

### `talent`

| Column | Type | Notes |
|--------|------|-------|
| `id` | SERIAL PK | |
| `name` | VARCHAR(100) | |
| `role` | VARCHAR(100) | Job title |
| `status` | VARCHAR(30) | CHECK: `bench`, `in_process`, `interviewing`, `offered`, `deployed` |
| `bench_start_date` | DATE | NULL when not on bench |
| `idle_hours` | INTEGER | Default 0 |
| `current_client` | VARCHAR(100) | NULL when undeployed |
| `skills` | TEXT[] | PostgreSQL text array |
| `created_at` | TIMESTAMP | Default NOW() |

---

### `bench_idle_weekly`

| Column | Type | Notes |
|--------|------|-------|
| `id` | SERIAL PK | |
| `week_label` | VARCHAR(20) | Display label e.g. `"Mar 17"` |
| `week_start` | DATE | |
| `total_hours` | INTEGER | Sum of idle hours across all bench talent that week |

---

### `requirements`

| Column | Type | Notes |
|--------|------|-------|
| `id` | SERIAL PK | |
| `req_id` | VARCHAR(50) UNIQUE | Business key e.g. `REQ-2026-041` |
| `title` | VARCHAR(200) | |
| `client` | VARCHAR(100) | |
| `stage` | VARCHAR(30) | CHECK: `intake`, `sourcing`, `submission`, `screening`, `interviewing`, `closure` |
| `days_in_stage` | INTEGER | Default 0; reset on stage advance |
| `stalled` | BOOLEAN | Default FALSE; cleared on stage advance |
| `priority` | VARCHAR(10) | Default `MED`; values: `HIGH`, `MED`, `LOW` |
| `role_type` | VARCHAR(100) | E.g. `Full-time`, `Contract` |
| `created_at` | TIMESTAMP | Default NOW() |

---

### `projects`

| Column | Type | Notes |
|--------|------|-------|
| `id` | SERIAL PK | |
| `name` | VARCHAR(200) | |
| `client` | VARCHAR(100) | |
| `stage` | VARCHAR(30) | CHECK: `green`, `at_risk`, `blocked`, `completed` |
| `blocking_issue` | TEXT | NULL when no blocker |
| `team_size` | INTEGER | Default 0 |
| `start_date` | DATE | |
| `end_date` | DATE | |
| `utilization_pct` | INTEGER | 0–100 |
| `created_at` | TIMESTAMP | Default NOW() |

---

### `contracts`

| Column | Type | Notes |
|--------|------|-------|
| `id` | SERIAL PK | |
| `sow_id` | VARCHAR(50) | Business key e.g. `SOW-2025-018` |
| `client` | VARCHAR(100) | |
| `start_date` | DATE | |
| `end_date` | DATE | |
| `value` | DECIMAL(12,2) | Contract value in USD |
| `status` | VARCHAR(30) | CHECK: `active`, `expiring_soon`, `expired` |
| `invoice_overdue` | BOOLEAN | Default FALSE |
| `invoice_amount` | DECIMAL(12,2) | Outstanding invoice amount |
| `utilization_pct` | INTEGER | 0–100 |
| `created_at` | TIMESTAMP | Default NOW() |

---

### `engagements`

| Column | Type | Notes |
|--------|------|-------|
| `id` | SERIAL PK | |
| `talent_id` | INTEGER FK → `talent(id)` | NULL allowed |
| `talent_name` | VARCHAR(100) | Denormalised display name |
| `client` | VARCHAR(100) | |
| `role` | VARCHAR(100) | |
| `start_date` | DATE | |
| `created_at` | TIMESTAMP | Default NOW() |

---

### `engagement_checklist_items`

| Column | Type | Notes |
|--------|------|-------|
| `id` | SERIAL PK | |
| `engagement_id` | INTEGER FK → `engagements(id)` | |
| `stage_number` | INTEGER | 1–7 |
| `stage_name` | VARCHAR(100) | E.g. `Onboarding`, `Week 1 Check-in` |
| `item_name` | VARCHAR(200) | |
| `completed` | BOOLEAN | Default FALSE |
| `due_date` | DATE | |
| `overdue` | BOOLEAN | Default FALSE |

---

### `health_metrics`

| Column | Type | Notes |
|--------|------|-------|
| `id` | SERIAL PK | |
| `metric_key` | VARCHAR(50) UNIQUE | E.g. `win_rate`, `bench_cost` |
| `metric_label` | VARCHAR(100) | Display name |
| `metric_value` | DECIMAL(12,2) | |
| `metric_unit` | VARCHAR(20) | E.g. `%`, `days`, `$` |
| `trend` | VARCHAR(10) | CHECK: `up`, `down`, `flat` |
| `updated_at` | TIMESTAMP | Default NOW() |

---

### `leads`

| Column | Type | Notes |
|--------|------|-------|
| `id` | SERIAL PK | |
| `company` | VARCHAR(100) | |
| `contact_name` | VARCHAR(100) | |
| `contact_email` | VARCHAR(150) | |
| `stage` | VARCHAR(30) | CHECK: `new`, `contacted`, `qualified`, `proposal`, `negotiation`, `won`, `lost` |
| `value` | DECIMAL(12,2) | Estimated deal value |
| `source` | VARCHAR(50) | E.g. `referral`, `inbound`, `outbound` |
| `notes` | TEXT | |
| `created_at` | TIMESTAMP | Default NOW() |
| `updated_at` | TIMESTAMP | Default NOW() |

---

## Data Flow — Dashboard Load

```
Browser                     Express                    PostgreSQL
  │                            │                           │
  │── GET /api/attention ──────►                           │
  │                            │── SELECT attention_issues ►│
  │                            │◄── rows ──────────────────│
  │◄── JSON array ─────────────│                           │
  │                            │                           │
  │── GET /api/talent/lifecycle►                           │
  │                            │── SELECT talent (3 queries)►│
  │                            │◄── counts, bench, list ───│
  │◄── JSON object ────────────│                           │
  │                            │                           │
  │  (+ pipeline, projects,    │                           │
  │     contracts, engagements,│                           │
  │     health in parallel)    │                           │
```

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Single Express router file | Simplicity for v1; split into separate routers as the API grows |
| PostgreSQL text array for skills | Avoids a separate `talent_skills` join table for this scale |
| Denormalised `talent_name` in engagements | Prevents broken display if a talent record is later deleted |
| `days_remaining` computed in SQL | Keeps the client free of date arithmetic; consistent with DB timezone |
| Vite proxy `/api` → `:4000` | Avoids CORS in development; production needs nginx or similar reverse proxy |
| Demo-only auth (hardcoded users) | v1 scope; swap with JWT + bcrypt + `users` table for production |
