# TechnoElevate — Deployment Guide

Options for deploying TechnoElevate to production.

---

## Overview

TechnoElevate has three components to deploy:

| Component | Technology | Options |
|-----------|-----------|---------|
| **Database** | PostgreSQL | Supabase, Railway, Render, Neon, self-hosted |
| **Backend** | Node.js / Express | Railway, Render, Fly.io, VPS |
| **Frontend** | React / Vite (static build) | Vercel, Netlify, Render, Nginx |

---

## Option A — Railway (Recommended for quick deployment)

Railway can host the database, backend, and frontend in a single project.

### 1. Push your code to GitHub

```bash
git add .
git commit -m "ready for deployment"
git push origin main
```

### 2. Create a Railway project

1. Go to https://railway.app and create a new project
2. Click **Add Service → GitHub Repo** and select your repo

### 3. Add PostgreSQL

1. In your Railway project, click **Add Service → Database → PostgreSQL**
2. Railway will provision a database and expose `DATABASE_URL`

### 4. Configure the backend service

Set environment variables in Railway for the backend service:

```
PORT=4000
DB_HOST=${{Postgres.PGHOST}}
DB_PORT=${{Postgres.PGPORT}}
DB_NAME=${{Postgres.PGDATABASE}}
DB_USER=${{Postgres.PGUSER}}
DB_PASSWORD=${{Postgres.PGPASSWORD}}
```

Set the **root directory** to `backend` and the **start command** to `npm start`.

### 5. Seed the database

In the Railway shell for the backend service:

```bash
node seed.js
```

### 6. Configure the frontend service

Add another service for the frontend:
- Root directory: `frontend`
- Build command: `npm run build`
- Start command: `npx serve dist` (or use static hosting)
- Add environment variable: `VITE_API_URL=https://<your-backend-url>`

Update `vite.config.js` to use `VITE_API_URL` in production (see below).

---

## Option B — Render

### Database on Render

1. Create a **PostgreSQL** instance in Render
2. Note the **External Database URL**

### Backend on Render

1. Create a new **Web Service**, connect your GitHub repo
2. Root directory: `backend`
3. Build command: `npm install`
4. Start command: `npm start`
5. Environment variables:
   ```
   PORT=4000
   DB_HOST=<render-db-host>
   DB_PORT=5432
   DB_NAME=<db-name>
   DB_USER=<db-user>
   DB_PASSWORD=<db-password>
   ```

### Frontend on Render

1. Create a **Static Site**, connect your GitHub repo
2. Root directory: `frontend`
3. Build command: `npm install && npm run build`
4. Publish directory: `dist`
5. Add environment variable: `VITE_API_URL=https://<render-backend-url>`

---

## Option C — Vercel (Frontend) + Fly.io (Backend) + Supabase (DB)

### Database — Supabase

1. Create a project at https://supabase.com
2. Go to **Settings → Database** for the connection string
3. In the SQL Editor, paste the contents of `backend/schema.sql` and run it
4. Then run your seed data manually or use the Supabase API

### Backend — Fly.io

```bash
npm install -g flyctl
fly auth login
cd backend
fly launch         # creates fly.toml
fly secrets set DB_HOST=... DB_PORT=... DB_NAME=... DB_USER=... DB_PASSWORD=...
fly deploy
```

### Frontend — Vercel

```bash
npm install -g vercel
cd frontend
vercel
```

Set environment variable `VITE_API_URL` to your Fly.io backend URL.

---

## Option D — Self-hosted VPS (Nginx + PM2)

### Prerequisites

- Ubuntu 22.04 VPS (e.g., DigitalOcean, Linode, Hetzner)
- Nginx
- Node.js 18+
- PostgreSQL 14+
- PM2 (process manager)

### 1. Install dependencies

```bash
sudo apt update
sudo apt install -y nodejs npm postgresql nginx
npm install -g pm2
```

### 2. Clone the repo

```bash
cd /var/www
sudo git clone <repo-url> techno-elevate
sudo chown -R $USER:$USER /var/www/techno-elevate
```

### 3. Set up PostgreSQL

```bash
sudo -u postgres psql -c "CREATE USER teuser WITH PASSWORD 'your_password';"
sudo -u postgres psql -c "CREATE DATABASE techno_elevate OWNER teuser;"
```

### 4. Configure environment

```bash
cd /var/www/techno-elevate/backend
cp .env.example .env
nano .env   # fill in credentials
```

### 5. Install, seed, and start backend

```bash
cd backend
npm install
node seed.js
pm2 start server.js --name techno-backend
pm2 save
pm2 startup   # follow the printed command to enable auto-start
```

### 6. Build frontend

```bash
cd ../frontend
npm install
VITE_API_URL=https://yourdomain.com npm run build
```

### 7. Configure Nginx

```nginx
# /etc/nginx/sites-available/techno-elevate

server {
    listen 80;
    server_name yourdomain.com;

    # Frontend (static files)
    root /var/www/techno-elevate/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API proxy
    location /api {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/techno-elevate /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 8. SSL with Let's Encrypt

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

---

## Frontend Build Configuration

For any production deployment, update the API URL in the Vite config or use an environment variable.

### `frontend/vite.config.js` — production-aware proxy

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
}));
```

For production builds where the frontend and backend are on different domains, use `fetch` with a base URL from `import.meta.env.VITE_API_URL` and set the env var at build time.

---

## Environment Checklist Before Go-Live

- [ ] Strong `DB_PASSWORD` set (not `postgres`)
- [ ] CORS restricted to your frontend domain in `server.js`
- [ ] HTTPS enabled (Let's Encrypt / platform TLS)
- [ ] Database backed up (daily snapshots)
- [ ] PM2 or platform restart policy configured
- [ ] Demo credentials removed or changed
- [ ] Admin routes protected with authentication middleware
- [ ] Rate limiting added to the Express app (`express-rate-limit`)
- [ ] Helmet middleware added (`helmet` package) for HTTP security headers
