"""Environment-driven settings (pydantic-settings)."""
import secrets
from functools import lru_cache
from typing import List, Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    environment: str = "development"
    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_db: str = "leash"
    jwt_secret: str = ""
    jwt_expire_minutes: int = 60 * 24 * 7
    cors_origins: str = "http://localhost:3000"
    cookie_secure: bool = False
    cookie_samesite: Literal["lax", "strict", "none"] = "lax"
    window_seconds: int = 86400          # rolling spend window
    auth_max_attempts: int = 20          # per IP
    auth_window_seconds: int = 900

    @model_validator(mode="after")
    def _check(self):
        if len(self.jwt_secret) < 32:
            if self.environment == "production":
                raise ValueError("JWT_SECRET must be at least 32 characters in production")
            self.jwt_secret = secrets.token_hex(32)  # dev only: sessions reset on restart
        if self.cookie_samesite == "none" and not self.cookie_secure:
            raise ValueError("COOKIE_SAMESITE=none requires COOKIE_SECURE=true")
        return self

    @property
    def origins(self) -> List[str]:
        return [o.strip().rstrip("/") for o in self.cors_origins.split(",") if o.strip() and o.strip() != "*"]

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
