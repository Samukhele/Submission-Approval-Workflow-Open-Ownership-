import os

# Tests always use local disk storage; Google Drive is configured via .env in production.
os.environ.setdefault("STORAGE_BACKEND", "local")
