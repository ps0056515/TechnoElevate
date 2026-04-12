# TechnoElevate — Setup Guide

Step-by-step guide to running TechnoElevate locally for development.

---

## Prerequisites

| Tool | Minimum Version | Check |
|------|----------------|-------|
| Node.js | 18.x | `node --version` |
| npm | 9.x | `npm --version` |
| PostgreSQL | 14.x | `psql --version` |
| Git | any | `git --version` |

### Installing PostgreSQL

**Windows**: Download the installer from https://www.postgresql.org/download/windows/  
During install, note the port (default **5432**) and the password you set for the `postgres` user.

**macOS (Homebrew)**:
```bash
brew install postgresql@16
brew services start postgresql@16
```

**Ubuntu/Debian**:
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

---

## Step 1 — Clone the Repository

```bash
git clone <repository-url>
cd TechnoElevate-git
```

---

## Step 2 — Create the Environment File

```bash
cp backend/.env.example backend/.env
```

Open `backend/.env` and configure:

```env
PORT=4000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=techno_elevate
DB_USER=postgres
DB_PASSWORD=your_postgres_password_here
```

> **Important**: Use port `5432` (the PostgreSQL default), not `5433` — unless your installation uses a non-standard port.

### Environment Variable Reference

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `PORT` | `4000` | No | Express API server port |
| `DB_HOST` | `localhost` | No | PostgreSQL hostname or IP |
| `DB_PORT` | `5432` | No | PostgreSQL port |
| `DB_NAME` | `techno_elevate` | No | Database name (created by seed.js) |
| `DB_USER` | `postgres` | No | PostgreSQL user |
| `DB_PASSWORD` | `postgres` | **Yes** | PostgreSQL password — change this |

---

## Step 3 — Install Dependencies

### Backend

```bash
cd backend
npm install
```

Installs: `express`, `cors`, `dotenv`, `pg`, `nodemon` (dev)

### Frontend

```bash
cd ../frontend
npm install
```

Installs: `react`, `react-dom`, `recharts`, `vite`, `@vitejs/plugin-react`

---

## Step 4 — Create and Seed the Database

```bash
cd ../backend
node seed.js
```

This script:
1. Connects to your PostgreSQL server using the `.env` credentials
2. Creates the `techno_elevate` database if it does not exist
3. Runs `schema.sql` to create all tables
4. Truncates existing data (safe to re-run)
5. Inserts demo data for all entities

**Expected output:**
```
Connected to PostgreSQL
Created database techno_elevate
Schema applied
Seeded attention_issues: 6 rows
Seeded talent: 18 rows
Seeded bench_idle_weekly: 4 rows
Seeded requirements: 12 rows
Seeded projects: 5 rows
Seeded contracts: 8 rows
Seeded engagements: 6 rows
Seeded engagement_checklist_items: 42 rows
Seeded health_metrics: 6 rows
Seeded leads: 10 rows
Done.
```

### Troubleshooting seed errors

| Error | Cause | Fix |
|-------|-------|-----|
| `ECONNREFUSED` | PostgreSQL not running | Start the PostgreSQL service |
| `password authentication failed` | Wrong password in `.env` | Update `DB_PASSWORD` |
| `role "postgres" does not exist` | Different DB user | Update `DB_USER` |
| `permission denied to create database` | User lacks CREATEDB | Grant: `ALTER USER postgres CREATEDB;` |

---

## Step 5 — Start the Backend

```bash
cd backend
npm run dev
```

Uses `nodemon` for auto-reload on file changes.

**Expected output:**
```
[nodemon] starting `node server.js`
TechnoElevate API running on http://localhost:4000
```

Verify: open http://localhost:4000/api/ping — should return `{"status":"ok","timestamp":"..."}`.

To run without auto-reload:
```bash
npm start
```

---

## Step 6 — Start the Frontend

```bash
cd frontend
npm run dev
```

**Expected output:**
```
VITE v5.x.x  ready in 2000 ms
➜  Local:   http://localhost:3000/
```

If port 3000 is occupied, Vite will try 3001, 3002, etc.

---

## Step 7 — Open the App

Navigate to **http://localhost:3000** in your browser.

Use one of the demo accounts:

| Email | Password | Role |
|-------|----------|------|
| sarah@techno.com | admin123 | Delivery Lead |
| admin@techno.com | admin123 | Administrator |
| ops@techno.com | ops123 | Operations |

---

## Re-seeding the Database

To reset all data back to the demo state:

```bash
cd backend
node seed.js
```

This is safe to run any number of times — it truncates tables before reinserting.

---

## Running Both Servers Simultaneously

You can open two terminal windows, or use a tool like `concurrently`:

```bash
npm install -g concurrently
concurrently "cd backend && npm run dev" "cd frontend && npm run dev"
```

Or with `npm-run-all`:
```bash
npm install -g npm-run-all
```

Add to root `package.json`:
```json
{
  "scripts": {
    "dev": "concurrently \"npm run dev --prefix backend\" \"npm run dev --prefix frontend\""
  }
}
```

---

## Verifying the Setup

After both servers are running, check these endpoints:

```bash
# Backend health
curl http://localhost:4000/api/ping

# Attention issues
curl http://localhost:4000/api/attention

# Talent lifecycle
curl http://localhost:4000/api/talent/lifecycle
```

All should return valid JSON.

---

## Common Issues

### Port already in use

```
Error: listen EADDRINUSE: address already in use :::4000
```

Find and kill the existing process:

**Windows (PowerShell)**:
```powershell
netstat -ano | findstr :4000
taskkill /PID <pid> /F
```

**macOS/Linux**:
```bash
lsof -ti:4000 | xargs kill
```

### Frontend cannot reach the API

The Vite dev server proxies `/api` → `http://localhost:4000`. If the backend is on a different port, update `vite.config.js`:

```js
proxy: {
  '/api': {
    target: 'http://localhost:YOUR_PORT',
    changeOrigin: true,
  }
}
```

### PostgreSQL `pg_hba.conf` authentication error

On some Linux installs, PostgreSQL uses `peer` authentication. Switch to `md5`:

```bash
sudo nano /etc/postgresql/14/main/pg_hba.conf
# Change: local all postgres peer
# To:     local all postgres md5
sudo systemctl reload postgresql
```
