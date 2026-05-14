from __future__ import annotations

import os
from pathlib import Path

TEST_DB = Path(__file__).parent / "test_taskly.db"
if TEST_DB.exists():
    TEST_DB.unlink()
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB}"
os.environ["SECRET_KEY"] = "test-secret"

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

OWNER_EMAIL = "ajxdevx@taskly.io"
OWNER_PASSWORD = "demo"


def login() -> dict[str, str]:
    response = client.post("/api/auth/login", json={"email": OWNER_EMAIL, "password": OWNER_PASSWORD})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_health_and_auth() -> None:
    with client:
        assert client.get("/health").json()["status"] == "ok"
        headers = login()
        me = client.get("/api/auth/me", headers=headers)
        assert me.status_code == 200
        assert me.json()["email"] == OWNER_EMAIL
        assert me.json()["full_name"] == "Ajxdevx"
        assert me.json()["role"] == "super_admin"


def test_dashboard_projects_and_tasks() -> None:
    with client:
        headers = login()
        dashboard = client.get("/api/dashboard/summary", headers=headers)
        assert dashboard.status_code == 200
        assert dashboard.json()["metrics"]["total_tasks"] >= 10
        projects = client.get("/api/projects", headers=headers)
        assert projects.status_code == 200
        assert len(projects.json()) >= 4
        tasks = client.get("/api/tasks", headers=headers)
        assert tasks.status_code == 200
        assert any(item["task_number"].startswith("WEB-") for item in tasks.json())


def test_task_lifecycle_comment_and_time() -> None:
    with client:
        headers = login()
        project = client.get("/api/projects", headers=headers).json()[0]
        me = client.get("/api/auth/me", headers=headers).json()
        created = client.post("/api/tasks", headers=headers, json={
            "project_id": project["id"],
            "title": "API lifecycle verification",
            "description": "Automated integration test",
            "priority": "high",
            "story_points": 3,
            "assignee_ids": [me["id"]],
            "labels": ["test"]
        })
        assert created.status_code == 201, created.text
        task = created.json()
        moved = client.patch(f"/api/tasks/{task['id']}/status", headers=headers, json={"status": "in_progress"})
        assert moved.status_code == 200
        assert moved.json()["status"] == "in_progress"
        comment = client.post(f"/api/tasks/{task['id']}/comments", headers=headers, json={"body": "Integration verified."})
        assert comment.status_code == 201
        time = client.post(f"/api/tasks/{task['id']}/time", headers=headers, json={"minutes": 45, "note": "Test execution"})
        assert time.status_code == 201


def test_audit_logs_for_owner() -> None:
    with client:
        headers = login()
        logs = client.get("/api/audit-logs", headers=headers)
        assert logs.status_code == 200
        assert isinstance(logs.json(), list)
