# DevFlow Cloud Deployment Guide

This guide walks you through deploying **DevFlow** (Frontend + Backend + Real-time WebSockets + MongoDB) using free cloud tiers.

---

## Architecture Overview

```
                      ┌──────────────────────────────────────────────┐
                      │              MongoDB Atlas                   │
                      │         (Free M0 Managed Cluster)            │
                      └──────────────────────▲───────────────────────┘
                                             │
                                      (Mongoose M0)
                                             │
┌──────────────────────────────┐     REST API + WebSocket      ┌──────────────────────────────┐
│       Frontend (SPA)         ├──────────────────────────────►│       Backend (Node.js)      │
│  Render Static Site / Vercel │◄──────────────────────────────┤      Render Web Service      │
│     (React 19 + Vite 8)      │    (Socket.IO Real-time)      │  (Express 4 + Socket.IO 4)   │
└──────────────────────────────┘                               └──────────────────────────────┘
```

---

## Step 1: Set Up MongoDB Atlas (Database)

1. Sign up or log in at **[MongoDB Atlas](https://cloud.mongodb.com/)**.
2. Click **Create Deployment** → Select **M0 Free Tier** (AWS / any region).
3. Under **Security Quickstart**:
   - Create a database user (e.g. `devflow_admin`) and save the password.
4. Under **Network Access**:
   - Click **Add IP Address** → Choose **Allow Access from Anywhere (`0.0.0.0/0`)** so Render can connect.
5. Under **Clusters** → Click **Connect** → Choose **Drivers (Node.js)**.
6. Copy the connection string. It looks like:
   ```env
   mongodb+srv://devflow_admin:<password>@cluster0.xxxx.mongodb.net/devflow?retryWrites=true&w=majority
   ```
   *(Replace `<password>` with your database user password and `devflow` as the database name).*

---

## Step 2: Deploy Backend to Render

1. Log in to **[Render.com](https://dashboard.render.com/)**.
2. Click **New +** → **Web Service**.
3. Connect your GitHub repository:
   - `Tharunvasan/Devflow--Real-Time-agile-project-management-and-collabaration-platform`
4. Configure the Web Service settings:
   - **Name**: `devflow-backend`
   - **Region**: Oregon (or closest to you)
   - **Root Directory**: `backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm ci && npm run build`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free`
5. Expand **Advanced** → Add **Environment Variables**:
   | Key | Value | Notes |
   | :--- | :--- | :--- |
   | `NODE_ENV` | `production` | Enables production mode |
   | `PORT` | `10000` | Standard Render port |
   | `MONGO_URI` | `mongodb+srv://...` | Your MongoDB Atlas connection URI |
   | `JWT_SECRET` | *(click Generate or enter 32+ characters)* | JWT signing key |
   | `CLIENT_URL` | *(leave empty or enter your frontend domain)* | Supports comma-separated origins |
6. Set **Health Check Path** to: `/api/health`.
7. Click **Create Web Service**.
8. Wait for deployment to finish. Once live, note down your Backend URL:
   `https://devflow-backend-xxxx.onrender.com`

> [!TIP]
> Test your backend health check by visiting:
> `https://<your-backend-url>/api/health`
> It should return: `{"status":"ok","timestamp":"...","uptime":...}`

---

## Step 3: Deploy Frontend

You can deploy the frontend on either **Render Static Site** or **Vercel**.

### Option A: Deploy on Vercel (Fastest)

1. Log in to **[Vercel](https://vercel.com/)** and click **Add New...** → **Project**.
2. Import `Tharunvasan/Devflow--Real-Time-agile-project-management-and-collabaration-platform`.
3. In project settings:
   - **Framework Preset**: Vite
   - **Root Directory**: Click edit and select `frontend`
4. Expand **Environment Variables** and add:
   | Key | Value |
   | :--- | :--- |
   | `VITE_API_URL` | `https://<your-backend-url>/api` |
   | `VITE_SOCKET_URL` | `https://<your-backend-url>` |
5. Click **Deploy**. Vercel will build and assign you a domain like `https://devflow-frontend.vercel.app`.
*(Note: Client routing is handled automatically by [frontend/vercel.json](file:///d:/DevFlow/frontend/vercel.json)).*

### Option B: Deploy on Render Static Site

1. In Render Dashboard, click **New +** → **Static Site**.
2. Connect the same repository.
3. Configure settings:
   - **Root Directory**: `frontend`
   - **Build Command**: `npm ci && npm run build`
   - **Publish Directory**: `dist`
4. Add **Environment Variables**:
   - `VITE_API_URL` = `https://<your-backend-url>/api`
   - `VITE_SOCKET_URL` = `https://<your-backend-url>`
5. Under **Redirects/Rewrites**:
   - Source: `/*`
   - Destination: `/index.html`
   - Action: `Rewrite`
6. Click **Create Static Site**.

---

## Step 4: Link Frontend Domain to Backend CORS

1. Go back to your **Backend Service** on Render.
2. Under **Environment Variables**, update `CLIENT_URL` with your frontend URL:
   ```env
   CLIENT_URL=https://devflow-frontend.vercel.app
   ```
3. Save changes. Render will automatically redeploy the backend with the linked CORS origin.

---

## Step 5: Verification Checklist

- [ ] Backend health endpoint (`/api/health`) returns HTTP 200 `status: ok`.
- [ ] User registration (`/register`) creates a new user in MongoDB Atlas.
- [ ] User login (`/login`) issues a JWT token and loads the dashboard.
- [ ] Kanban drag-and-drop updates tasks in real time over WebSockets.
- [ ] Team members, sprints, comments, and notifications synchronize seamlessly.
