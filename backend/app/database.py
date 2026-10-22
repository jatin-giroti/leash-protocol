"""Motor (async MongoDB) connection, indexes and the FastAPI db dependency."""
import logging
from typing import Optional

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from .config import get_settings

log = logging.getLogger("leash.db")
_client: Optional[AsyncIOMotorClient] = None
_db: Optional[AsyncIOMotorDatabase] = None
_indexed = False


async def ensure_indexes() -> None:
    global _indexed
    s = get_settings()
    db = _db
    await db.users.create_index("email", unique=True)
    await db.policies.create_index("user_id", unique=True)
    await db.trades.create_index([("user_id", 1), ("seq", 1)], unique=True)   # optimistic concurrency for the ledger
    await db.trades.create_index([("user_id", 1), ("created_at", -1)])
    await db.api_tokens.create_index("token_hash", unique=True)
    await db.api_tokens.create_index("user_id")
    await db.auth_attempts.create_index("created_at", expireAfterSeconds=s.auth_window_seconds)  # TTL cleanup
    await db.auth_attempts.create_index("ip")
    _indexed = True
    log.info("MongoDB indexes ready")


async def connect() -> None:
    global _client, _db
    s = get_settings()
    _client = AsyncIOMotorClient(s.mongodb_uri, serverSelectionTimeoutMS=5000, tz_aware=True)
    _db = _client[s.mongodb_db]
    try:
        await ensure_indexes()
    except Exception as exc:  # do not crash the boot; the first request retries
        log.warning("Index setup deferred: %s", exc)


async def close() -> None:
    if _client is not None:
        _client.close()


async def get_db() -> AsyncIOMotorDatabase:
    """FastAPI dependency. Retries index creation if the first attempt failed."""
    if _db is None:
        raise RuntimeError("Database is not initialised")
    if not _indexed:
        await ensure_indexes()
    return _db


async def ping() -> bool:
    try:
        await _client.admin.command("ping")
        return True
    except Exception:
        return False
