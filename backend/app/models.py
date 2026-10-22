"""Pydantic v2 request and response schemas."""
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

Network = Literal["Ethereum Sepolia", "Base Sepolia", "Arbitrum Sepolia"]
NETWORKS = ["Ethereum Sepolia", "Base Sepolia", "Arbitrum Sepolia"]


class Credentials(BaseModel):
    email: EmailStr
    password: str = Field(min_length=10, max_length=128)

    @field_validator("email", mode="after")
    @classmethod
    def _lower(cls, v: str) -> str:
        return v.strip().lower()


class PolicyUpdate(BaseModel):
    cap: Optional[int] = Field(default=None, ge=1000, le=1_000_000)
    strict: Optional[bool] = None

    @model_validator(mode="after")
    def _nonempty(self):
        if self.cap is None and self.strict is None:
            raise ValueError("Provide cap or strict")
        return self


class FreezeRequest(BaseModel):
    frozen: bool


class SimulateRequest(BaseModel):
    scenario: Literal["A", "B", "C"]


class TokenRequest(BaseModel):
    network: Network = "Ethereum Sepolia"


class UserOut(BaseModel):
    id: str
    email: str


class PolicyOut(BaseModel):
    cap: int
    strict: bool
    frozen: bool


class SnapshotOut(BaseModel):
    policy: PolicyOut
    spent24h: int
    commitment: str


class SessionOut(SnapshotOut):
    user: UserOut
    access_token: Optional[str] = None  # also set as an httpOnly cookie


class MeOut(BaseModel):
    user: Optional[UserOut] = None
    policy: Optional[PolicyOut] = None
    spent24h: Optional[int] = None
    commitment: Optional[str] = None


class ConstraintOut(BaseModel):
    id: str
    name: str
    ok: bool


class SimulateOut(SnapshotOut):
    status: Literal["verified", "rejected"]
    reason: Optional[str] = None
    paused: bool = False
    constraints: List[ConstraintOut]
    proof: Optional[Dict[str, Any]] = None
    gas: int
    proofMs: Optional[int] = None
    intent: str
    amount: int


class TradeOut(BaseModel):
    id: str
    scenario: str
    intent: str
    amount_usdc: int
    status: str
    reason: Optional[str] = None
    gas: int
    created_at: datetime


class TradesOut(BaseModel):
    trades: List[TradeOut]


class VerifyOut(BaseModel):
    trade_id: str
    valid: bool
    detail: Optional[str] = None


class TokenOut(BaseModel):
    token: str
    network: str
    commitment: str


class TokenInfo(BaseModel):
    id: str
    prefix: str
    network: str
    created_at: datetime


class HealthOut(BaseModel):
    ok: bool
    db: bool
    version: str
