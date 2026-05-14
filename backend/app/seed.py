from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from .auth import hash_password
from .models import AuditLog, Comment, Notification, Organization, Project, Sprint, Task, TimeEntry, User, Workspace

OWNER_EMAIL = "ajxdevx@taskly.io"
OWNER_PASSWORD = "demo"


def ensure_seeded() -> None:
    """Create schema and seed Ajxdevx account; reset DB if an old multi-user seed is detected."""
    from .db import Base, engine

    Base.metadata.create_all(bind=engine)
    with Session(engine) as db:
        if db.scalar(select(User.id).where(User.email == OWNER_EMAIL)):
            return

    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with Session(engine) as db:
        seed_database(db)


def seed_database(db: Session) -> None:
    if db.scalar(select(Organization.id).where(Organization.slug == "taskly")):
        return

    org = Organization(name="Taskly", slug="taskly")
    db.add(org)
    db.flush()
    workspace = Workspace(
        organization_id=org.id,
        name="Ajxdevx Workspace",
        key="PROD",
        description="Personal Taskly workspace",
    )
    db.add(workspace)
    db.flush()

    owner = User(
        organization_id=org.id,
        full_name="Ajxdevx",
        email=OWNER_EMAIL,
        password_hash=hash_password(OWNER_PASSWORD),
        role="super_admin",
        title="Creator",
        avatar="AX",
    )
    db.add(owner)
    db.flush()

    now = datetime.utcnow()
    projects = [
        Project(
            workspace_id=workspace.id,
            owner_id=owner.id,
            name="Website Redesign",
            key="WEB",
            description="Modernize the public product experience and improve conversion.",
            priority="high",
            color="emerald",
            start_date=now - timedelta(days=20),
            target_date=now + timedelta(days=40),
            budget=85000,
        ),
        Project(
            workspace_id=workspace.id,
            owner_id=owner.id,
            name="Mobile App Launch",
            key="MOB",
            description="Release the cross-platform mobile application.",
            priority="critical",
            color="emerald",
            start_date=now - timedelta(days=10),
            target_date=now + timedelta(days=65),
            budget=140000,
        ),
        Project(
            workspace_id=workspace.id,
            owner_id=owner.id,
            name="Q3 Marketing Campaign",
            key="MKT",
            description="Coordinate product launch campaigns across channels.",
            priority="medium",
            color="amber",
            start_date=now,
            target_date=now + timedelta(days=75),
            budget=60000,
        ),
        Project(
            workspace_id=workspace.id,
            owner_id=owner.id,
            name="Product Roadmap",
            key="ROAD",
            description="Plan strategic product milestones and dependencies.",
            priority="high",
            color="blue",
            start_date=now - timedelta(days=45),
            target_date=now + timedelta(days=120),
            budget=0,
        ),
    ]
    for project in projects:
        project.members = [owner]
        db.add(project)
    db.flush()
    web, mobile, marketing, roadmap = projects

    sprint1 = Sprint(
        project_id=web.id,
        name="Sprint 12 — Conversion",
        goal="Ship responsive UI kit and complete feedback review",
        status="active",
        start_date=now - timedelta(days=5),
        end_date=now + timedelta(days=9),
        capacity_points=45,
    )
    sprint2 = Sprint(
        project_id=mobile.id,
        name="Sprint 7 — Beta",
        goal="Finish beta readiness and release validation",
        status="active",
        start_date=now - timedelta(days=2),
        end_date=now + timedelta(days=12),
        capacity_points=52,
    )
    sprint3 = Sprint(
        project_id=web.id,
        name="Sprint 13 — Launch",
        goal="Final accessibility, performance and launch checklist",
        status="planned",
        start_date=now + timedelta(days=10),
        end_date=now + timedelta(days=24),
        capacity_points=40,
    )
    db.add_all([sprint1, sprint2, sprint3])
    db.flush()

    task_specs = [
        (web, sprint1, "Redesign landing page", "backlog", "high", "story", 8, 10, 12, "design,conversion"),
        (web, sprint1, "Improve SEO performance", "backlog", "medium", "task", 5, 0, 18, "seo,performance"),
        (web, sprint1, "Create visual style guide", "backlog", "low", "task", 3, 15, 24, "design-system"),
        (web, sprint1, "Implement new UI kit", "in_progress", "high", "story", 8, 62, 7, "frontend,design-system"),
        (web, sprint1, "Build responsive components", "in_progress", "medium", "task", 5, 50, 9, "frontend,responsive"),
        (web, sprint1, "Optimize page assets", "in_progress", "low", "task", 3, 45, 13, "performance"),
        (web, sprint1, "User feedback analysis", "review", "medium", "task", 5, 75, 5, "research"),
        (web, sprint1, "Cross-browser testing", "review", "high", "bug", 5, 82, 6, "qa,browser"),
        (web, sprint1, "Accessibility audit", "review", "low", "task", 3, 68, 10, "a11y,qa"),
        (web, sprint1, "Project kickoff", "completed", "medium", "milestone", 2, 100, -15, "planning"),
        (web, sprint1, "Competitor research", "completed", "medium", "task", 3, 100, -11, "research"),
        (web, sprint1, "Sitemap planning", "completed", "low", "task", 2, 100, -8, "planning"),
        (mobile, sprint2, "Push notification preferences", "in_progress", "high", "story", 8, 45, 20, "mobile,notifications"),
        (mobile, sprint2, "Beta regression suite", "review", "critical", "bug", 8, 80, 16, "mobile,qa"),
        (marketing, None, "Finalize campaign messaging", "backlog", "high", "task", 5, 20, 30, "campaign,copy"),
        (roadmap, None, "Architecture decision review", "completed", "high", "milestone", 5, 100, -4, "architecture,governance"),
    ]
    created_tasks: list[Task] = []
    counters: dict[str, int] = {}
    for project, sprint, title, status, priority, task_type, points, progress, due_offset, labels in task_specs:
        counters[project.key] = counters.get(project.key, 0) + 1
        task = Task(
            project_id=project.id,
            sprint_id=sprint.id if sprint else None,
            reporter_id=owner.id,
            task_number=f"{project.key}-{counters[project.key]}",
            title=title,
            description=f"Taskly work item: {title.lower()}.",
            status=status,
            priority=priority,
            task_type=task_type,
            labels=labels,
            story_points=points,
            progress=progress,
            due_date=now + timedelta(days=due_offset),
            estimate_minutes=points * 90,
            logged_minutes=int(points * 90 * progress / 100),
        )
        task.assignees = [owner]
        db.add(task)
        created_tasks.append(task)
    db.flush()

    db.add_all([
        Comment(
            task_id=created_tasks[3].id,
            author_id=owner.id,
            body="Component states and responsive specs are ready for review.",
        ),
        Comment(
            task_id=created_tasks[7].id,
            author_id=owner.id,
            body="Safari layout issue at tablet width — reproduction notes added.",
        ),
        TimeEntry(task_id=created_tasks[3].id, user_id=owner.id, minutes=240, note="Implemented card, modal and form components"),
        TimeEntry(task_id=created_tasks[7].id, user_id=owner.id, minutes=120, note="Cross-browser regression"),
    ])

    db.add(Notification(
        user_id=owner.id,
        title="Welcome to Taskly",
        message="Your workspace is ready. You are signed in as Ajxdevx.",
        kind="assignment",
    ))
    db.add(AuditLog(
        actor_id=owner.id,
        action="seed",
        entity_type="organization",
        entity_id=str(org.id),
        details="Initialized Taskly workspace for Ajxdevx",
    ))
    db.commit()
