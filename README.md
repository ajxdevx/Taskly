# Taskly

**Author:** [Ajxdevx](https://github.com/ajxdevx)  
**Repository:** [github.com/ajxdevx/Taskly](https://github.com/ajxdevx/Taskly)

Taskly is a full-stack work management app by **Ajxdevx**: dashboards, Kanban (drag-and-drop), sprints, calendar, team view, comments, time tracking, analytics, notifications, and audit logs.

## Sign in

Only one account is seeded for local development:

| Field    | Value                 |
| -------- | --------------------- |
| Name     | Ajxdevx               |
| Email    | `ajxdevx@taskly.io`   |
| Password | `demo`                |

Run `.\start-local.ps1` — the API **automatically resets** outdated seed data on startup if your Ajxdevx account is missing.

## Tech stack

- **Frontend:** React, TypeScript, Vite
- **Backend:** FastAPI, SQLAlchemy
- **Database:** SQLite (`backend/taskly.db`) or PostgreSQL via `DATABASE_URL`
- **Auth:** JWT, PBKDF2 password hashing
- **Ops:** Docker Compose, Nginx, GitHub Actions CI

## Run locally (Windows)

```powershell
.\start-local.ps1
```

- App: [http://localhost:5173](http://localhost:5173)
- API docs: [http://localhost:8000/docs](http://localhost:8000/docs)

## Run locally (Linux / macOS)

```bash
./start-local.sh
```

## Docker

```bash
docker compose up --build
```

- App: [http://localhost:8080](http://localhost:8080)
- API docs: [http://localhost:8000/docs](http://localhost:8000/docs)

## Verify

**Backend**

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
pytest -q
```

**Frontend**

```bash
cd frontend
npm install
npm run build
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [API modules](docs/API_MODULES.md)
- [Roles and permissions](docs/ROLES_AND_PERMISSIONS.md)

---

© **Ajxdevx** — Taskly
