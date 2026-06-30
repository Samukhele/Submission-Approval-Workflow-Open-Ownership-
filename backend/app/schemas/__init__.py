from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.enums import ApplicationCategory, ApplicationStatus, UserRole


class ErrorResponse(BaseModel):
    error: str
    code: str
    details: dict = Field(default_factory=dict)


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    role: UserRole
    created_at: datetime


class ApplicationBase(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    category: ApplicationCategory
    description: str | None = None
    amount: Decimal | None = Field(default=None, ge=0)
    requested_date: date | None = None


class ApplicationCreate(ApplicationBase):
    pass


class ApplicationUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    category: ApplicationCategory | None = None
    description: str | None = None
    amount: Decimal | None = Field(default=None, ge=0)
    requested_date: date | None = None


class ApplicationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    owner_id: UUID
    title: str
    category: ApplicationCategory
    description: str | None
    amount: Decimal | None
    requested_date: date | None
    file_name: str | None
    status: ApplicationStatus
    display_status: str
    created_at: datetime
    updated_at: datetime
    owner_email: str | None = None


class TransitionRequest(BaseModel):
    action: str
    comment: str | None = None


class AuditLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    application_id: UUID
    actor_id: UUID
    actor_email: str | None = None
    from_status: ApplicationStatus
    to_status: ApplicationStatus
    display_to_status: str
    comment: str | None
    created_at: datetime


class SubmitValidation(BaseModel):
    amount: Decimal | None = None
    requested_date: date | None = None

    @model_validator(mode="after")
    def require_amount_or_date(self) -> "SubmitValidation":
        if self.amount is None and self.requested_date is None:
            raise ValueError("Either amount or requested_date is required to submit")
        return self
