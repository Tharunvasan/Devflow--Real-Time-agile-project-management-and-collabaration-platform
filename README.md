# DevFlow – Agile Project Management & Collaboration Platform

<div align="center">
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript" />
  <img src="https://img.shields.io/badge/Node.js-22-339933?style=for-the-badge&logo=node.js" />
  <img src="https://img.shields.io/badge/MongoDB-7-47A248?style=for-the-badge&logo=mongodb" />
  <img src="https://img.shields.io/badge/Socket.IO-4-010101?style=for-the-badge&logo=socket.io" />
  <img src="https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker" />
</div>

---

## Overview

**DevFlow** is a full-stack, production-quality Agile Project Management platform built with the MERN stack. It provides a centralized workspace for software teams to manage projects, tasks, sprints, bugs, and collaborate in real-time.

Built as a B.Tech final year project demonstrating modern full-stack development practices.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🔐 **JWT Authentication** | Register, login, protected routes, role-based access |
| 📁 **Project Management** | Create, manage projects, add/remove team members |
| ✅ **Task Management** | Create, assign, prioritize, and track tasks |
| 🗂️ **Kanban Board** | Drag-and-drop tasks across TODO → IN PROGRESS → IN REVIEW → DONE |
| 🏃 **Sprint Management** | Plan, start, complete sprints with progress tracking |
| 🐛 **Issue Tracking** | Report, assign, and resolve bugs with severity levels |
| 💬 **Comments** | Comment on tasks and issues |
| 🔔 **Notifications** | Real-time in-app notifications |
| 📊 **Dashboard** | Live statistics with Recharts visualizations |
| ⚡ **Real-time Collaboration** | Socket.IO broadcasts task/issue updates instantly |
| 👥 **Role-Based Access** | Admin, Project Manager, Developer, Tester roles |
| 🐳 **Docker Support** | Full containerization with docker-compose |

---

## 🛠️ Technology Stack

### Frontend
- React 18 + TypeScript
- Vite 5 (build tool)
- React Router v6 (routing)
- Tailwind CSS (styling)
- Axios (HTTP client)
- Socket.IO Client (real-time)
- @dnd-kit (drag-and-drop)
- Recharts (charts)
- react-hot-toast (notifications)
- date-fns (date formatting)

### Backend
- Node.js 22 + Express 4
- TypeScript 5
- MongoDB 7 + Mongoose 8
- Socket.IO 4 (real-time)
- JWT (authentication)
- bcryptjs (password hashing)
- express-validator (input validation)
- helmet + express-rate-limit (security)
- winston + morgan (logging)

### DevOps
- Docker + Docker Compose
- Git + GitHub

---

## 📁 Project Structure

```
DevFlow/
├── frontend/               # React + TypeScript + Vite
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Route-level pages
│   │   ├── layouts/        # App shell layout
│   │   ├── services/       # Axios API layer
│   │   ├── context/        # Auth + Socket contexts
│   │   └── types/          # TypeScript interfaces
│   ├── Dockerfile
│   └── nginx.conf
│
├── backend/                # Node.js + Express + TypeScript
│   ├── src/
│   │   ├── config/         # DB connection, config
│   │   ├── controllers/    # Request handlers
│   │   ├── middleware/     # Auth, validation, errors
│   │   ├── models/         # 7 Mongoose models
│   │   ├── routes/         # API route definitions
│   │   ├── sockets/        # Socket.IO manager
│   │   └── utils/          # JWT, logger
│   └── Dockerfile
│
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 🚀 Running Locally

### Prerequisites
- Node.js 18+
- MongoDB 7 (local or MongoDB Atlas)
- npm 9+

### 1. Clone the repository
```bash
git clone https://github.com/yourusername/devflow.git
cd devflow
```

### 2. Setup Backend
```bash
cd backend
cp .env .env.local   # Edit with your values
npm install
npm run dev          # Starts on http://localhost:5000
```

### 3. Setup Frontend
```bash
cd frontend
npm install
npm run dev          # Starts on http://localhost:5173
```

---

## 🐳 Running with Docker

```bash
# Start all services (MongoDB + Backend + Frontend)
docker compose up --build

# Access the app at:
# Frontend: http://localhost:3000
# Backend:  http://localhost:5000
# MongoDB:  localhost:27017
```

---

## 🔌 API Overview

| Module | Base Path | Methods |
|--------|-----------|---------|
| Auth | `/api/auth` | POST register, POST login, GET me, PUT profile/password |
| Users | `/api/users` | GET, PUT, DELETE (Admin) |
| Projects | `/api/projects` | Full CRUD + member management |
| Tasks | `/api/tasks` | Full CRUD + filtering |
| Sprints | `/api/sprints` | Full CRUD + task management |
| Issues | `/api/issues` | Full CRUD + filtering |
| Comments | `/api/comments` | CRUD for tasks/issues |
| Notifications | `/api/notifications` | GET, mark read |
| Dashboard | `/api/dashboard` | GET stats |

---

## 🗄️ Database Models

| Model | Key Fields |
|-------|-----------|
| User | name, email, password(hashed), role, isActive |
| Project | name, status, createdBy, members[] |
| Task | title, status, priority, project, sprint, assignedTo |
| Sprint | name, goal, startDate, endDate, status, tasks[] |
| Issue | title, severity, priority, status, reportedBy |
| Comment | content, author, task?, issue? |
| Notification | recipient, type, message, read |

---

## 👥 User Roles

| Role | Capabilities |
|------|-------------|
| **Admin** | Full access + user management |
| **Project Manager** | Projects, sprints, tasks, issues |
| **Developer** | Tasks, comments, issues |
| **Tester** | Issues, bug verification, comments |

---

## ⚡ Real-time Events (Socket.IO)

- `task:created` / `task:updated` / `task:deleted`
- `issue:created` / `issue:updated`
- `sprint:started` / `sprint:completed`
- `comment:new`
- `notification:new`
- `member:added`

---

## 🔐 Environment Variables

```env
# Backend (.env)
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/devflow
JWT_SECRET=your_super_secret_key
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173

# Frontend (.env)
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

---

## 📸 Screenshots

> Register → Login → Dashboard → Projects → Kanban Board → Sprints → Issues → Notifications

---

## 🔗 GitHub Integration

DevFlow supports integrating projects with GitHub repositories. The current implementation provides the configuration API and a webhook receiver endpoint (`/api/github/webhook/:projectId`) that parses commit messages and pull requests to automatically transition linked tasks (e.g., closing a task when a commit message says "Fixes #<task-id>").

### Setting up a Real GitHub App
To fully utilize this in production with real credentials, you must:
1. Create a [GitHub App](https://docs.github.com/en/apps/creating-github-apps) in your developer settings.
2. Grant it **Read & Write** access to Code and Pull Requests.
3. Subscribe to the `push` and `pull_request` events.
4. Set the Webhook URL to `https://your-domain.com/api/github/webhook/<projectId>`.
5. Set a Webhook Secret and configure `GITHUB_WEBHOOK_SECRET` in your backend `.env` to verify the `x-hub-signature-256` payload signatures.
6. (Optional) Implement the full OAuth flow by configuring `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` in `.env` to acquire user-level access tokens instead of manual token entry.

---

## 🔮 Future Enhancements

- [ ] File attachments on tasks/issues
- [ ] Gantt chart view
- [ ] Time tracking
- [ ] Email notifications
- [ ] Dark/light theme toggle
- [ ] Mobile app (React Native)
- [ ] CI/CD pipeline integration

---

## 👨‍💻 Developer

Built as a B.Tech final-year MERN Stack project.

---

*DevFlow – Built with ❤️ using MERN Stack*
