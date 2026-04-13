# TechnoElevate — API Reference

Base URL (local dev): `http://localhost:6000/api`  
All endpoints return `Content-Type: application/json`.  
Error responses: `{ "error": "<message>" }` with HTTP 500.

---

## Table of Contents

- [System](#system)
- [Attention Engine](#attention-engine)
- [Talent Lifecycle](#talent-lifecycle)
- [Requirements Pipeline](#requirements-pipeline)
- [Projects (Managed Services)](#projects-managed-services)
- [Contracts](#contracts)
- [Engagements & Checklist](#engagements--checklist)
- [Health Metrics](#health-metrics)
- [Admin — Talent](#admin--talent)
- [Admin — Requirements](#admin--requirements)
- [Admin — Projects](#admin--projects)
- [Admin — Contracts](#admin--contracts)
- [Admin — Attention Issues](#admin--attention-issues)

---

## System

### `GET /api/ping`

Health check.

**Response 200**
```json
{
  "status": "ok",
  "timestamp": "2026-04-10T09:00:00.000Z"
}
```

---

## Attention Engine

### `GET /api/attention`

Returns all **unresolved** attention issues, ordered by priority (HIGH → MED → LOW) then by days stalled descending.

**Response 200**
```json
[
  {
    "id": 1,
    "priority": "HIGH",
    "entity_name": "Riya Sharma",
    "entity_type": "talent",
    "entity_id": "T-042",
    "issue_description": "Bench idle 18 days — no active submissions",
    "action_label": "Start Outreach",
    "days_stalled": 18,
    "resolved": false,
    "created_at": "2026-03-25T00:00:00.000Z"
  }
]
```

**Fields**

| Field | Type | Description |
|-------|------|-------------|
| `id` | integer | Primary key |
| `priority` | `"HIGH"` \| `"MED"` \| `"LOW"` | Issue severity |
| `entity_name` | string | Name of the affected entity |
| `entity_type` | string | Type: `talent`, `requirement`, `project`, `contract` |
| `entity_id` | string | Reference ID in the entity's own system |
| `issue_description` | string | Human-readable description |
| `action_label` | string | CTA button label shown in UI |
| `days_stalled` | integer | Days since the issue was created/last updated |
| `resolved` | boolean | Always `false` in this endpoint |
| `created_at` | ISO 8601 timestamp | |

---

### `PATCH /api/attention/:id/resolve`

Mark an attention issue as resolved.

**URL param**: `id` — integer, attention issue primary key.

**Response 200**
```json
{ "success": true }
```

---

## Talent Lifecycle

### `GET /api/talent/lifecycle`

Returns talent status funnel counts, bench idle weekly data, and full talent list.

**Response 200**
```json
{
  "counts": [
    { "status": "bench", "count": "4" },
    { "status": "in_process", "count": "3" },
    { "status": "interviewing", "count": "2" },
    { "status": "offered", "count": "1" },
    { "status": "deployed", "count": "8" }
  ],
  "benchIdle": [
    { "id": 1, "week_label": "Mar 17", "week_start": "2026-03-17", "total_hours": 92 },
    { "id": 2, "week_label": "Mar 24", "week_start": "2026-03-24", "total_hours": 110 }
  ],
  "talents": [
    {
      "id": 1,
      "name": "Riya Sharma",
      "role": "Java Developer",
      "status": "bench",
      "bench_start_date": "2026-03-12",
      "idle_hours": 144,
      "current_client": null,
      "skills": ["Java", "Spring Boot", "AWS"]
    }
  ]
}
```

**Status values**: `bench` | `in_process` | `interviewing` | `offered` | `deployed`

---

### `PATCH /api/talent/:id/status`

Update a talent record's lifecycle status.

**URL param**: `id` — integer, talent primary key.

**Request body**
```json
{ "status": "interviewing" }
```

**Response 200**
```json
{ "success": true }
```

---

## Requirements Pipeline

### `GET /api/pipeline`

Returns all requirements ordered by priority (HIGH first) then by days in current stage descending.

**Response 200**
```json
[
  {
    "id": 1,
    "req_id": "REQ-2026-041",
    "title": "Senior Java Developer — FinTech Client",
    "client": "Apex Financial",
    "stage": "sourcing",
    "days_in_stage": 12,
    "stalled": true,
    "priority": "HIGH",
    "role_type": "Full-time",
    "created_at": "2026-03-01T00:00:00.000Z"
  }
]
```

**Stage values**: `intake` | `sourcing` | `submission` | `screening` | `interviewing` | `closure`

---

### `PATCH /api/pipeline/:id/stage`

Advance a requirement to a new stage. Resets `days_in_stage` to 0 and clears the `stalled` flag.

**URL param**: `id` — integer, requirement primary key.

**Request body**
```json
{ "stage": "submission" }
```

**Response 200**
```json
{ "success": true }
```

---

## Projects (Managed Services)

### `GET /api/projects`

Returns all projects ordered by health severity (blocked first, completed last).

**Response 200**
```json
[
  {
    "id": 1,
    "name": "DataOps Modernisation",
    "client": "Nexus Corp",
    "stage": "blocked",
    "blocking_issue": "Infrastructure access not provisioned by client",
    "team_size": 5,
    "start_date": "2026-01-15",
    "end_date": "2026-06-30",
    "utilization_pct": 62,
    "created_at": "2026-01-10T00:00:00.000Z"
  }
]
```

**Stage values**: `green` | `at_risk` | `blocked` | `completed`

---

### `PATCH /api/projects/:id/resolve`

Clear the blocking issue and set the project stage to `green`.

**URL param**: `id` — integer, project primary key.

**Response 200**
```json
{ "success": true }
```

---

## Contracts

### `GET /api/contracts`

Returns all contracts with a computed `days_remaining` field (`end_date - CURRENT_DATE`).

**Response 200**
```json
[
  {
    "id": 1,
    "sow_id": "SOW-2025-018",
    "client": "Apex Financial",
    "start_date": "2025-10-01",
    "end_date": "2026-04-30",
    "value": "185000.00",
    "status": "expiring_soon",
    "invoice_overdue": true,
    "invoice_amount": "22500.00",
    "utilization_pct": 78,
    "days_remaining": 20,
    "created_at": "2025-09-28T00:00:00.000Z"
  }
]
```

**Status values**: `active` | `expiring_soon` | `expired`

---

## Engagements & Checklist

### `GET /api/engagements`

Returns all engagements and all engagement checklist items.

**Response 200**
```json
{
  "engagements": [
    {
      "id": 1,
      "talent_id": 12,
      "talent_name": "Priya Nair",
      "client": "Nexus Corp",
      "role": "Data Engineer",
      "start_date": "2026-01-15",
      "created_at": "2026-01-10T00:00:00.000Z"
    }
  ],
  "checklistItems": [
    {
      "id": 1,
      "engagement_id": 1,
      "stage_number": 1,
      "stage_name": "Onboarding",
      "item_name": "Background check submitted",
      "completed": true,
      "due_date": "2026-01-14",
      "overdue": false
    }
  ]
}
```

---

### `PATCH /api/engagements/checklist/:id/complete`

Mark a checklist item complete and clear its overdue flag.

**URL param**: `id` — integer, checklist item primary key.

**Response 200**
```json
{ "success": true }
```

---

## Health Metrics

### `GET /api/health`

Returns all KPI health metric rows ordered by id.

**Response 200**
```json
[
  {
    "id": 1,
    "metric_key": "win_rate",
    "metric_label": "Win Rate",
    "metric_value": "42.50",
    "metric_unit": "%",
    "trend": "up",
    "updated_at": "2026-04-01T09:00:00.000Z"
  }
]
```

**Trend values**: `up` | `down` | `flat`

---

### `PUT /api/health/:id`

Update a health metric's value.

**URL param**: `id` — integer, metric primary key.

**Request body**
```json
{ "metric_value": 45.0 }
```

**Response 200**
```json
{ "success": true }
```

---

## Admin — Talent

### `GET /api/admin/talent`

Returns all talent records ordered by id descending (most recently created first).

**Response 200** — array of talent objects (same shape as `/api/talent/lifecycle` talents).

---

### `POST /api/admin/talent`

Create a new talent record.

**Request body**
```json
{
  "name": "Arjun Mehta",
  "role": "DevOps Engineer",
  "status": "bench",
  "bench_start_date": "2026-04-01",
  "idle_hours": 0,
  "current_client": null,
  "skills": "Kubernetes, Docker, Terraform"
}
```

> `skills` accepts a comma-separated string or a JSON array.

**Response 200** — newly created record.

---

### `PUT /api/admin/talent/:id`

Update an existing talent record.

**URL param**: `id` — integer, talent primary key.  
**Request body** — same fields as POST.

**Response 200**
```json
{ "success": true }
```

---

### `DELETE /api/admin/talent/:id`

Delete a talent record.

**Response 200**
```json
{ "success": true }
```

---

## Admin — Requirements

### `GET /api/admin/requirements`

Returns all requirements ordered by id descending.

---

### `POST /api/admin/requirements`

**Request body**
```json
{
  "req_id": "REQ-2026-050",
  "title": "Cloud Architect — Retail Client",
  "client": "RetailCo",
  "stage": "intake",
  "days_in_stage": 0,
  "stalled": false,
  "priority": "HIGH",
  "role_type": "Contract"
}
```

**Response 200** — newly created record.

---

### `PUT /api/admin/requirements/:id`

Update a requirement. Same body shape as POST.

**Response 200** `{ "success": true }`

---

### `DELETE /api/admin/requirements/:id`

**Response 200** `{ "success": true }`

---

## Admin — Projects

### `GET /api/admin/projects`

Returns all projects ordered by id descending.

---

### `POST /api/admin/projects`

**Request body**
```json
{
  "name": "Cloud Migration Phase 2",
  "client": "RetailCo",
  "stage": "green",
  "blocking_issue": null,
  "team_size": 4,
  "start_date": "2026-05-01",
  "end_date": "2026-10-31",
  "utilization_pct": 0
}
```

**Response 200** — newly created record.

---

### `PUT /api/admin/projects/:id`

Same body shape as POST.  
**Response 200** `{ "success": true }`

---

### `DELETE /api/admin/projects/:id`

**Response 200** `{ "success": true }`

---

## Admin — Contracts

### `GET /api/admin/contracts`

Returns all contracts ordered by id descending.

---

### `POST /api/admin/contracts`

**Request body**
```json
{
  "sow_id": "SOW-2026-025",
  "client": "RetailCo",
  "start_date": "2026-05-01",
  "end_date": "2027-04-30",
  "value": 240000,
  "status": "active",
  "invoice_overdue": false,
  "invoice_amount": 0,
  "utilization_pct": 0
}
```

**Response 200** — newly created record.

---

### `PUT /api/admin/contracts/:id`

Same body shape as POST.  
**Response 200** `{ "success": true }`

---

### `DELETE /api/admin/contracts/:id`

**Response 200** `{ "success": true }`

---

## Admin — Attention Issues

### `GET /api/admin/attention`

Returns all attention issues (including resolved), ordered by id descending.

---

### `POST /api/admin/attention`

**Request body**
```json
{
  "priority": "HIGH",
  "entity_name": "Karan Verma",
  "entity_type": "talent",
  "entity_id": "T-055",
  "issue_description": "No client submissions in 21 days",
  "action_label": "Create Submission",
  "days_stalled": 21
}
```

**Response 200** — newly created record.

---

### `PUT /api/admin/attention/:id`

**Request body** — same as POST plus `"resolved": true/false`.  
**Response 200** `{ "success": true }`

---

### `DELETE /api/admin/attention/:id`

**Response 200** `{ "success": true }`
