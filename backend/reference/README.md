# Reference Excel files

## What’s in this folder

| File | Role |
|------|------|
| **BD_DAR.xlsx** | **Source of truth for the app and import.** Sheets: `BD`, `Bench`, `Bench Interview`, `Market Interview` (same data as in the big dashboard workbook, shorter tab names). |
| **BD_Operations_Dashboard (1).xlsx** | **Your full working dashboard in Excel** — same four blocks of raw data with tabs `BD Data`, `Bench Data`, `Bench Intv Data`, `Market Intv Data`, plus formula tabs: Executive Summary, Targets, Positions, BD Funnel, Account Scorecard, Skill Gap, BD Performance, etc. The app’s KPIs are *inspired* by these; the web app does not execute Excel’s formulas cell‑for‑cell. |

## What the app uses automatically

- The server picks **`reference/BD_DAR.xlsx` first** (then `backend/BD_DAR.xlsx`, then **`reference/BD_Operations_Dashboard (1).xlsx`** if you only have the large workbook) when saving a snapshot, unless you pass another path.
- Any workbook you use as input must have the same **column headers** in the data sheets the loader expects (see `loadBdDarSnapshot.js` / `import-bd-dar.js`).

## What you need to do

1. **Keep at least one** of the two files here (or in `backend/`) with current data.
2. **Save snapshot** from the app (Admin: BD Operations → *Save snapshot from BD_DAR...*) or run `npm run bd:sync` so PostgreSQL has the latest payload.
3. **Database:** run `npm run db:migrate` in `backend` if tables like `bd_ops_snapshot` or `bd_ops_vp_targets` are new.
4. **Optional — Git:** if teammates should get the same files, **commit** this `reference/` folder (it is not ignored by default).

## Closing the gap with Excel

To align numbers and layout with a specific tab (e.g. *BD Funnel* or *Skill Gap*), we need the **exact rules** (formulas or a short spec). The `BD Data` / `BD` content is the same; the **computed** sheets still need to be implemented or verified line by line in code.

## Quick check

```bash
cd backend
npm run bd:inspect
```

This prints resolved sheet names and row counts for the file `defaultBdDarPath()` would open.
