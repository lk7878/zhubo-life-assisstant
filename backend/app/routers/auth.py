"""认证相关 API：登录、获取当前用户、修改自己密码、登出（前端清 token）。"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User, OperationLog, OperationType
from ..schemas import LoginRequest, LoginResponse, UserResponse, ChangePasswordRequest
from ..utils.security import verify_password, hash_password, make_user_token
from ..utils.auth_deps import get_current_user
from ..utils.request_context import get_current_ip


router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == payload.username).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="用户名或密码错误")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="账号已停用，请联系管理员")

    user.last_login_at = datetime.now()
    user.last_login_ip = get_current_ip()
    db.add(OperationLog(
        operator=user.real_name or user.username,
        user_id=user.id,
        action=OperationType.UPDATE,
        target_type="auth",
        target_id=user.id,
        target_name=user.username,
        details="用户登录",
        ip_address=get_current_ip(),
    ))
    db.commit()
    db.refresh(user)

    role_val = user.role.value if hasattr(user.role, "value") else str(user.role)
    token = make_user_token(user.id, user.username, role_val)
    return LoginResponse(access_token=token, user=UserResponse.model_validate(user))


@router.get("/me", response_model=UserResponse)
def whoami(current: User = Depends(get_current_user)):
    return current


@router.post("/logout")
def logout(current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """登出主要是前端清 token，这里只记录一条日志。"""
    db.add(OperationLog(
        operator=current.real_name or current.username,
        user_id=current.id,
        action=OperationType.UPDATE,
        target_type="auth",
        target_id=current.id,
        target_name=current.username,
        details="用户登出",
        ip_address=get_current_ip(),
    ))
    db.commit()
    return {"ok": True}


@router.put("/change-password", response_model=UserResponse)
def change_password(
    payload: ChangePasswordRequest,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(payload.old_password, current.password_hash):
        raise HTTPException(status_code=400, detail="原密码不正确")
    if len(payload.new_password) < 6:
        raise HTTPException(status_code=400, detail="新密码至少 6 位")
    current.password_hash = hash_password(payload.new_password)
    current.updated_at = datetime.now()
    db.add(OperationLog(
        operator=current.real_name or current.username,
        user_id=current.id,
        action=OperationType.UPDATE,
        target_type="user",
        target_id=current.id,
        target_name=current.username,
        details="修改自己密码",
        ip_address=get_current_ip(),
    ))
    db.commit()
    db.refresh(current)
    return current
