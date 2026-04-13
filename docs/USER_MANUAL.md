# TechnoElevate — User Manual

A feature-by-feature guide for operations, delivery, and admin users.

---

## Table of Contents

- [Logging In](#logging-in)
- [Dashboard Overview](#dashboard-overview)
- [Attention Engine](#attention-engine)
- [Talent Lifecycle](#talent-lifecycle)
- [Requirements Pipeline](#requirements-pipeline)
- [Managed Services Projects](#managed-services-projects)
- [Contracts & SOWs](#contracts--sows)
- [Engagement Checklist](#engagement-checklist)
- [Health Metrics](#health-metrics)
- [Leads](#leads)
- [Admin Panel](#admin-panel)
- [Settings](#settings)

---

## Logging In

Open the app at **http://localhost:7000**.

You will see the TechnoElevate login screen. Enter your email and password, or use the **Quick Demo Access** buttons at the bottom to auto-fill credentials.

| Role | Email | Password | Access Level |
|------|-------|----------|-------------|
| Delivery Lead | sarah@techno.com | admin123 | Full dashboard + admin |
| Administrator | admin@techno.com | admin123 | Full dashboard + admin |
| Operations | ops@techno.com | ops123 | Full dashboard |

Once logged in, you will see the main dashboard with a sidebar navigation on the left.

---

## Dashboard Overview

The **Dashboard** is the home screen. It has five tabs at the top:

| Tab | Shows |
|-----|-------|
| **Overview** | All key panels: Health Metrics → Attention Engine → Talent → Pipeline → Projects + Contracts → Engagement Checklist |
| **Pro Services** | Requirements pipeline only |
| **Managed Services** | Managed services project cards only |
| **Talent** | Talent lifecycle funnel and engagement checklist |
| **Contracts** | Contracts and SOW panel only |

Use tabs to focus on a specific area or view everything at once on the Overview tab.

---

## Attention Engine

**Location**: Dashboard Overview tab → first major panel

The Attention Engine surfaces issues that need immediate action, sorted by severity:

- **HIGH** — requires action today
- **MED** — should be addressed this week
- **LOW** — informational, monitor

### Reading an attention card

Each card shows:
- Priority badge (HIGH / MED / LOW) with colour coding
- Entity name (the talent, requirement, project, or contract affected)
- Issue description
- Days stalled — how long this issue has been open
- Action button — labelled with the recommended next step

### Resolving an issue

Click the **action button** on any card. The issue will disappear from the list and be marked resolved in the database. Resolved issues are still visible in the Admin panel if you need to review them.

> **Tip**: Aim to have zero HIGH items by end of each business day.

---

## Talent Lifecycle

**Location**: Dashboard → Talent tab, or the Talent page in the sidebar

Shows how talent resources flow through stages:

```
Bench → In Process → Interviewing → Offered → Deployed
```

### Funnel counts

The top row shows a live count of people in each stage. Click any stage to filter the talent list below.

### Bench Idle Chart

A bar chart showing total bench idle hours over the past 4 weeks. Rising bars indicate increasing bench cost and should trigger outreach action.

### Talent list

Below the chart, a table lists all talent with:
- Name and role
- Current status
- Days on bench (for benched talent)
- Idle hours
- Current client (for deployed talent)
- Skills

---

## Requirements Pipeline

**Location**: Sidebar → Requirements, or Dashboard → Pro Services tab

Tracks open job requirements through 6 stages:

| Stage | Meaning |
|-------|---------|
| **Intake** | Requirement received, not yet worked |
| **Sourcing** | Actively searching for candidates |
| **Submission** | Candidate profiles sent to client |
| **Screening** | Client reviewing submissions |
| **Interviewing** | Interviews scheduled/in progress |
| **Closure** | Offer extended or requirement closed |

### Reading the kanban

Requirements are shown as cards in columns. Each card shows:
- Requirement ID (e.g. REQ-2026-041)
- Job title and client name
- Priority badge (HIGH / MED / LOW)
- Days in current stage
- Stalled indicator (appears after a configurable number of days without movement)

### Advancing a requirement

Click the **Advance** or stage button on a card to move it to the next stage. This resets the days counter and clears the stalled flag.

> **Note**: Stalled requirements also surface in the Attention Engine as attention items.

---

## Managed Services Projects

**Location**: Sidebar → Projects, or Dashboard → Managed Services tab

Shows cards for active client projects with a health stage:

| Stage | Colour | Meaning |
|-------|--------|---------|
| **Green** | Green | On track |
| **At Risk** | Amber | Issues emerging, needs monitoring |
| **Blocked** | Red | Cannot progress — escalation needed |
| **Completed** | Grey | Delivered |

### Reading a project card

Each card shows:
- Project name and client
- Health stage badge
- Team size
- Utilisation % (actual vs. contracted hours)
- Project date range
- Blocking issue description (when blocked)

### Resolving a blocked project

Click **Resolve Blocker** on a blocked project card. This clears the blocking issue text and sets the project back to **Green**. Document the resolution action in the blocking issue field before clearing, or use the Admin panel to add a note.

---

## Contracts & SOWs

**Location**: Sidebar → Contracts, or Dashboard → Contracts tab

Tracks all active Statement of Work agreements.

### Status badges

| Status | Meaning |
|--------|---------|
| **Active** | Contract running normally |
| **Expiring Soon** | End date within 30 days |
| **Expired** | Past end date |

### Key columns

| Column | Description |
|--------|-------------|
| SOW ID | Business reference number |
| Client | Client name |
| Value | Total contract value |
| End Date | Contract expiry date |
| Days Remaining | Computed from today's date |
| Utilisation | % of contracted capacity currently used |
| Invoice Overdue | Red flag if an invoice is outstanding |

### Contract renewal workflow

When you see a contract with **Expiring Soon** or a low days-remaining count:
1. Check the Attention Engine — an attention item should be present
2. Begin renewal discussions with the client
3. When renewed, update the contract end date and value via the Admin panel

---

## Engagement Checklist

**Location**: Dashboard → Talent tab (lower section)

Tracks compliance and onboarding steps for each active deployment.

Stages:

| # | Stage | Example items |
|---|-------|---------------|
| 1 | Pre-boarding | Background check, access request |
| 2 | Day 1 Onboarding | Equipment issued, accounts created |
| 3 | Week 1 Check-in | Manager introduction, tools walkthrough |
| 4 | 30-Day Review | Performance check-in |
| 5 | 60-Day Review | Mid-engagement review |
| 6 | Renewal / Extension | SOW renewal initiated |
| 7 | Off-boarding | Equipment return, access revoked |

### Completing an item

Click the checkbox next to any incomplete item. It will be marked done immediately and the overdue flag (if set) will be cleared.

> **Tip**: Red items are overdue — prioritise these in your morning review.

---

## Health Metrics

**Location**: Dashboard Overview tab → top row

Six KPI tiles showing the overall health of the business:

| Metric | Description |
|--------|-------------|
| **Win Rate** | % of requirements that result in a placement |
| **Time to Submit** | Average days from intake to first client submission |
| **Revenue at Risk** | Estimated revenue from expiring/at-risk contracts |
| **Bench Cost** | Weekly cost of all bench idle hours |
| **Active Deployments** | Count of currently deployed resources |
| **Pipeline Value** | Estimated value of open requirements |

Each tile shows the current value, unit, and a trend arrow (up / down / flat).

Values are updated manually via the Admin panel's Health section, or can be wired to automatic calculation in a future version.

---

## Leads

**Location**: Sidebar → Leads

A lightweight CRM for tracking prospective clients and deal pipeline.

### Lead stages

```
New → Contacted → Qualified → Proposal → Negotiation → Won / Lost
```

### Lead card fields

| Field | Description |
|-------|-------------|
| Company | Prospect company name |
| Contact | Primary contact name and email |
| Stage | Current deal stage |
| Value | Estimated deal value |
| Source | How the lead was generated (referral, inbound, outbound) |
| Notes | Free text notes |

### Actions

- **Add Lead** — click the + button to create a new lead
- **Edit** — click the edit icon on any lead card
- **Delete** — click the trash icon (will prompt for confirmation)
- **Advance Stage** — use the stage dropdown to move a lead forward

---

## Admin Panel

**Location**: Sidebar → Admin (Administrator role)

Full CRUD interface for all data in the system. Organised in tabs:

| Tab | Manages |
|-----|---------|
| **Talent** | Add, edit, delete talent records |
| **Requirements** | Add, edit, delete job requirements |
| **Projects** | Add, edit, delete managed-services projects |
| **Contracts** | Add, edit, delete contract/SOW records |
| **Attention** | Add, edit, delete attention issues; mark resolved |
| **Health** | Update KPI metric values |

### Common operations

**Adding a record**: Click **+ Add [Entity]** button at the top right of each tab. Fill in the form fields and click Save.

**Editing a record**: Click the **Edit** (pencil) icon on any row. Update fields and Save.

**Deleting a record**: Click the **Delete** (trash) icon. Confirm the deletion in the prompt. Deletion is permanent.

> **Warning**: Deleting talent records that have associated engagements may leave engagement records without a linked talent. The engagement's `talent_name` field is preserved for display purposes.

---

## Settings

**Location**: Sidebar → Settings

| Section | Description |
|---------|-------------|
| **Profile** | Display name, role, avatar initials and colour |
| **Theme** | Light/dark mode and accent colour picker |
| **Team** | View team members (display only in v1) |
| **Notifications** | Notification preferences (display only in v1) |
| **Security** | Password change (display only in v1) |

> **Note**: Settings changes in v1 are session-only. Profile and notification persistence will be added in a future release.
