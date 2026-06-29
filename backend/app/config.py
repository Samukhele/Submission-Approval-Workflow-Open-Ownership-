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

    storage_backend: Literal["local", "google_drive", "azure_blob"] = "local"
    upload_dir: str = "uploads"
    google_drive_credentials_file: str | None = None
    google_drive_credentials_json: str | None = None
    google_drive_folder_id: str | None = None

    # Azure Blob Storage (SAS token auth)
    azure_blob_account: str | None = None
    azure_blob_container: str | None = None
    azure_blob_sas_token: str | None = None

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

    @field_validator(
        "azure_blob_account",
        "azure_blob_container",
        "azure_blob_sas_token",
        mode="before",
    )
    @classmethod
    def normalize_azure_placeholder(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        if not stripped or stripped.startswith("your_"):
            return None
        return stripped

    @field_validator("azure_blob_sas_token", mode="after")
    @classmethod
    def normalize_sas_token(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.lstrip("?")

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

    @model_validator(mode="after")
    def validate_azure_blob_config(self) -> "Settings":
        if self.storage_backend != "azure_blob":
            return self
        missing: list[str] = []
        if not self.azure_blob_account:
            missing.append("AZURE_BLOB_ACCOUNT")
        if not self.azure_blob_container:
            missing.append("AZURE_BLOB_CONTAINER")
        if not self.azure_blob_sas_token:
            missing.append("AZURE_BLOB_SAS_TOKEN")
        if missing:
            raise ValueError(
                f"{', '.join(missing)} required when STORAGE_BACKEND=azure_blob"
            )
        return self

    @property
    def azure_blob_configured(self) -> bool:
        return bool(
            self.azure_blob_account
            and self.azure_blob_container
            and self.azure_blob_sas_token
        )

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
