# Contributing to TechnoElevate

Thank you for contributing. This document covers the development workflow, code style, branch strategy, and PR process.

---

## Table of Contents

- [Getting Started](#getting-started)
- [Branch Strategy](#branch-strategy)
- [Commit Messages](#commit-messages)
- [Code Style](#code-style)
- [Frontend Guidelines](#frontend-guidelines)
- [Backend Guidelines](#backend-guidelines)
- [Database Guidelines](#database-guidelines)
- [Pull Request Process](#pull-request-process)
- [Reporting Bugs](#reporting-bugs)
- [Requesting Features](#requesting-features)

---

## Getting Started

1. Follow the [Setup Guide](docs/SETUP_GUIDE.md) to get the project running locally
2. Fork or clone the repository
3. Create a feature branch (see Branch Strategy below)
4. Make your changes, test them, and submit a PR

---

## Branch Strategy

| Branch | Purpose |
|--------|---------|
| `main` | Production-ready code only. Protected — no direct commits. |
| `develop` | Integration branch. All feature branches merge here first. |
| `feature/<name>` | New features (e.g. `feature/leads-backend`) |
| `fix/<name>` | Bug fixes (e.g. `fix/contract-days-calculation`) |
| `docs/<name>` | Documentation updates (e.g. `docs/api-reference`) |
| `chore/<name>` | Dependency updates, tooling, config changes |

### Example workflow

```bash
git checkout develop
git pull origin develop
git checkout -b feature/email-notifications
# ... make changes ...
git add .
git commit -m "feat: add contract expiry email notifications"
git push origin feature/email-notifications
# open a PR from feature/email-notifications → develop
```

---

## Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) spec:

```
<type>(<scope>): <short description>

[optional body]
[optional footer]
```

### Types

| Type | Use when |
|------|---------|
| `feat` | Adding a new feature |
| `fix` | Fixing a bug |
| `docs` | Documentation changes only |
| `style` | Formatting, missing semi-colons (no logic change) |
| `refactor` | Code restructuring (no feature or bug change) |
| `perf` | Performance improvements |
| `test` | Adding or updating tests |
| `chore` | Build process, dependency updates, tooling |

### Examples

```
feat(contracts): add days-remaining highlight when < 7 days
fix(pipeline): reset stalled flag correctly on stage advance
docs(api): add PUT /health/:id to API reference
chore(deps): upgrade vite to 5.4.2
refactor(dashboard): extract attention card into separate component
```

---

## Code Style

### General

- Use **2-space indentation** throughout (both frontend and backend)
- Use **single quotes** for strings in JavaScript
- No trailing commas in function arguments (trailing commas in objects/arrays are fine)
- Always use `const` unless rebinding is necessary; use `let` over `var`
- Destructure where it improves readability

### Naming

| Type | Convention | Example |
|------|-----------|---------|
| Files (components) | PascalCase | `AttentionEngine.jsx` |
| Files (utils/routes) | camelCase | `dashboard.js` |
| React components | PascalCase | `function AttentionEngine()` |
| Functions | camelCase | `handleResolve()` |
| Constants | UPPER_SNAKE_CASE | `const MAX_RETRIES = 3` |
| CSS variables | kebab-case | `--color-accent` |

---

## Frontend Guidelines

### Components

- One component per file
- Keep components focused — if a component exceeds ~200 lines, consider splitting it
- Prefer functional components with hooks over class components
- Pass callbacks as props; avoid prop-drilling more than 2 levels deep — use context for shared state

### Styling

- Inline styles are used throughout the existing codebase — continue this pattern for consistency
- Use `ThemeContext` values for colours (do not hardcode theme colours)
- Responsive: test at 1280px, 1440px, and 1920px widths

### API calls

- All API calls should go through `/api/...` (Vite proxy handles dev routing)
- Use `async/await` with `try/catch`
- Show loading state during fetch; show error state on failure
- Do not leave `console.log` calls in committed code

### Example pattern

```jsx
const [data, setData] = useState([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);

useEffect(() => {
  const load = async () => {
    try {
      const res = await fetch('/api/contracts');
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  load();
}, []);
```

---

## Backend Guidelines

### Route handlers

- All route handlers must be wrapped in `try/catch` and return a 500 with `{ error: err.message }` on failure
- Use parameterised queries — never string-interpolate user input into SQL
- Return consistent shapes: `{ success: true }` for mutations, array or object for data endpoints
- Keep route handlers thin — extract complex logic into helper functions

### Example pattern

```js
router.patch('/contracts/:id/renew', async (req, res) => {
  try {
    const { new_end_date, new_value } = req.body;
    await pool.query(
      'UPDATE contracts SET end_date = $1, value = $2, status = $3 WHERE id = $4',
      [new_end_date, new_value, 'active', req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

### Adding a new route

1. Add the route to `backend/routes/dashboard.js`
2. Document it in `docs/API_REFERENCE.md`
3. Add the endpoint to the table in `README.md`

---

## Database Guidelines

### Migrations

There is no migration tool in v1 — schema changes are applied manually:

1. Edit `backend/schema.sql` with your DDL change (`ALTER TABLE` or new `CREATE TABLE IF NOT EXISTS`)
2. Apply to your local DB: `psql -U postgres -d techno_elevate -f backend/schema.sql`
3. If the change requires data, update `backend/seed.js` accordingly

### Naming conventions

| Object | Convention | Example |
|--------|-----------|---------|
| Tables | snake_case, plural | `attention_issues` |
| Columns | snake_case | `days_stalled` |
| Primary keys | `id SERIAL PRIMARY KEY` | |
| Foreign keys | `<table_singular>_id` | `engagement_id` |
| Booleans | `is_` or descriptive | `resolved`, `invoice_overdue` |
| Timestamps | `created_at`, `updated_at` | |

### Constraints

- Always define `CHECK` constraints for enum-like columns (priority, status, stage)
- Use `NOT NULL` where a value is always required
- Use `DEFAULT` for columns that have sensible defaults (e.g. `0`, `FALSE`, `NOW()`)
- Foreign keys should cascade only where deletion of the parent should cascade (be conservative)

---

## Pull Request Process

1. **Open a PR** from your feature branch into `develop`
2. Fill in the PR description:
   - What the change does
   - How to test it
   - Any migrations needed
   - Screenshots for UI changes
3. Link any related issues
4. Request at least **1 reviewer**
5. Address review comments before merging
6. Squash commits when merging (keep history clean)

### PR checklist

- [ ] Code follows the style guidelines in this document
- [ ] No `console.log` left in the code
- [ ] API changes documented in `docs/API_REFERENCE.md` and `README.md`
- [ ] Schema changes reflected in `backend/schema.sql` and `docs/ARCHITECTURE.md`
- [ ] No hardcoded credentials or secrets
- [ ] Tested locally end-to-end

---

## Reporting Bugs

Open an issue with:
- **Title**: short description (e.g. "Contract days_remaining shows negative after expiry")
- **Steps to reproduce**: numbered list
- **Expected behaviour**
- **Actual behaviour**
- **Environment**: OS, browser, Node version

---

## Requesting Features

Open an issue with:
- **Title**: short description (e.g. "Add CSV export for requirements pipeline")
- **Problem**: what operational pain this solves
- **Proposed solution**: brief description of the feature
- **Alternatives considered** (optional)
- **Priority in your use case**: nice-to-have / important / critical

Features aligned with the [Competitive Analysis](docs/COMPETITIVE_ANALYSIS.md) gaps section are most likely to be prioritised.
