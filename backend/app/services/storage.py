import io
import json
import os
from abc import ABC, abstractmethod
from pathlib import Path

from fastapi import HTTPException, status

from app.config import settings


class StorageBackend(ABC):
    @abstractmethod
    def upload(
        self,
        content: bytes,
        filename: str,
        mime_type: str,
        application_id: str,
    ) -> str:
        """Return a storage reference saved in the database."""

    @abstractmethod
    def download(self, storage_ref: str) -> tuple[bytes, str]:
        """Return file bytes and mime type."""

    @abstractmethod
    def delete(self, storage_ref: str) -> None:
        pass


class LocalStorageBackend(StorageBackend):
    def upload(
        self,
        content: bytes,
        filename: str,
        mime_type: str,
        application_id: str,
    ) -> str:
        upload_root = Path(settings.upload_dir) / application_id
        upload_root.mkdir(parents=True, exist_ok=True)
        safe_name = Path(filename).name
        dest = upload_root / safe_name
        with open(dest, "wb") as f:
            f.write(content)
        return str(dest)

    def download(self, storage_ref: str) -> tuple[bytes, str]:
        if not os.path.exists(storage_ref):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error": "File not found", "code": "NOT_FOUND"},
            )
        with open(storage_ref, "rb") as f:
            return f.read(), "application/octet-stream"

    def delete(self, storage_ref: str) -> None:
        if os.path.exists(storage_ref):
            os.remove(storage_ref)


class GoogleDriveStorageBackend(StorageBackend):
    def __init__(self) -> None:
        from google.oauth2 import service_account
        from googleapiclient.discovery import build

        if not settings.google_drive_folder_id:
            raise RuntimeError("GOOGLE_DRIVE_FOLDER_ID is required for Google Drive storage")

        credentials_info = self._load_credentials()
        credentials = service_account.Credentials.from_service_account_info(
            credentials_info,
            scopes=["https://www.googleapis.com/auth/drive.file"],
        )
        self._service = build("drive", "v3", credentials=credentials, cache_discovery=False)

    def _load_credentials(self) -> dict:
        if settings.google_drive_credentials_json:
            return json.loads(settings.google_drive_credentials_json)
        if settings.google_drive_credentials_file:
            with open(settings.google_drive_credentials_file, encoding="utf-8") as f:
                return json.load(f)
        raise RuntimeError(
            "Set GOOGLE_DRIVE_CREDENTIALS_JSON or GOOGLE_DRIVE_CREDENTIALS_FILE"
        )

    def upload(
        self,
        content: bytes,
        filename: str,
        mime_type: str,
        application_id: str,
    ) -> str:
        from googleapiclient.http import MediaIoBaseUpload

        safe_name = Path(filename).name
        metadata = {
            "name": f"{application_id}_{safe_name}",
            "parents": [settings.google_drive_folder_id],
        }
        media = MediaIoBaseUpload(io.BytesIO(content), mimetype=mime_type, resumable=True)
        created = (
            self._service.files()
            .create(body=metadata, media_body=media, fields="id")
            .execute()
        )
        return created["id"]

    def download(self, storage_ref: str) -> tuple[bytes, str]:
        from googleapiclient.http import MediaIoBaseDownload

        meta = (
            self._service.files()
            .get(fileId=storage_ref, fields="mimeType")
            .execute()
        )
        request = self._service.files().get_media(fileId=storage_ref)
        buffer = io.BytesIO()
        downloader = MediaIoBaseDownload(buffer, request)
        done = False
        while not done:
            _, done = downloader.next_chunk()
        return buffer.getvalue(), meta.get("mimeType", "application/octet-stream")

    def delete(self, storage_ref: str) -> None:
        self._service.files().delete(fileId=storage_ref).execute()


_storage_backend: StorageBackend | None = None


def get_storage_backend() -> StorageBackend:
    global _storage_backend
    if _storage_backend is None:
        if settings.storage_backend == "google_drive":
            _storage_backend = GoogleDriveStorageBackend()
        else:
            _storage_backend = LocalStorageBackend()
    return _storage_backend


def reset_storage_backend() -> None:
    global _storage_backend
    _storage_backend = None
