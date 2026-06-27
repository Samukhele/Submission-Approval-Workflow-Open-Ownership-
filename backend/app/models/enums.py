import enum

from sqlalchemy import Enum as SAEnum


class UserRole(str, enum.Enum):
    APPLICANT = "APPLICANT"
    REVIEWER = "REVIEWER"


class ApplicationStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    UNDER_REVIEW = "UNDER_REVIEW"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class ApplicationCategory(str, enum.Enum):
    OPERATIONS = "operations"
    MARKETING = "marketing"
    IT = "it"
    HR = "hr"


class TransitionAction(str, enum.Enum):
    SUBMIT = "submit"
    START_REVIEW = "start_review"
    APPROVE = "approve"
    REJECT = "reject"
    RETURN = "return"


def pg_enum(enum_class: type[enum.Enum], name: str) -> SAEnum:
    """Persist enum values (not member names) for PostgreSQL native enums."""
    return SAEnum(
        enum_class,
        name=name,
        create_type=False,
        values_callable=lambda members: [member.value for member in members],
    )
