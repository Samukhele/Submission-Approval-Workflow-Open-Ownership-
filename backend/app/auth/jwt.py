from datetime import UTC, datetime, timedelta

from jose import JWTError, jwt

from app.config import settings
from app.models import UserRole


def create_access_token(user_id: str, role: UserRole) -> str:
    expire = datetime.now(UTC) + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {
        "sub": user_id,
        "role": role.value,
        "exp": expire,
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(
            token, settings.secret_key, algorithms=[settings.algorithm]
        )
    except JWTError as exc:
        raise ValueError("Invalid token") from exc
