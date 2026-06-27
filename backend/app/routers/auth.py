from typing import Annotated

from fastapi import APIRouter, Depends, File, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user, require_applicant, require_reviewer
from app.database import get_db
from app.models import ApplicationStatus, User
from app.schemas import (
    ApplicationCreate,
    ApplicationResponse,
    ApplicationUpdate,
    AuditLogResponse,
    LoginRequest,
    TokenResponse,
    TransitionRequest,
    UserResponse,
)
from app.services import applications as app_service
from app.services import audit as audit_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(
    payload: LoginRequest,
    db: Annotated[Session, Depends(get_db)],
):
    from app.auth.password import verify_password
    from app.auth.jwt import create_access_token
    from app.models import User

    user = db.query(User).filter(User.email == payload.email).first()
    if user is None or not verify_password(payload.password, user.password_hash):
        from fastapi import HTTPException

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": "Invalid credentials", "code": "INVALID_CREDENTIALS"},
        )
    token = create_access_token(str(user.id), user.role)
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserResponse)
def me(current_user: Annotated[User, Depends(get_current_user)]):
    return current_user
