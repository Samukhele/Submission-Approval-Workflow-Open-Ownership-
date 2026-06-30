from uuid import UUID

from sqlalchemy.orm import Session, joinedload

from app.models import Application, ApplicationStatus, AuditLog, User

RETURN_SOURCE_STATUSES = frozenset(
    {ApplicationStatus.UNDER_REVIEW, ApplicationStatus.SUBMITTED}
)


def display_to_status(
    from_status: ApplicationStatus,
    to_status: ApplicationStatus,
    comment: str | None,
) -> str:
    """UI label for audit trail; return transitions show RETURNED instead of DRAFT."""
    if (
        to_status == ApplicationStatus.DRAFT
        and from_status in RETURN_SOURCE_STATUSES
        and comment
    ):
        return "RETURNED"
    return to_status.value


def create_audit_log(
    db: Session,
    application_id: UUID,
    actor_id: UUID,
    from_status: ApplicationStatus,
    to_status: ApplicationStatus,
    comment: str | None = None,
) -> AuditLog:
    entry = AuditLog(
        application_id=application_id,
        actor_id=actor_id,
        from_status=from_status,
        to_status=to_status,
        comment=comment,
    )
    db.add(entry)
    return entry


def get_audit_logs(db: Session, application_id: UUID) -> list[AuditLog]:
    return (
        db.query(AuditLog)
        .options(joinedload(AuditLog.actor))
        .filter(AuditLog.application_id == application_id)
        .order_by(AuditLog.created_at.asc())
        .all()
    )
