# Taskly Architecture

## Runtime topology

- **Web client:** React + TypeScript + Vite, delivered by Nginx in containers.
- **Application API:** FastAPI with explicit role checks, JWT access tokens and structured OpenAPI documentation.
- **Persistence:** SQLAlchemy ORM. SQLite is the zero-configuration local default; `DATABASE_URL` can point to PostgreSQL for production.
- **Deployment:** Docker Compose for a two-service deployment; persistent database volume; health-gated frontend startup.

## Domain model

Organization → Workspace → Project → Sprint → Task. Tasks support many assignees, parent work items, comments, time entries, priorities, labels, story points and governed workflow transitions.

## Security model

JWT authentication, PBKDF2-SHA256 password storage, organization scoping, actor-specific API authorization, immutable audit events, inactive-user enforcement and environment-based secrets.

## Production hardening checklist

Use PostgreSQL, place services behind TLS, rotate secrets, configure a restricted CORS allowlist, add SSO/OIDC, enforce MFA for privileged roles, use object storage for attachments, connect a transactional email provider, centralize logs, add backups, rate limiting, vulnerability scanning and observability.
