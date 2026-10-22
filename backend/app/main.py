"""FastAPI entrypoint. Run: uvicorn app.main:app --port 8000"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pymongo.errors import PyMongoError

from . import __version__, database
from .config import get_settings
from .routes import router

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("leash")
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await database.connect()
    yield
    await database.close()


app = FastAPI(title="Leash API", version=__version__, lifespan=lifespan,
              docs_url=None if settings.is_production else "/docs",
              redoc_url=None, openapi_url=None if settings.is_production else "/openapi.json")

app.add_middleware(CORSMiddleware, allow_origins=settings.origins, allow_credentials=True,
                   allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"], allow_headers=["Content-Type", "Authorization"])


@app.middleware("http")
async def security_headers(request: Request, call_next):
    res = await call_next(request)
    res.headers["X-Content-Type-Options"] = "nosniff"
    res.headers["Referrer-Policy"] = "no-referrer"
    res.headers["Cache-Control"] = "no-store"
    return res


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, exc: RequestValidationError):
    e = exc.errors()[0]
    field = ".".join(str(p) for p in e["loc"] if p != "body")
    msg = str(e.get("msg", "Invalid input")).replace("Value error, ", "")
    return JSONResponse(status_code=422, content={"detail": f"{field}: {msg}" if field else msg})


@app.exception_handler(PyMongoError)
async def mongo_error(request: Request, exc: PyMongoError):
    log.error("Database error: %s", exc)
    return JSONResponse(status_code=503, content={"detail": "Database unavailable. Try again shortly."})


@app.exception_handler(Exception)
async def unhandled(request: Request, exc: Exception):
    log.exception("Unhandled error")
    return JSONResponse(status_code=500, content={"detail": "Internal error"})


@app.get("/")
async def root():
    return {"service": "leash-api", "version": __version__, "health": "/api/health"}


app.include_router(router)
