import uuid
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.auth.jwt import decode_access_token
from app.database import get_db
from app.models import User, UserRole

security = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": "Not authenticated", "code": "UNAUTHENTICATED"},
        )
    try:
        payload = decode_access_token(credentials.credentials)
        user_id = uuid.UUID(payload["sub"])
    except (ValueError, KeyError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": "Invalid token", "code": "INVALID_TOKEN"},
        ) from None

    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": "User not found", "code": "USER_NOT_FOUND"},
        )
    return user


def require_applicant(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    if current_user.role != UserRole.APPLICANT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "Applicant role required",
                "code": "FORBIDDEN",
            },
        )
    return current_user


def require_reviewer(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    if current_user.role != UserRole.REVIEWER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "Reviewer role required",
                "code": "FORBIDDEN",
            },
        )
    return current_user
