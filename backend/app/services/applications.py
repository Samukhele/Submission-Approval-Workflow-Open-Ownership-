import mimetypes
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile, status
from pydantic import ValidationError
from sqlalchemy.orm import Session, joinedload

from app.config import settings
from app.models import Application, ApplicationCategory, ApplicationStatus, User, UserRole
from app.schemas import ApplicationCreate, ApplicationUpdate, SubmitValidation
from app.services import audit as audit_service
from app.services.state_machine import (
    CommentRequiredError,
    ForbiddenTransitionError,
    IllegalTransitionError,
    StateMachineError,
    transition,
)
from app.services.storage import get_storage_backend


def _application_to_dict(app: Application) -> dict:
    return {
        "id": app.id,
        "owner_id": app.owner_id,
        "title": app.title,
        "category": app.category,
        "description": app.description,
        "amount": app.amount,
        "requested_date": app.requested_date,
        "file_name": app.file_name,
        "status": app.status,
        "created_at": app.created_at,
        "updated_at": app.updated_at,
        "owner_email": app.owner.email if app.owner else None,
    }


def get_application_or_404(db: Session, application_id: uuid.UUID) -> Application:
    app = (
        db.query(Application)
        .options(joinedload(Application.owner))
        .filter(Application.id == application_id)
        .first()
    )
    if app is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "Application not found", "code": "NOT_FOUND"},
        )
    return app


def can_view(user: User, app: Application) -> bool:
    if user.role == UserRole.REVIEWER:
        return app.status != ApplicationStatus.DRAFT
    return app.owner_id == user.id


def ensure_can_view(user: User, app: Application) -> None:
    if user.role == UserRole.REVIEWER and app.status == ApplicationStatus.DRAFT:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "Application not found", "code": "NOT_FOUND"},
        )
    if not can_view(user, app):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": "Access denied", "code": "FORBIDDEN"},
        )


def ensure_owner(user: User, app: Application) -> None:
    if app.owner_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": "Only the owner can perform this action", "code": "FORBIDDEN"},
        )


def list_applications(
    db: Session,
    user: User,
    status_filter: ApplicationStatus | None = None,
    category_filter: ApplicationCategory | None = None,
) -> list[dict]:
    query = db.query(Application).options(joinedload(Application.owner))
    if user.role == UserRole.APPLICANT:
        query = query.filter(Application.owner_id == user.id)
    else:
        # Reviewers only see applications that have been submitted.
        query = query.filter(Application.status != ApplicationStatus.DRAFT)
    if status_filter:
        if (
            user.role == UserRole.REVIEWER
            and status_filter == ApplicationStatus.DRAFT
        ):
            return []
        query = query.filter(Application.status == status_filter)
    if category_filter:
        query = query.filter(Application.category == category_filter)
    apps = query.order_by(Application.updated_at.desc()).all()
    return [_application_to_dict(app) for app in apps]


def create_application(db: Session, user: User, data: ApplicationCreate) -> dict:
    app = Application(
        owner_id=user.id,
        title=data.title,
        category=data.category,
        description=data.description,
        amount=data.amount,
        requested_date=data.requested_date,
        status=ApplicationStatus.DRAFT,
    )
    db.add(app)
    db.commit()
    db.refresh(app)
    app = get_application_or_404(db, app.id)
    return _application_to_dict(app)


def update_application(
    db: Session, user: User, app: Application, data: ApplicationUpdate
) -> dict:
    ensure_owner(user, app)
    if app.status != ApplicationStatus.DRAFT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "Applications can only be edited in DRAFT status",
                "code": "FORBIDDEN",
            },
        )

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(app, field, value)

    db.commit()
    db.refresh(app)
    return _application_to_dict(app)


def submit_application(db: Session, user: User, app: Application) -> dict:
    ensure_owner(user, app)
    try:
        SubmitValidation.model_validate(
            {"amount": app.amount, "requested_date": app.requested_date}
        )
    except ValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": "Either amount or requested_date is required to submit",
                "code": "VALIDATION_ERROR",
                "details": exc.errors(),
            },
        ) from exc

    try:
        new_status = transition(
            current_status=app.status.value,
            action="submit",
            role=user.role.value,
            is_owner=True,
        )
    except StateMachineError as exc:
        _raise_state_machine_http(exc)

    from_status = app.status
    app.status = ApplicationStatus(new_status)
    audit_service.create_audit_log(
        db, app.id, user.id, from_status, app.status, comment=None
    )
    db.commit()
    db.refresh(app)
    return _application_to_dict(app)


def perform_transition(
    db: Session,
    user: User,
    app: Application,
    action: str,
    comment: str | None = None,
) -> dict:
    is_owner = app.owner_id == user.id
    try:
        new_status = transition(
            current_status=app.status.value,
            action=action,
            role=user.role.value,
            is_owner=is_owner,
            comment=comment,
        )
    except ForbiddenTransitionError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": exc.message,
                "code": exc.code,
                "details": exc.details,
            },
        ) from exc
    except (IllegalTransitionError, CommentRequiredError) as exc:
        _raise_state_machine_http(exc)

    from_status = app.status
    app.status = ApplicationStatus(new_status)
    audit_service.create_audit_log(
        db, app.id, user.id, from_status, app.status, comment=comment
    )
    db.commit()
    db.refresh(app)
    return _application_to_dict(app)


def _raise_state_machine_http(exc: StateMachineError) -> None:
    status_code = (
        status.HTTP_409_CONFLICT
        if isinstance(exc, IllegalTransitionError)
        else status.HTTP_400_BAD_REQUEST
    )
    raise HTTPException(
        status_code=status_code,
        detail={
            "error": exc.message,
            "code": exc.code,
            "details": exc.details,
        },
    ) from exc


def _resolve_mime_type(file: UploadFile) -> str:
    if file.content_type and file.content_type in settings.allowed_mime_types:
        return file.content_type
    guessed, _ = mimetypes.guess_type(file.filename or "")
    return guessed or "application/octet-stream"


def save_upload(
    db: Session, user: User, app: Application, file: UploadFile
) -> dict:
    ensure_owner(user, app)
    if app.status != ApplicationStatus.DRAFT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "Files can only be uploaded while in DRAFT status",
                "code": "FORBIDDEN",
            },
        )

    mime_type = _resolve_mime_type(file)
    if mime_type not in settings.allowed_mime_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "File type not allowed",
                "code": "INVALID_FILE_TYPE",
                "details": {"allowed": settings.allowed_mime_types},
            },
        )

    content = file.file.read()
    if len(content) > settings.max_upload_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "File too large",
                "code": "FILE_TOO_LARGE",
                "details": {"max_bytes": settings.max_upload_size_bytes},
            },
        )

    storage = get_storage_backend()
    safe_name = Path(file.filename or "upload").name

    if app.file_path:
        try:
            storage.delete(app.file_path)
        except Exception:
            pass

    storage_ref = storage.upload(content, safe_name, mime_type, str(app.id))
    app.file_name = safe_name
    app.file_path = storage_ref
    app.file_mime_type = mime_type
    db.commit()
    db.refresh(app)
    app = get_application_or_404(db, app.id)
    return _application_to_dict(app)


def get_file_content(user: User, app: Application) -> tuple[bytes, str, str]:
    ensure_can_view(user, app)
    if not app.file_path or not app.file_name:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "File not found", "code": "NOT_FOUND"},
        )
    storage = get_storage_backend()
    content, mime_type = storage.download(app.file_path)
    return content, app.file_mime_type or mime_type, app.file_name
