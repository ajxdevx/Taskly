from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=4)


class UserCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8)
    role: str
    title: str = ""
    avatar: str = ""


class ProjectCreate(BaseModel):
    workspace_id: int = 1
    name: str = Field(min_length=2, max_length=140)
    key: str = Field(min_length=2, max_length=12)
    description: str = ""
    priority: str = "medium"
    color: str = "indigo"
    start_date: datetime | None = None
    target_date: datetime | None = None
    budget: float = 0
    member_ids: list[int] = []


class SprintCreate(BaseModel):
    project_id: int
    name: str
    goal: str = ""
    start_date: datetime | None = None
    end_date: datetime | None = None
    capacity_points: int = Field(default=40, ge=1, le=500)


class TaskCreate(BaseModel):
    project_id: int
    sprint_id: int | None = None
    title: str = Field(min_length=2, max_length=220)
    description: str = ""
    status: str = "backlog"
    priority: str = "medium"
    task_type: str = "task"
    labels: list[str] = []
    story_points: int = Field(default=1, ge=0, le=100)
    progress: int = Field(default=0, ge=0, le=100)
    due_date: datetime | None = None
    estimate_minutes: int = Field(default=0, ge=0)
    assignee_ids: list[int] = []
    parent_task_id: int | None = None


class TaskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    sprint_id: int | None = None
    status: str | None = None
    priority: str | None = None
    task_type: str | None = None
    labels: list[str] | None = None
    story_points: int | None = Field(default=None, ge=0, le=100)
    progress: int | None = Field(default=None, ge=0, le=100)
    due_date: datetime | None = None
    estimate_minutes: int | None = Field(default=None, ge=0)
    assignee_ids: list[int] | None = None


class StatusUpdate(BaseModel):
    status: str


class CommentCreate(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


class TimeEntryCreate(BaseModel):
    minutes: int = Field(ge=1, le=1440)
    note: str = Field(default="", max_length=255)


class NotificationUpdate(BaseModel):
    is_read: bool = True
