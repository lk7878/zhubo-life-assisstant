"""用户管理 API：仅管理员可访问。"""
import os
import shutil
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import (
    Anchor, Contract, Equipment, EquipmentLoan, FileRecord, LiveRecord, LiveRoom,
    Node, OperationLog, OperationType, SalaryConfig, SalaryRecord,
    Training, TrainingAttendance, User, UserRole,
)
from ..schemas import (
    UserCreate, UserUpdate, UserPasswordReset,
    UserResponse, UserListResponse,
)
from ..config import FILES_DIR
from ..utils.security import hash_password
from ..utils.auth_deps import require_admin
from ..utils.request_context import get_current_ip


router = APIRouter(
    prefix="/api/users",
    tags=["users"],
    dependencies=[Depends(require_admin)],  # 整个路由组仅管理员
)


def _log(db: Session, actor: User, action: OperationType, target: User, details: str):
    db.add(OperationLog(
        operator=actor.real_name or actor.username,
        user_id=actor.id,
        action=action,
        target_type="user",
        target_id=target.id,
        target_name=target.username,
        details=details,
        ip_address=get_current_ip(),
    ))


def _clear_dir_contents(path: str):
    if not os.path.isdir(path):
        os.makedirs(path, exist_ok=True)
        return
    for name in os.listdir(path):
        p = os.path.join(path, name)
        if os.path.isdir(p):
            shutil.rmtree(p)
        else:
            os.remove(p)


@router.get("", response_model=UserListResponse)
def list_users(
    role: Optional[UserRole] = None,
    is_active: Optional[bool] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    q = db.query(User)
    if role is not None:
        q = q.filter(User.role == role)
    if is_active is not None:
        q = q.filter(User.is_active == is_active)
    if search:
        like = f"%{search}%"
        q = q.filter((User.username.like(like)) | (User.real_name.like(like)))
    total = q.count()
    items = q.order_by(User.created_at.desc()).offset(skip).limit(limit).all()
    return UserListResponse(items=items, total=total)


@router.post("/reset-business-data")
def reset_business_data(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    models = [
        EquipmentLoan,
        FileRecord,
        TrainingAttendance,
        SalaryRecord,
        SalaryConfig,
        Contract,
        Equipment,
        Node,
        LiveRecord,
        Training,
        LiveRoom,
        Anchor,
        OperationLog,
    ]
    deleted = {}
    try:
        db.query(Contract).update({Contract.previous_contract_id: None}, synchronize_session=False)
        for model in models:
            deleted[model.__tablename__] = db.query(model).delete(synchronize_session=False)

        _clear_dir_contents(FILES_DIR)
        contracts_upload_dir = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
            "uploads",
            "contracts",
        )
        _clear_dir_contents(contracts_upload_dir)

        db.commit()
    except Exception:
        db.rollback()
        raise

    return {"ok": True, "deleted": deleted}


@router.get("/{user_id}", response_model=UserResponse)
def get_user(user_id: str, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    return user


@router.post("", response_model=UserResponse, status_code=201)
def create_user(
    data: UserCreate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_admin),
):
    if not data.username or not data.password:
        raise HTTPException(status_code=400, detail="用户名和密码不能为空")
    if len(data.password) < 6:
        raise HTTPException(status_code=400, detail="密码至少 6 位")
    dup = db.query(User).filter(User.username == data.username).first()
    if dup:
        raise HTTPException(status_code=400, detail=f"用户名已存在: {data.username}")

    u = User(
        username=data.username,
        password_hash=hash_password(data.password),
        real_name=data.real_name,
        role=data.role,
        is_active=data.is_active if data.is_active is not None else True,
        remark=data.remark,
    )
    db.add(u)
    db.flush()
    _log(db, actor, OperationType.CREATE, u,
         f"创建用户 {u.username}（角色 {u.role.value}）")
    db.commit()
    db.refresh(u)
    return u


@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: str,
    data: UserUpdate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_admin),
):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="用户不存在")
    payload = data.model_dump(exclude_unset=True)

    # 防止 admin 把自己降级或停用
    if u.id == actor.id:
        if "role" in payload and payload["role"] != u.role:
            raise HTTPException(status_code=400, detail="不能修改自己的角色")
        if payload.get("is_active") is False:
            raise HTTPException(status_code=400, detail="不能停用自己的账号")

    changes = []
    for k, v in payload.items():
        old = getattr(u, k)
        old_val = old.value if hasattr(old, "value") else old
        new_val = v.value if hasattr(v, "value") else v
        if old_val != new_val:
            changes.append(f"{k}: {old_val} -> {new_val}")
        setattr(u, k, v)
    u.updated_at = datetime.now()

    if changes:
        _log(db, actor, OperationType.UPDATE, u,
             f"更新用户 {u.username}: {', '.join(changes)}")
    db.commit()
    db.refresh(u)
    return u


@router.put("/{user_id}/password", response_model=UserResponse)
def reset_password(
    user_id: str,
    data: UserPasswordReset,
    db: Session = Depends(get_db),
    actor: User = Depends(require_admin),
):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="用户不存在")
    if len(data.new_password) < 6:
        raise HTTPException(status_code=400, detail="密码至少 6 位")
    u.password_hash = hash_password(data.new_password)
    u.updated_at = datetime.now()
    _log(db, actor, OperationType.UPDATE, u, f"重置用户 {u.username} 密码")
    db.commit()
    db.refresh(u)
    return u


@router.delete("/{user_id}", status_code=204)
def delete_user(
    user_id: str,
    db: Session = Depends(get_db),
    actor: User = Depends(require_admin),
):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="用户不存在")
    if u.id == actor.id:
        raise HTTPException(status_code=400, detail="不能删除自己")
    # 至少保留一个启用的管理员
    if u.role == UserRole.ADMIN:
        other_admins = db.query(User).filter(
            User.role == UserRole.ADMIN,
            User.id != u.id,
            User.is_active == True,
        ).count()
        if other_admins == 0:
            raise HTTPException(status_code=400, detail="至少需要保留一个启用中的管理员")

    name = u.username
    _log(db, actor, OperationType.DELETE, u, f"删除用户 {name}")
    db.delete(u)
    db.commit()
    return None
