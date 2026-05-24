"""请求级上下文：用 ContextVar 把当前请求的客户端 IP 和用户身份暴露给各业务模块，
避免在每个 handler 上都把 Request / current_user 传到 log_operation。"""
from contextvars import ContextVar
from typing import Optional, Dict, Any

client_ip_ctx: ContextVar[Optional[str]] = ContextVar("client_ip", default=None)
current_user_ctx: ContextVar[Optional[Dict[str, Any]]] = ContextVar("current_user", default=None)


def get_current_ip() -> Optional[str]:
    return client_ip_ctx.get()


def get_current_user_info() -> Optional[Dict[str, Any]]:
    """返回 {id, username, role, real_name} 或 None。"""
    return current_user_ctx.get()


def get_audit_operator() -> str:
    """日志 operator 字段：当前用户名（无登录则 '系统'）。"""
    info = current_user_ctx.get()
    if not info:
        return "系统"
    return info.get("real_name") or info.get("username") or "系统"


def get_audit_user_id() -> Optional[str]:
    info = current_user_ctx.get()
    return info.get("id") if info else None
