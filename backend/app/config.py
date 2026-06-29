from typing import Literal

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql://postgres:postgres@localhost:5432/approval_workflow"
    secret_key: str = "dev-secret-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    storage_backend: Literal["local", "google_drive"] = "local"
    upload_dir: str = "uploads"
    google_drive_credentials_file: str | None = None
    google_drive_credentials_json: str | None = None
    google_drive_folder_id: str | None = None

    max_upload_size_bytes: int = 10 * 1024 * 1024
    allowed_mime_types: list[str] = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "image/png",
        "image/jpeg",
    ]

    @field_validator("database_url", mode="before")
    @classmethod
    def normalize_database_url(cls, value: str) -> str:
        if isinstance(value, str) and value.startswith("postgres://"):
            return value.replace("postgres://", "postgresql://", 1)
        return value

    @field_validator("google_drive_credentials_json", mode="before")
    @classmethod
    def normalize_credentials_json(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        if not stripped or stripped in {
            "your_full_json_file_content",
            "paste_service_account_json_here",
        }:
            return None
        return stripped

    @field_validator("google_drive_folder_id", mode="before")
    @classmethod
    def normalize_folder_id(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        if not stripped or stripped in {
            "your_folder_id",
            "your-shared-drive-folder-id",
            "paste_folder_id_here",
        }:
            return None
        return stripped

    @model_validator(mode="after")
    def validate_google_drive_config(self) -> "Settings":
        if self.storage_backend != "google_drive":
            return self
        if not self.google_drive_folder_id:
            raise ValueError(
                "GOOGLE_DRIVE_FOLDER_ID is required when STORAGE_BACKEND=google_drive"
            )
        if not self.google_drive_credentials_json and not self.google_drive_credentials_file:
            raise ValueError(
                "GOOGLE_DRIVE_CREDENTIALS_JSON (or GOOGLE_DRIVE_CREDENTIALS_FILE) "
                "is required when STORAGE_BACKEND=google_drive"
            )
        return self

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
