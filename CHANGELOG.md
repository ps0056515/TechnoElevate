# Changelog

All notable changes to TechnoElevate are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).  
Versioning follows [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### Planned (v1.1)
- Real authentication: JWT + bcrypt, role-based access control (Admin / Manager / Viewer)
- Leads module backend — persist leads to PostgreSQL (currently in-memory only)
- Email notifications for contract expiry and stalled attention items
- CSV export for pipeline, contracts, and talent reports
- Helmet middleware + rate limiting for production hardening
- Settings page persistence (profile and theme saved to DB)
- HTTP security headers

### Planned (v1.2)
- Webhook/notification integration (Slack, Microsoft Teams)
- Bullhorn ATS data import
- Mobile-responsive layout improvements
- Date range filters on dashboard panels (weekly / monthly / quarterly)

### Planned (v2.0)
- Multi-tenancy (multiple organisations on one instance)
- Real-time updates via WebSockets (live dashboard refresh)
- Advanced analytics and forecasting
- Native mobile app (React Native)
- ATS bi-directional sync (Ceipal, Vincere)

---

## [1.0.0] — 2026-04-10

### Added

**Backend**
- Express REST API on port 4000
- PostgreSQL schema with 9 tables: `attention_issues`, `talent`, `bench_idle_weekly`, `requirements`, `projects`, `contracts`, `engagements`, `engagement_checklist_items`, `health_metrics`
- `GET /api/ping` health check endpoint
- Attention Engine: `GET /api/attention`, `PATCH /api/attention/:id/resolve`
- Talent Lifecycle: `GET /api/talent/lifecycle`, `PATCH /api/talent/:id/status`
- Requirements Pipeline: `GET /api/pipeline`, `PATCH /api/pipeline/:id/stage`
- Managed Services Projects: `GET /api/projects`, `PATCH /api/projects/:id/resolve`
- Contracts: `GET /api/contracts`
- Engagements: `GET /api/engagements`, `PATCH /api/engagements/checklist/:id/complete`
- Health Metrics: `GET /api/health`, `PUT /api/health/:id`
- Admin CRUD endpoints for talent, requirements, projects, contracts, and attention issues
- `seed.js` — database creation, schema application, and demo data seeding
- `.env`-based configuration via `dotenv`
- CORS enabled for development
- `nodemon` for development auto-reload

**Frontend**
- React 18 + Vite application on port 3000
- Vite proxy: `/api` → `http://localhost:4000`
- Login page with demo user quick-access buttons
- Sidebar navigation
- Dashboard Overview with 5 tabs (Overview, Pro Services, Managed Services, Talent, Contracts)
- Attention Engine panel: priority-sorted cards, one-click resolve
- Talent Lifecycle panel: funnel counts, 4-week bench idle bar chart (Recharts), talent list
- Requirements Pipeline: 6-stage kanban with stall detection and stage advance
- Managed Services: project health cards with blocker resolution
- Contracts Panel: SOW register with expiry countdown and invoice overdue flags
- Engagement Checklist: 7-stage compliance tracking with overdue highlighting
- Health Metrics: 6 KPI tiles with trend indicators
- Leads page (in-memory, no backend — v1.1 will add persistence)
- Requirements page (dedicated view)
- Projects page (dedicated view)
- Talent page (dedicated view)
- Contracts page (dedicated view)
- Admin panel: tabbed CRUD for all entities
- Settings page (display only — persistence in v1.1)
- Theme system via ThemeContext with light/dark and accent colour support

**Documentation**
- `README.md` — comprehensive project overview, full API endpoint table, environment variables, DB schema summary
- `docs/API_REFERENCE.md` — full endpoint documentation with request/response examples
- `docs/ARCHITECTURE.md` — system diagram, component map, DB schema detail
- `docs/SETUP_GUIDE.md` — step-by-step local development setup
- `docs/DEPLOYMENT.md` — deployment guides for Railway, Render, Fly.io, and self-hosted VPS
- `docs/USER_MANUAL.md` — feature-by-feature user guide
- `docs/RFP_TEMPLATE.md` — enterprise RFP response template
- `docs/CASE_STUDIES.md` — three detailed impact case studies
- `docs/COMPETITIVE_ANALYSIS.md` — market landscape and differentiation analysis
- `CONTRIBUTING.md` — development workflow, code standards, PR process
- `CHANGELOG.md` — this file

---

## Version History Summary

| Version | Date | Highlights |
|---------|------|------------|
| 1.0.0 | 2026-04-10 | Initial release — full operations dashboard |

---

[Unreleased]: https://github.com/your-org/techno-elevate/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/your-org/techno-elevate/releases/tag/v1.0.0
