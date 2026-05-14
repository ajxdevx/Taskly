from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, timedelta
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from .auth import create_access_token, get_current_user, hash_password, require_roles, verify_password
from .db import Base, engine, get_db
from .models import AuditLog, Comment, Notification, Project, Sprint, Task, TimeEntry, User, Workspace
from .schemas import CommentCreate, LoginRequest, NotificationUpdate, ProjectCreate, SprintCreate, StatusUpdate, TaskCreate, TaskUpdate, TimeEntryCreate, UserCreate
from .seed import ensure_seeded

app = FastAPI(
    title="Taskly API",
    version="1.0.0",
    description="Enterprise work management platform for projects, sprints, tasks, collaboration, analytics and governance.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5174", "http://127.0.0.1:5174", "http://localhost:3000", "http://localhost:8080"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ADMIN_ROLES = ("super_admin", "org_admin")
MANAGEMENT_ROLES = ADMIN_ROLES + ("project_manager", "team_lead")
DELIVERY_ROLES = MANAGEMENT_ROLES + ("developer", "designer", "qa_engineer")
ALL_ROLES = DELIVERY_ROLES + ("client", "auditor")
VALID_STATUSES = {"backlog", "in_progress", "review", "completed", "blocked"}


@app.on_event("startup")
def startup() -> None:
    ensure_seeded()


def add_audit(db: Session, actor: User, action: str, entity_type: str, entity_id: int | str, details: str = "") -> None:
    db.add(AuditLog(actor_id=actor.id, action=action, entity_type=entity_type, entity_id=str(entity_id), details=details))


def serialize_user(user: User) -> dict:
    return {
        "id": user.id,
        "full_name": user.full_name,
        "email": user.email,
        "role": user.role,
        "title": user.title,
        "avatar": user.avatar or "".join(part[0] for part in user.full_name.split()[:2]).upper(),
        "timezone": user.timezone,
        "is_active": user.is_active,
    }


def serialize_project(project: Project) -> dict:
    completed = len([task for task in project.tasks if task.status == "completed"])
    progress = round(100 * completed / max(1, len(project.tasks)))
    return {
        "id": project.id,
        "workspace_id": project.workspace_id,
        "name": project.name,
        "key": project.key,
        "description": project.description,
        "status": project.status,
        "priority": project.priority,
        "color": project.color,
        "start_date": project.start_date.isoformat() if project.start_date else None,
        "target_date": project.target_date.isoformat() if project.target_date else None,
        "budget": project.budget,
        "owner": serialize_user(project.owner),
        "members": [serialize_user(member) for member in project.members],
        "task_count": len(project.tasks),
        "completed_count": completed,
        "progress": progress,
    }


def serialize_task(task: Task, include_details: bool = False) -> dict:
    data = {
        "id": task.id,
        "task_number": task.task_number,
        "project_id": task.project_id,
        "project_name": task.project.name if task.project else None,
        "project_key": task.project.key if task.project else None,
        "sprint_id": task.sprint_id,
        "sprint_name": task.sprint.name if task.sprint else None,
        "title": task.title,
        "description": task.description,
        "status": task.status,
        "priority": task.priority,
        "task_type": task.task_type,
        "labels": [item for item in task.labels.split(",") if item],
        "story_points": task.story_points,
        "progress": task.progress,
        "due_date": task.due_date.isoformat() if task.due_date else None,
        "estimate_minutes": task.estimate_minutes,
        "logged_minutes": task.logged_minutes,
        "assignees": [serialize_user(user) for user in task.assignees],
        "reporter": serialize_user(task.reporter),
        "comments_count": len(task.comments),
        "created_at": task.created_at.isoformat(),
        "updated_at": task.updated_at.isoformat(),
    }
    if include_details:
        data["comments"] = [
            {
                "id": comment.id,
                "body": comment.body,
                "author": serialize_user(comment.author),
                "created_at": comment.created_at.isoformat(),
            }
            for comment in sorted(task.comments, key=lambda item: item.created_at)
        ]
        data["time_entries"] = [
            {
                "id": entry.id,
                "minutes": entry.minutes,
                "note": entry.note,
                "user": serialize_user(entry.user),
                "work_date": entry.work_date.isoformat(),
            }
            for entry in sorted(task.time_entries, key=lambda item: item.work_date, reverse=True)
        ]
    return data


def task_query():
    return select(Task).options(
        selectinload(Task.project),
        selectinload(Task.sprint),
        selectinload(Task.reporter),
        selectinload(Task.assignees),
        selectinload(Task.comments).selectinload(Comment.author),
        selectinload(Task.time_entries).selectinload(TimeEntry.user),
    )


def project_query():
    return select(Project).options(
        selectinload(Project.owner),
        selectinload(Project.members),
        selectinload(Project.tasks),
    )


def can_edit_task(user: User, task: Task) -> bool:
    if user.role in MANAGEMENT_ROLES:
        return True
    return user.role in {"developer", "designer", "qa_engineer"} and any(item.id == user.id for item in task.assignees)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "taskly-api"}


@app.post("/api/auth/login")
def login(payload: LoginRequest, db: Annotated[Session, Depends(get_db)]) -> dict:
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if not user or not user.is_active or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    return {"access_token": create_access_token(user), "token_type": "bearer", "user": serialize_user(user)}


@app.get("/api/auth/me")
def me(user: Annotated[User, Depends(get_current_user)]) -> dict:
    return serialize_user(user)


@app.get("/api/workspaces")
def list_workspaces(user: Annotated[User, Depends(get_current_user)], db: Annotated[Session, Depends(get_db)]) -> list[dict]:
    items = db.scalars(select(Workspace).where(Workspace.organization_id == user.organization_id)).all()
    return [{"id": item.id, "name": item.name, "key": item.key, "description": item.description} for item in items]


@app.get("/api/users")
def list_users(user: Annotated[User, Depends(get_current_user)], db: Annotated[Session, Depends(get_db)]) -> list[dict]:
    items = db.scalars(select(User).where(User.organization_id == user.organization_id).order_by(User.full_name)).all()
    return [serialize_user(item) for item in items]


@app.post("/api/users", status_code=201)
def create_user(payload: UserCreate, user: Annotated[User, Depends(require_roles(*ADMIN_ROLES))], db: Annotated[Session, Depends(get_db)]) -> dict:
    if payload.role not in ALL_ROLES:
        raise HTTPException(status_code=400, detail="Unsupported role")
    if db.scalar(select(User.id).where(User.email == payload.email.lower())):
        raise HTTPException(status_code=409, detail="Email already exists")
    item = User(
        organization_id=user.organization_id,
        full_name=payload.full_name,
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        role=payload.role,
        title=payload.title,
        avatar=payload.avatar,
    )
    db.add(item)
    db.flush()
    add_audit(db, user, "create", "user", item.id, f"Created {item.email} as {item.role}")
    db.commit()
    return serialize_user(item)


@app.get("/api/projects")
def list_projects(user: Annotated[User, Depends(get_current_user)], db: Annotated[Session, Depends(get_db)]) -> list[dict]:
    stmt = project_query().join(Workspace).where(Workspace.organization_id == user.organization_id).order_by(Project.created_at.desc())
    return [serialize_project(item) for item in db.scalars(stmt).unique().all()]


@app.post("/api/projects", status_code=201)
def create_project(payload: ProjectCreate, user: Annotated[User, Depends(require_roles(*MANAGEMENT_ROLES))], db: Annotated[Session, Depends(get_db)]) -> dict:
    key = payload.key.upper().strip()
    if db.scalar(select(Project.id).where(Project.key == key)):
        raise HTTPException(status_code=409, detail="Project key already exists")
    workspace = db.scalar(select(Workspace).where(Workspace.id == payload.workspace_id, Workspace.organization_id == user.organization_id))
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    members = list(db.scalars(select(User).where(User.id.in_(payload.member_ids), User.organization_id == user.organization_id)).all()) if payload.member_ids else []
    project = Project(
        workspace_id=payload.workspace_id,
        owner_id=user.id,
        name=payload.name,
        key=key,
        description=payload.description,
        priority=payload.priority,
        color=payload.color,
        start_date=payload.start_date,
        target_date=payload.target_date,
        budget=payload.budget,
    )
    project.members = members
    db.add(project)
    db.flush()
    add_audit(db, user, "create", "project", project.id, project.name)
    db.commit()
    project = db.scalar(project_query().where(Project.id == project.id))
    return serialize_project(project)


@app.get("/api/projects/{project_id}")
def get_project(project_id: int, user: Annotated[User, Depends(get_current_user)], db: Annotated[Session, Depends(get_db)]) -> dict:
    project = db.scalar(project_query().where(Project.id == project_id))
    if not project or project.workspace.organization_id != user.organization_id:
        raise HTTPException(status_code=404, detail="Project not found")
    return serialize_project(project)


@app.get("/api/sprints")
def list_sprints(user: Annotated[User, Depends(get_current_user)], db: Annotated[Session, Depends(get_db)], project_id: int | None = None) -> list[dict]:
    stmt = select(Sprint).options(selectinload(Sprint.project), selectinload(Sprint.tasks)).join(Project).join(Workspace).where(Workspace.organization_id == user.organization_id)
    if project_id:
        stmt = stmt.where(Sprint.project_id == project_id)
    items = db.scalars(stmt.order_by(Sprint.start_date.desc())).unique().all()
    return [
        {
            "id": item.id,
            "project_id": item.project_id,
            "project_name": item.project.name,
            "name": item.name,
            "goal": item.goal,
            "status": item.status,
            "start_date": item.start_date.isoformat() if item.start_date else None,
            "end_date": item.end_date.isoformat() if item.end_date else None,
            "capacity_points": item.capacity_points,
            "committed_points": sum(task.story_points for task in item.tasks),
            "completed_points": sum(task.story_points for task in item.tasks if task.status == "completed"),
        }
        for item in items
    ]


@app.post("/api/sprints", status_code=201)
def create_sprint(payload: SprintCreate, user: Annotated[User, Depends(require_roles(*MANAGEMENT_ROLES))], db: Annotated[Session, Depends(get_db)]) -> dict:
    project = db.scalar(select(Project).where(Project.id == payload.project_id))
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    item = Sprint(**payload.model_dump(), status="planned")
    db.add(item)
    db.flush()
    add_audit(db, user, "create", "sprint", item.id, item.name)
    db.commit()
    return {"id": item.id, **payload.model_dump(mode="json"), "status": item.status}


@app.get("/api/tasks")
def list_tasks(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    project_id: int | None = None,
    status: str | None = None,
    priority: str | None = None,
    assignee_id: int | None = None,
    search: str | None = None,
    limit: int = Query(default=200, ge=1, le=500),
) -> list[dict]:
    stmt = task_query().join(Project).join(Workspace).where(Workspace.organization_id == user.organization_id)
    if project_id:
        stmt = stmt.where(Task.project_id == project_id)
    if status:
        stmt = stmt.where(Task.status == status)
    if priority:
        stmt = stmt.where(Task.priority == priority)
    if assignee_id:
        stmt = stmt.where(Task.assignees.any(User.id == assignee_id))
    if search:
        term = f"%{search.lower()}%"
        stmt = stmt.where(func.lower(Task.title).like(term) | func.lower(Task.task_number).like(term))
    items = db.scalars(stmt.order_by(Task.updated_at.desc()).limit(limit)).unique().all()
    return [serialize_task(item) for item in items]


@app.post("/api/tasks", status_code=201)
def create_task(payload: TaskCreate, user: Annotated[User, Depends(require_roles(*DELIVERY_ROLES))], db: Annotated[Session, Depends(get_db)]) -> dict:
    project = db.scalar(project_query().where(Project.id == payload.project_id))
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    count = db.scalar(select(func.count(Task.id)).where(Task.project_id == project.id)) or 0
    assignees = list(db.scalars(select(User).where(User.id.in_(payload.assignee_ids), User.organization_id == user.organization_id)).all()) if payload.assignee_ids else []
    task = Task(
        project_id=payload.project_id,
        sprint_id=payload.sprint_id,
        reporter_id=user.id,
        parent_task_id=payload.parent_task_id,
        task_number=f"{project.key}-{count + 1}",
        title=payload.title,
        description=payload.description,
        status=payload.status,
        priority=payload.priority,
        task_type=payload.task_type,
        labels=",".join(payload.labels),
        story_points=payload.story_points,
        progress=payload.progress,
        due_date=payload.due_date,
        estimate_minutes=payload.estimate_minutes,
    )
    task.assignees = assignees
    db.add(task)
    db.flush()
    for assignee in assignees:
        db.add(Notification(user_id=assignee.id, title="New task assigned", message=f"{task.task_number}: {task.title}", kind="assignment"))
    add_audit(db, user, "create", "task", task.id, task.task_number)
    db.commit()
    task = db.scalar(task_query().where(Task.id == task.id))
    return serialize_task(task, include_details=True)


@app.get("/api/tasks/{task_id}")
def get_task(task_id: int, user: Annotated[User, Depends(get_current_user)], db: Annotated[Session, Depends(get_db)]) -> dict:
    task = db.scalar(task_query().where(Task.id == task_id))
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return serialize_task(task, include_details=True)


@app.patch("/api/tasks/{task_id}")
def update_task(task_id: int, payload: TaskUpdate, user: Annotated[User, Depends(get_current_user)], db: Annotated[Session, Depends(get_db)]) -> dict:
    task = db.scalar(task_query().where(Task.id == task_id))
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if not can_edit_task(user, task):
        raise HTTPException(status_code=403, detail="You cannot modify this task")
    changes = payload.model_dump(exclude_unset=True)
    assignee_ids = changes.pop("assignee_ids", None)
    labels = changes.pop("labels", None)
    if labels is not None:
        task.labels = ",".join(labels)
    if assignee_ids is not None:
        task.assignees = list(db.scalars(select(User).where(User.id.in_(assignee_ids), User.organization_id == user.organization_id)).all()) if assignee_ids else []
    for field, value in changes.items():
        setattr(task, field, value)
    if task.status == "completed":
        task.progress = 100
    task.updated_at = datetime.utcnow()
    add_audit(db, user, "update", "task", task.id, f"Updated: {', '.join(payload.model_fields_set)}")
    db.commit()
    task = db.scalar(task_query().where(Task.id == task.id))
    return serialize_task(task, include_details=True)


@app.patch("/api/tasks/{task_id}/status")
def update_task_status(task_id: int, payload: StatusUpdate, user: Annotated[User, Depends(get_current_user)], db: Annotated[Session, Depends(get_db)]) -> dict:
    if payload.status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail="Unsupported task status")
    task = db.scalar(task_query().where(Task.id == task_id))
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if not can_edit_task(user, task):
        raise HTTPException(status_code=403, detail="You cannot modify this task")
    old = task.status
    task.status = payload.status
    task.progress = {"backlog": 0, "in_progress": max(task.progress, 25), "review": max(task.progress, 75), "completed": 100, "blocked": task.progress}.get(payload.status, task.progress)
    task.updated_at = datetime.utcnow()
    add_audit(db, user, "transition", "task", task.id, f"{old} → {payload.status}")
    db.commit()
    task = db.scalar(task_query().where(Task.id == task.id))
    return serialize_task(task)


@app.post("/api/tasks/{task_id}/comments", status_code=201)
def add_comment(task_id: int, payload: CommentCreate, user: Annotated[User, Depends(get_current_user)], db: Annotated[Session, Depends(get_db)]) -> dict:
    task = db.scalar(task_query().where(Task.id == task_id))
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    comment = Comment(task_id=task.id, author_id=user.id, body=payload.body)
    db.add(comment)
    db.flush()
    for assignee in task.assignees:
        if assignee.id != user.id:
            db.add(Notification(user_id=assignee.id, title=f"Comment on {task.task_number}", message=f"{user.full_name}: {payload.body[:100]}", kind="comment"))
    add_audit(db, user, "comment", "task", task.id, payload.body[:120])
    db.commit()
    return {"id": comment.id, "body": comment.body, "author": serialize_user(user), "created_at": comment.created_at.isoformat()}


@app.post("/api/tasks/{task_id}/time", status_code=201)
def log_time(task_id: int, payload: TimeEntryCreate, user: Annotated[User, Depends(require_roles(*DELIVERY_ROLES))], db: Annotated[Session, Depends(get_db)]) -> dict:
    task = db.scalar(task_query().where(Task.id == task_id))
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    entry = TimeEntry(task_id=task.id, user_id=user.id, minutes=payload.minutes, note=payload.note)
    task.logged_minutes += payload.minutes
    db.add(entry)
    add_audit(db, user, "log_time", "task", task.id, f"{payload.minutes} minutes")
    db.commit()
    return {"id": entry.id, "minutes": entry.minutes, "note": entry.note, "work_date": entry.work_date.isoformat()}


@app.get("/api/dashboard/summary")
def dashboard_summary(user: Annotated[User, Depends(get_current_user)], db: Annotated[Session, Depends(get_db)], project_id: int | None = None) -> dict:
    stmt = task_query().join(Project).join(Workspace).where(Workspace.organization_id == user.organization_id)
    if project_id:
        stmt = stmt.where(Task.project_id == project_id)
    tasks = list(db.scalars(stmt).unique().all())
    projects = list(db.scalars(project_query().join(Workspace).where(Workspace.organization_id == user.organization_id)).unique().all())
    now = datetime.utcnow()
    completed = [task for task in tasks if task.status == "completed"]
    overdue = [task for task in tasks if task.due_date and task.due_date < now and task.status != "completed"]
    due_soon = sorted([task for task in tasks if task.due_date and task.status != "completed"], key=lambda item: item.due_date)[:6]
    total_points = sum(task.story_points for task in tasks)
    completed_points = sum(task.story_points for task in completed)
    status_counts = Counter(task.status for task in tasks)
    priority_counts = Counter(task.priority for task in tasks)
    workload: dict[int, dict] = {}
    for task in tasks:
        if task.status == "completed":
            continue
        for assignee in task.assignees:
            row = workload.setdefault(assignee.id, {"user": serialize_user(assignee), "tasks": 0, "points": 0})
            row["tasks"] += 1
            row["points"] += task.story_points
    velocity = []
    for offset in range(7, 0, -1):
        label = f"S{14 - offset}"
        value = max(12, completed_points // 2 + ((offset * 7) % 15) - 3)
        velocity.append({"label": label, "points": value})
    activity_stmt = select(AuditLog).options(selectinload(AuditLog.actor)).order_by(AuditLog.created_at.desc()).limit(10)
    activities = db.scalars(activity_stmt).all()
    return {
        "metrics": {
            "total_tasks": len(tasks),
            "completed_tasks": len(completed),
            "overdue_tasks": len(overdue),
            "active_projects": len([item for item in projects if item.status == "active"]),
            "completion_rate": round(100 * len(completed) / max(1, len(tasks))),
            "velocity": completed_points,
            "total_points": total_points,
            "sprint_health": "Good" if len(overdue) <= 4 else "At Risk",
        },
        "status_counts": dict(status_counts),
        "priority_counts": dict(priority_counts),
        "workload": sorted(workload.values(), key=lambda item: item["points"], reverse=True),
        "due_soon": [serialize_task(task) for task in due_soon],
        "velocity_trend": velocity,
        "projects": [serialize_project(item) for item in projects],
        "activities": [
            {
                "id": item.id,
                "actor": serialize_user(item.actor) if item.actor else None,
                "action": item.action,
                "entity_type": item.entity_type,
                "entity_id": item.entity_id,
                "details": item.details,
                "created_at": item.created_at.isoformat(),
            }
            for item in activities
        ],
    }


@app.get("/api/analytics")
def analytics(user: Annotated[User, Depends(get_current_user)], db: Annotated[Session, Depends(get_db)]) -> dict:
    tasks = list(db.scalars(task_query().join(Project).join(Workspace).where(Workspace.organization_id == user.organization_id)).unique().all())
    by_project: dict[int, dict] = {}
    for task in tasks:
        row = by_project.setdefault(task.project_id, {"project": task.project.name, "total": 0, "completed": 0, "points": 0, "logged_hours": 0.0})
        row["total"] += 1
        row["completed"] += int(task.status == "completed")
        row["points"] += task.story_points
        row["logged_hours"] += task.logged_minutes / 60
    cycle_times = []
    for task in tasks:
        age = max(1, (task.updated_at - task.created_at).total_seconds() / 86400)
        cycle_times.append(age)
    return {
        "delivery": [
            {**row, "completion_rate": round(100 * row["completed"] / max(1, row["total"])), "logged_hours": round(row["logged_hours"], 1)}
            for row in by_project.values()
        ],
        "average_cycle_days": round(sum(cycle_times) / max(1, len(cycle_times)), 1),
        "total_logged_hours": round(sum(task.logged_minutes for task in tasks) / 60, 1),
        "blocked_count": len([task for task in tasks if task.status == "blocked"]),
        "high_priority_open": len([task for task in tasks if task.priority in {"high", "critical"} and task.status != "completed"]),
    }


@app.get("/api/notifications")
def notifications(user: Annotated[User, Depends(get_current_user)], db: Annotated[Session, Depends(get_db)], unread_only: bool = False) -> list[dict]:
    stmt = select(Notification).where(Notification.user_id == user.id)
    if unread_only:
        stmt = stmt.where(Notification.is_read.is_(False))
    items = db.scalars(stmt.order_by(Notification.created_at.desc()).limit(30)).all()
    return [{"id": item.id, "title": item.title, "message": item.message, "kind": item.kind, "is_read": item.is_read, "created_at": item.created_at.isoformat()} for item in items]


@app.patch("/api/notifications/{notification_id}")
def update_notification(notification_id: int, payload: NotificationUpdate, user: Annotated[User, Depends(get_current_user)], db: Annotated[Session, Depends(get_db)]) -> dict:
    item = db.scalar(select(Notification).where(Notification.id == notification_id, Notification.user_id == user.id))
    if not item:
        raise HTTPException(status_code=404, detail="Notification not found")
    item.is_read = payload.is_read
    db.commit()
    return {"id": item.id, "is_read": item.is_read}


@app.get("/api/audit-logs")
def audit_logs(user: Annotated[User, Depends(require_roles("super_admin", "org_admin", "auditor"))], db: Annotated[Session, Depends(get_db)], limit: int = Query(default=100, ge=1, le=500)) -> list[dict]:
    items = db.scalars(select(AuditLog).options(selectinload(AuditLog.actor)).order_by(AuditLog.created_at.desc()).limit(limit)).all()
    return [
        {
            "id": item.id,
            "actor": serialize_user(item.actor) if item.actor else None,
            "action": item.action,
            "entity_type": item.entity_type,
            "entity_id": item.entity_id,
            "details": item.details,
            "created_at": item.created_at.isoformat(),
        }
        for item in items
    ]
