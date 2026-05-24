"""鉴权依赖：FastAPI 用的 Depends 工厂。"""
from typing import Optional, Iterable
from fastapi import Depends, HTTPException, status, Header
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User, UserRole
from .security import decode_access_token, TokenError
from .request_context import current_user_ctx


def _extract_token(authorization: Optional[str]) -> Optional[str]:
    if not authorization:
        return None
    parts = authorization.split()
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1]
    return None


async def get_current_user(
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
) -> User:
    """解析 Authorization Bearer，返回当前用户实例；同时把简略信息塞到 ContextVar。

    注意：本依赖必须是 async，才能让 current_user_ctx.set(...) 修改请求主 task 的
    context。否则改动只发生在 threadpool 拷贝里，后续 sync handler / log_operation
    读到的会是 None（导致 operator 字段退化为 “系统”）。
    """
    token = _extract_token(authorization)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="未登录或令牌缺失")
    try:
        payload = decode_access_token(token)
    except TokenError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"无效令牌：{e}")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="令牌缺少用户标识")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="用户不存在")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="账号已停用")

    # 写入 ContextVar，供 log_operation / 业务代码使用
    current_user_ctx.set({
        "id": user.id,
        "username": user.username,
        "real_name": user.real_name,
        "role": user.role.value if hasattr(user.role, "value") else str(user.role),
    })
    return user


def require_role(*roles: UserRole):
    """工厂：限制只允许特定角色访问。

    用法：
        @router.post(..., dependencies=[Depends(require_role(UserRole.ADMIN))])
    或：
        Depends(require_role(UserRole.ADMIN, UserRole.FINANCE))
    """
    role_values = {r.value if hasattr(r, "value") else str(r) for r in roles}

    def _checker(user: User = Depends(get_current_user)) -> User:
        user_role = user.role.value if hasattr(user.role, "value") else str(user.role)
        if user_role not in role_values:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"权限不足，需要角色：{','.join(sorted(role_values))}",
            )
        return user

    return _checker


def require_admin(user: User = Depends(get_current_user)) -> User:
    user_role = user.role.value if hasattr(user.role, "value") else str(user.role)
    if user_role != UserRole.ADMIN.value:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="仅管理员可操作")
    return user
