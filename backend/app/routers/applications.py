import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, Query, UploadFile
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_applicant, require_reviewer
from app.database import get_db
from app.models import ApplicationStatus, User
from app.schemas import (
    ApplicationCreate,
    ApplicationResponse,
    ApplicationUpdate,
    AuditLogResponse,
    TransitionRequest,
)
from app.services import applications as app_service
from app.services import audit as audit_service

router = APIRouter(prefix="/applications", tags=["applications"])


@router.get("", response_model=list[ApplicationResponse])
def list_applications(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    status: ApplicationStatus | None = Query(default=None),
):
    return app_service.list_applications(db, current_user, status)


@router.post("", response_model=ApplicationResponse, status_code=201)
def create_application(
    payload: ApplicationCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_applicant)],
):
    return app_service.create_application(db, current_user, payload)


@router.get("/{application_id}", response_model=ApplicationResponse)
def get_application(
    application_id: uuid.UUID,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    app = app_service.get_application_or_404(db, application_id)
    app_service.ensure_can_view(current_user, app)
    return app_service._application_to_dict(app)


@router.patch("/{application_id}", response_model=ApplicationResponse)
def update_application(
    application_id: uuid.UUID,
    payload: ApplicationUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_applicant)],
):
    app = app_service.get_application_or_404(db, application_id)
    return app_service.update_application(db, current_user, app, payload)


@router.post("/{application_id}/submit", response_model=ApplicationResponse)
def submit_application(
    application_id: uuid.UUID,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_applicant)],
):
    app = app_service.get_application_or_404(db, application_id)
    return app_service.submit_application(db, current_user, app)


@router.post("/{application_id}/transition", response_model=ApplicationResponse)
def transition_application(
    application_id: uuid.UUID,
    payload: TransitionRequest,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_reviewer)],
):
    app = app_service.get_application_or_404(db, application_id)
    return app_service.perform_transition(
        db, current_user, app, payload.action, payload.comment
    )


@router.post("/{application_id}/file", response_model=ApplicationResponse)
def upload_file(
    application_id: uuid.UUID,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(require_applicant)],
    file: UploadFile = File(...),
):
    app = app_service.get_application_or_404(db, application_id)
    return app_service.save_upload(db, current_user, app, file)


@router.get("/{application_id}/file")
def download_file(
    application_id: uuid.UUID,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    download: bool = Query(default=False),
):
    app = app_service.get_application_or_404(db, application_id)
    content, mime_type, filename = app_service.get_file_content(current_user, app)
    disposition = "attachment" if download else "inline"
    return Response(
        content=content,
        media_type=mime_type,
        headers={"Content-Disposition": f'{disposition}; filename="{filename}"'},
    )


@router.get("/{application_id}/audit", response_model=list[AuditLogResponse])
def get_audit_trail(
    application_id: uuid.UUID,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    app = app_service.get_application_or_404(db, application_id)
    app_service.ensure_can_view(current_user, app)
    logs = audit_service.get_audit_logs(db, application_id)
    return [
        {
            "id": log.id,
            "application_id": log.application_id,
            "actor_id": log.actor_id,
            "actor_email": log.actor.email if log.actor else None,
            "from_status": log.from_status,
            "to_status": log.to_status,
            "comment": log.comment,
            "created_at": log.created_at,
        }
        for log in logs
    ]
