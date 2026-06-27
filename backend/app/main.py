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
    return {"status": "ok"}


app.include_router(auth.router, prefix="/api/v1")
app.include_router(applications.router, prefix="/api/v1")
