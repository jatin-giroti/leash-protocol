"""All HTTP routes: auth, policy, kill switch, simulation, ledger, proofs, SDK tokens."""
import asyncio
import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pymongo.errors import DuplicateKeyError

from . import __version__, database, zk_engine as zk
from .config import get_settings
from .database import get_db
from .models import (Credentials, FreezeRequest, HealthOut, MeOut, PolicyOut, PolicyUpdate, SessionOut, SimulateOut,
                     SimulateRequest, SnapshotOut, TokenInfo, TokenOut, TokenRequest, TradeOut, TradesOut, VerifyOut)

router = APIRouter(prefix="/api")
S = get_settings()
COOKIE = "leash_session"


def now() -> datetime:
    return datetime.now(timezone.utc)


# ---------- passwords and sessions ----------
def _scrypt(pw: str, salt: bytes) -> bytes:
    return hashlib.scrypt(pw.encode(), salt=salt, n=2**14, r=8, p=1)


def _hash_pw(pw: str) -> str:
    salt = os.urandom(16)
    return salt.hex() + ":" + _scrypt(pw, salt).hex()


def _check_pw(pw: str, stored: str) -> bool:
    salt, h = stored.split(":")
    return hmac.compare_digest(_scrypt(pw, bytes.fromhex(salt)).hex(), h)


_DUMMY = _hash_pw("timing-equalizer")  # equalises login time for unknown emails


def _issue_token(uid: str) -> str:
    t = now()
    return jwt.encode({"sub": uid, "iat": t, "exp": t + timedelta(minutes=S.jwt_expire_minutes)}, S.jwt_secret, algorithm="HS256")


def _set_cookie(res: Response, token: str) -> None:
    res.set_cookie(COOKIE, token, httponly=True, secure=S.cookie_secure, samesite=S.cookie_samesite,
                   max_age=S.jwt_expire_minutes * 60, path="/")


def _uid_from(request: Request) -> Optional[ObjectId]:
    token = request.cookies.get(COOKIE)
    auth = request.headers.get("authorization", "")
    if not token and auth.lower().startswith("bearer "):
        token = auth[7:].strip()
    if not token:
        return None
    try:
        return ObjectId(jwt.decode(token, S.jwt_secret, algorithms=["HS256"])["sub"])
    except (jwt.PyJWTError, InvalidId, KeyError, TypeError):
        return None


async def optional_user(request: Request, db=Depends(get_db)) -> Optional[dict]:
    uid = _uid_from(request)
    return await db.users.find_one({"_id": uid}) if uid else None


async def current_user(user=Depends(optional_user)) -> dict:
    if not user:
        raise HTTPException(401, "Sign in required")
    return user


async def throttle(request: Request, db=Depends(get_db)) -> None:
    ip = request.client.host if request.client else "unknown"
    since = now() - timedelta(seconds=S.auth_window_seconds)
    if await db.auth_attempts.count_documents({"ip": ip, "created_at": {"$gt": since}}) >= S.auth_max_attempts:
        raise HTTPException(429, "Too many attempts. Try again in 15 minutes.")
    await db.auth_attempts.insert_one({"ip": ip, "created_at": now()})


# ---------- shared helpers ----------
async def spent24(db, uid: ObjectId) -> int:
    cutoff = now() - timedelta(seconds=S.window_seconds)
    rows = await db.trades.aggregate([
        {"$match": {"user_id": uid, "status": "verified", "created_at": {"$gt": cutoff}}},
        {"$group": {"_id": None, "s": {"$sum": "$amount_usdc"}}},
    ]).to_list(1)
    return int(rows[0]["s"]) if rows else 0


async def seed(db, uid: ObjectId) -> None:
    await db.trades.insert_one({"user_id": uid, "seq": 1, "scenario": "seed", "intent": "Opening 24h balance",
                                "amount_usdc": zk.SEED_BALANCE, "status": "verified", "reason": None, "gas": 0,
                                "created_at": now()})


async def snapshot(db, uid: ObjectId) -> dict:
    p = await db.policies.find_one({"user_id": uid})
    if not p:
        raise HTTPException(404, "Policy not found")
    return {"policy": {"cap": p["cap_usdc"], "strict": p["strict"], "frozen": p["frozen"]},
            "spent24h": await spent24(db, uid),
            "commitment": zk.commitment(str(uid), p["cap_usdc"], p["strict"], p["salt"])}


def _user_out(u: dict) -> dict:
    return {"id": str(u["_id"]), "email": u["email"]}


# ---------- health and metadata ----------
@router.get("/health", response_model=HealthOut)
async def health():
    return {"ok": True, "db": await database.ping(), "version": __version__}


@router.get("/zk/model-info")
async def model_info():
    return {"status": "ready", "circuit": "leash_policy_v1", "proof_system": "Groth16 (simulated attestation in this build)",
            "curve": "BN254", "hash": "SHA-256 stand-in for Poseidon", "account_standard": "ERC-4337 v0.7",
            "allowlist_root": zk.ROOT, "allowlist_size": len(zk.ALLOWLIST), "window_seconds": S.window_seconds,
            "constraints": ["c1 commitment opens", "c2 allowlist membership", "c3 rolling 24h cap", "c4 slippage bound"]}


# ---------- auth ----------
@router.post("/auth/signup", response_model=SessionOut, status_code=201, dependencies=[Depends(throttle)])
async def signup(body: Credentials, res: Response, db=Depends(get_db)):
    pw_hash = await asyncio.to_thread(_hash_pw, body.password)
    try:
        uid = (await db.users.insert_one({"email": body.email, "pw_hash": pw_hash, "created_at": now()})).inserted_id
    except DuplicateKeyError:
        raise HTTPException(409, "An account with this email already exists. Sign in instead.")
    try:
        await db.policies.insert_one({"user_id": uid, "cap_usdc": 10000, "strict": True, "frozen": False,
                                      "salt": secrets.token_hex(16), "updated_at": now()})
        await seed(db, uid)
    except Exception:
        await db.users.delete_one({"_id": uid})
        await db.policies.delete_one({"user_id": uid})
        await db.trades.delete_many({"user_id": uid})
        raise
    token = _issue_token(str(uid))
    _set_cookie(res, token)
    return {"user": {"id": str(uid), "email": body.email}, "access_token": token, **await snapshot(db, uid)}


@router.post("/auth/login", response_model=SessionOut, dependencies=[Depends(throttle)])
async def login(body: Credentials, res: Response, db=Depends(get_db)):
    u = await db.users.find_one({"email": body.email})
    ok = await asyncio.to_thread(_check_pw, body.password, u["pw_hash"] if u else _DUMMY)
    if not u or not ok:
        raise HTTPException(401, "Email or password is incorrect.")
    token = _issue_token(str(u["_id"]))
    _set_cookie(res, token)
    return {"user": _user_out(u), "access_token": token, **await snapshot(db, u["_id"])}


@router.post("/auth/logout")
async def logout(res: Response):
    res.delete_cookie(COOKIE, path="/", secure=S.cookie_secure, httponly=True, samesite=S.cookie_samesite)
    return {"ok": True}


@router.get("/me", response_model=MeOut)
async def me(user=Depends(optional_user), db=Depends(get_db)):
    """Always 200 so anonymous page loads produce no console errors."""
    if not user:
        return {"user": None}
    return {"user": _user_out(user), **await snapshot(db, user["_id"])}


# ---------- policy and kill switch ----------
@router.get("/policy", response_model=SnapshotOut)
async def get_policy(user=Depends(current_user), db=Depends(get_db)):
    return await snapshot(db, user["_id"])


@router.put("/policy", response_model=SnapshotOut)
async def update_policy(body: PolicyUpdate, user=Depends(current_user), db=Depends(get_db)):
    changes = {"updated_at": now()}
    if body.cap is not None:
        changes["cap_usdc"] = body.cap
    if body.strict is not None:
        changes["strict"] = body.strict
    await db.policies.update_one({"user_id": user["_id"]}, {"$set": changes})
    return await snapshot(db, user["_id"])


@router.post("/freeze", response_model=SnapshotOut)
async def freeze(body: FreezeRequest, user=Depends(current_user), db=Depends(get_db)):
    await db.policies.update_one({"user_id": user["_id"]}, {"$set": {"frozen": body.frozen, "updated_at": now()}})
    return await snapshot(db, user["_id"])


@router.post("/reset", response_model=SnapshotOut)
async def reset(user=Depends(current_user), db=Depends(get_db)):
    await db.trades.delete_many({"user_id": user["_id"]})
    await seed(db, user["_id"])
    return await snapshot(db, user["_id"])


# ---------- simulation ----------
@router.post("/simulate", response_model=SimulateOut)
async def simulate(body: SimulateRequest, user=Depends(current_user), db=Depends(get_db)):
    """Evaluates the scenario server-side against the stored policy and the 24h ledger.
    The unique (user_id, seq) index makes concurrent requests safe: a loser re-reads the ledger and re-evaluates."""
    uid, s = user["_id"], zk.SCENARIOS[body.scenario]
    for _ in range(6):
        pol = await db.policies.find_one({"user_id": uid})
        if not pol:
            raise HTTPException(404, "Policy not found")
        last = await db.trades.find_one({"user_id": uid}, sort=[("seq", -1)], projection={"seq": 1})
        seq = (last["seq"] if last else 0) + 1
        ev = zk.evaluate(body.scenario, pol["cap_usdc"], pol["strict"], pol["frozen"], await spent24(db, uid))
        com = zk.commitment(str(uid), pol["cap_usdc"], pol["strict"], pol["salt"])
        uoh = zk.new_user_op_hash(str(uid), body.scenario, s["intent"])
        nf = zk.nullifier(pol["salt"], uoh)
        proof = zk.make_proof(S.jwt_secret, com, uoh, nf) if ev.ok else None
        gas = zk.VERIFIER_GAS if ev.ok else 0
        try:
            await db.trades.insert_one({
                "user_id": uid, "seq": seq, "scenario": body.scenario, "intent": s["intent"], "amount_usdc": s["amt"],
                "status": "verified" if ev.ok else "rejected", "reason": ev.reason, "gas": gas,
                "commitment": com if ev.ok else None, "user_op_hash": uoh if ev.ok else None,
                "nullifier": nf if ev.ok else None, "proof_digest": proof["digest"] if proof else None,
                "created_at": now()})
            break
        except DuplicateKeyError:
            continue
    else:
        raise HTTPException(409, "Ledger is busy. Try again.")
    return {"status": "verified" if ev.ok else "rejected", "reason": ev.reason, "paused": ev.paused,
            "constraints": ev.constraints, "proof": proof, "gas": gas, "proofMs": zk.PROOF_MS if ev.ok else None,
            "intent": s["intent"], "amount": s["amt"], **await snapshot(db, uid)}


# ---------- ledger, proofs, tokens ----------
@router.get("/trades", response_model=TradesOut)
async def trades(user=Depends(current_user), db=Depends(get_db)):
    rows = await db.trades.find({"user_id": user["_id"]}).sort("seq", -1).limit(50).to_list(50)
    return {"trades": [{**{k: r.get(k) for k in ("scenario", "intent", "amount_usdc", "status", "reason", "gas", "created_at")},
                        "id": str(r["_id"])} for r in rows]}


@router.get("/zk/verify/{trade_id}", response_model=VerifyOut)
async def verify_trade(trade_id: str, user=Depends(current_user), db=Depends(get_db)):
    try:
        oid = ObjectId(trade_id)
    except InvalidId:
        raise HTTPException(404, "Trade not found.")
    t = await db.trades.find_one({"_id": oid, "user_id": user["_id"]})
    if not t:
        raise HTTPException(404, "Trade not found.")
    if t["status"] != "verified" or not t.get("proof_digest"):
        return {"trade_id": trade_id, "valid": False, "detail": "No proof was generated for this trade."}
    proof = {"digest": t["proof_digest"],
             "public": {"commitment": t["commitment"], "userOpHash": t["user_op_hash"], "nullifier": t["nullifier"]}}
    return {"trade_id": trade_id, "valid": zk.verify_proof(S.jwt_secret, proof)}


@router.post("/tokens", response_model=TokenOut, status_code=201)
async def issue_token(body: TokenRequest, user=Depends(current_user), db=Depends(get_db)):
    token = "lsh_test_" + secrets.token_hex(20)
    await db.api_tokens.insert_one({"user_id": user["_id"], "token_hash": hashlib.sha256(token.encode()).hexdigest(),
                                    "prefix": token[:13], "network": body.network, "created_at": now()})
    return {"token": token, "network": body.network, "commitment": (await snapshot(db, user["_id"]))["commitment"]}


@router.get("/tokens", response_model=list[TokenInfo])
async def list_tokens(user=Depends(current_user), db=Depends(get_db)):
    rows = await db.api_tokens.find({"user_id": user["_id"]}).sort("created_at", -1).limit(50).to_list(50)
    return [{"id": str(r["_id"]), "prefix": r["prefix"], "network": r["network"], "created_at": r["created_at"]} for r in rows]
