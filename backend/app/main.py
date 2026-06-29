from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from app.config import settings
from app.routers import applications, auth

app = FastAPI(title="Submission & Approval Workflow", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content={
            "error": "Validation failed",
            "code": "VALIDATION_ERROR",
            "details": exc.errors(),
        },
    )


@app.get("/health")
def health():
    storage = settings.storage_backend
    return {
        "status": "ok",
        "storage_backend": storage,
        "google_drive_configured": storage == "google_drive"
        and bool(settings.google_drive_folder_id)
        and bool(
            settings.google_drive_credentials_json or settings.google_drive_credentials_file
        ),
        "azure_blob_configured": storage == "azure_blob" and settings.azure_blob_configured,
    }


app.include_router(auth.router, prefix="/api/v1")
app.include_router(applications.router, prefix="/api/v1")
