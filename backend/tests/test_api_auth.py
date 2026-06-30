import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.auth.password import hash_password
from app.database import Base, get_db
from app.main import app
from app.models import Application, ApplicationCategory, ApplicationStatus, User, UserRole

SQLALCHEMY_DATABASE_URL = "sqlite://"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture()
def db():
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def client(db):
    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture()
def users(db):
    applicant = User(
        id=uuid.uuid4(),
        email="applicant@test.com",
        password_hash=hash_password("password123"),
        role=UserRole.APPLICANT,
    )
    reviewer = User(
        id=uuid.uuid4(),
        email="reviewer@test.com",
        password_hash=hash_password("password123"),
        role=UserRole.REVIEWER,
    )
    db.add_all([applicant, reviewer])
    db.commit()
    return {"applicant": applicant, "reviewer": reviewer}


def login(client: TestClient, email: str, password: str) -> str:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert response.status_code == 200
    return response.json()["access_token"]


def test_applicant_cannot_approve_application(client, users):
    applicant_token = login(client, "applicant@test.com", "password123")

    create_resp = client.post(
        "/api/v1/applications",
        headers={"Authorization": f"Bearer {applicant_token}"},
        json={
            "title": "Test App",
            "category": "it",
            "description": "Need budget",
            "amount": 1000,
        },
    )
    assert create_resp.status_code == 201
    app_id = create_resp.json()["id"]

    submit_resp = client.post(
        f"/api/v1/applications/{app_id}/submit",
        headers={"Authorization": f"Bearer {applicant_token}"},
    )
    assert submit_resp.status_code == 200

    reviewer_token = login(client, "reviewer@test.com", "password123")
    start_resp = client.post(
        f"/api/v1/applications/{app_id}/transition",
        headers={"Authorization": f"Bearer {reviewer_token}"},
        json={"action": "start_review"},
    )
    assert start_resp.status_code == 200

    forbidden_resp = client.post(
        f"/api/v1/applications/{app_id}/transition",
        headers={"Authorization": f"Bearer {applicant_token}"},
        json={"action": "approve"},
    )
    assert forbidden_resp.status_code == 403
    assert forbidden_resp.json()["detail"]["code"] in ("FORBIDDEN", "FORBIDDEN_TRANSITION")

    approve_resp = client.post(
        f"/api/v1/applications/{app_id}/transition",
        headers={"Authorization": f"Bearer {reviewer_token}"},
        json={"action": "approve"},
    )
    assert approve_resp.status_code == 200
    assert approve_resp.json()["status"] == "APPROVED"

    audit_resp = client.get(
        f"/api/v1/applications/{app_id}/audit",
        headers={"Authorization": f"Bearer {reviewer_token}"},
    )
    assert audit_resp.status_code == 200
    audit_logs = audit_resp.json()
    assert len(audit_logs) == 3
    assert audit_logs[-1]["to_status"] == "APPROVED"


def test_reviewer_cannot_see_drafts(client, users):
    applicant_token = login(client, "applicant@test.com", "password123")
    reviewer_token = login(client, "reviewer@test.com", "password123")

    create_resp = client.post(
        "/api/v1/applications",
        headers={"Authorization": f"Bearer {applicant_token}"},
        json={
            "title": "Private draft",
            "category": "it",
            "description": "Still editing",
            "amount": 500,
        },
    )
    assert create_resp.status_code == 201
    app_id = create_resp.json()["id"]

    list_resp = client.get(
        "/api/v1/applications",
        headers={"Authorization": f"Bearer {reviewer_token}"},
    )
    assert list_resp.status_code == 200
    assert all(app["status"] != "DRAFT" for app in list_resp.json())
    assert app_id not in {app["id"] for app in list_resp.json()}

    get_resp = client.get(
        f"/api/v1/applications/{app_id}",
        headers={"Authorization": f"Bearer {reviewer_token}"},
    )
    assert get_resp.status_code == 404

    submit_resp = client.post(
        f"/api/v1/applications/{app_id}/submit",
        headers={"Authorization": f"Bearer {applicant_token}"},
    )
    assert submit_resp.status_code == 200

    list_after_submit = client.get(
        "/api/v1/applications",
        headers={"Authorization": f"Bearer {reviewer_token}"},
    )
    assert list_after_submit.status_code == 200
    assert app_id in {app["id"] for app in list_after_submit.json()}


def test_applicant_can_view_audit_trail(client, users):
    applicant_token = login(client, "applicant@test.com", "password123")
    reviewer_token = login(client, "reviewer@test.com", "password123")

    create_resp = client.post(
        "/api/v1/applications",
        headers={"Authorization": f"Bearer {applicant_token}"},
        json={
            "title": "Audit visibility test",
            "category": "hr",
            "description": "Track me",
            "amount": 250,
        },
    )
    assert create_resp.status_code == 201
    app_id = create_resp.json()["id"]

    submit_resp = client.post(
        f"/api/v1/applications/{app_id}/submit",
        headers={"Authorization": f"Bearer {applicant_token}"},
    )
    assert submit_resp.status_code == 200

    approve_resp = client.post(
        f"/api/v1/applications/{app_id}/transition",
        headers={"Authorization": f"Bearer {reviewer_token}"},
        json={"action": "approve"},
    )
    assert approve_resp.status_code == 200

    audit_resp = client.get(
        f"/api/v1/applications/{app_id}/audit",
        headers={"Authorization": f"Bearer {applicant_token}"},
    )
    assert audit_resp.status_code == 200
    audit_logs = audit_resp.json()
    assert len(audit_logs) == 2
    assert audit_logs[0]["from_status"] == "DRAFT"
    assert audit_logs[0]["to_status"] == "SUBMITTED"
    assert audit_logs[1]["to_status"] == "APPROVED"


def test_reviewer_can_return_from_submitted(client, users):
    applicant_token = login(client, "applicant@test.com", "password123")
    reviewer_token = login(client, "reviewer@test.com", "password123")

    create_resp = client.post(
        "/api/v1/applications",
        headers={"Authorization": f"Bearer {applicant_token}"},
        json={
            "title": "Return from submitted test",
            "category": "finance",
            "description": "Needs quotation",
            "amount": 10,
        },
    )
    assert create_resp.status_code == 201
    app_id = create_resp.json()["id"]

    submit_resp = client.post(
        f"/api/v1/applications/{app_id}/submit",
        headers={"Authorization": f"Bearer {applicant_token}"},
    )
    assert submit_resp.status_code == 200
    assert submit_resp.json()["status"] == "SUBMITTED"

    return_resp = client.post(
        f"/api/v1/applications/{app_id}/transition",
        headers={"Authorization": f"Bearer {reviewer_token}"},
        json={"action": "return", "comment": "Send quotation of trip"},
    )
    assert return_resp.status_code == 200
    body = return_resp.json()
    assert body["status"] == "DRAFT"
    assert body["display_status"] == "RETURNED"

    returned_list = client.get(
        "/api/v1/applications?status=RETURNED",
        headers={"Authorization": f"Bearer {reviewer_token}"},
    )
    assert returned_list.status_code == 200
    assert app_id in {app["id"] for app in returned_list.json()}

    audit_resp = client.get(
        f"/api/v1/applications/{app_id}/audit",
        headers={"Authorization": f"Bearer {reviewer_token}"},
    )
    assert audit_resp.status_code == 200
    return_log = audit_resp.json()[-1]
    assert return_log["to_status"] == "DRAFT"
    assert return_log["display_to_status"] == "RETURNED"
