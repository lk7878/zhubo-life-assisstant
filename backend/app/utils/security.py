"""认证安全工具：
- PBKDF2 密码哈希 + 盐
- HS256 JWT（零依赖：仅 hmac/hashlib/base64/json）
"""
import os
import hmac
import json
import time
import base64
import hashlib
import secrets
from typing import Optional, Dict, Any


# === 密钥配置 ===
SECRET_KEY = os.environ.get("ZHUBO_SECRET_KEY", "zhubo-life-assistant-default-secret-do-not-use-in-prod")
JWT_ALG = "HS256"
JWT_EXP_HOURS = 24 * 7  # 7 天


# ====== 密码哈希 (PBKDF2-SHA256) ======
def hash_password(password: str, *, iterations: int = 200_000) -> str:
    salt = secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return f"pbkdf2_sha256${iterations}${base64.b64encode(salt).decode()}${base64.b64encode(dk).decode()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algo, iters, salt_b64, hash_b64 = stored.split("$")
        if algo != "pbkdf2_sha256":
            return False
        salt = base64.b64decode(salt_b64)
        expected = base64.b64decode(hash_b64)
        dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, int(iters))
        return hmac.compare_digest(dk, expected)
    except Exception:
        return False


# ====== JWT (HS256) ======
def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(s: str) -> bytes:
    pad = "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s + pad)


def create_access_token(payload: Dict[str, Any], expires_hours: int = JWT_EXP_HOURS) -> str:
    header = {"alg": JWT_ALG, "typ": "JWT"}
    body = dict(payload)
    now = int(time.time())
    body.setdefault("iat", now)
    body.setdefault("exp", now + expires_hours * 3600)
    h = _b64url(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    p = _b64url(json.dumps(body, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{h}.{p}".encode("ascii")
    sig = hmac.new(SECRET_KEY.encode("utf-8"), signing_input, hashlib.sha256).digest()
    return f"{h}.{p}.{_b64url(sig)}"


class TokenError(Exception):
    pass


def decode_access_token(token: str) -> Dict[str, Any]:
    try:
        h, p, s = token.split(".")
    except ValueError:
        raise TokenError("token 格式错误")
    signing_input = f"{h}.{p}".encode("ascii")
    expected_sig = hmac.new(SECRET_KEY.encode("utf-8"), signing_input, hashlib.sha256).digest()
    if not hmac.compare_digest(_b64url(expected_sig), s):
        raise TokenError("签名错误")
    try:
        payload = json.loads(_b64url_decode(p))
    except Exception:
        raise TokenError("payload 解析失败")
    if int(payload.get("exp", 0)) < int(time.time()):
        raise TokenError("token 已过期")
    return payload


def make_user_token(user_id: str, username: str, role: str) -> str:
    return create_access_token({
        "sub": user_id,
        "username": username,
        "role": role,
    })
