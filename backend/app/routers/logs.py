from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta

from ..database import get_db
from ..models import OperationLog, OperationType
from ..schemas import OperationLogListResponse, OperationLogResponse

router = APIRouter(prefix="/api/logs", tags=["logs"])


@router.get("", response_model=OperationLogListResponse)
def get_logs(
    target_type: Optional[str] = None,
    action: Optional[str] = None,
    days: Optional[int] = Query(default=7, ge=1, le=90),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """获取操作日志列表"""
    query = db.query(OperationLog)

    if target_type:
        query = query.filter(OperationLog.target_type == target_type)

    if action:
        query = query.filter(OperationLog.action == action)

    # 默认查询最近 N 天的日志
    if days:
        cutoff = datetime.now() - timedelta(days=days)
        query = query.filter(OperationLog.created_at >= cutoff)

    total = query.count()
    items = query.order_by(OperationLog.created_at.desc()).offset(skip).limit(limit).all()

    return OperationLogListResponse(items=items, total=total)


@router.get("/{log_id}", response_model=OperationLogResponse)
def get_log(log_id: str, db: Session = Depends(get_db)):
    """获取单条日志详情"""
    log = db.query(OperationLog).filter(OperationLog.id == log_id).first()
    if not log:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="日志不存在")
    return log


def create_log(
    db: Session,
    action: OperationType,
    target_type: str,
    target_id: str = None,
    target_name: str = None,
    details: str = None,
    operator: str = "系统"
):
    """创建操作日志（供其他模块调用）"""
    log = OperationLog(
        operator=operator,
        action=action,
        target_type=target_type,
        target_id=target_id,
        target_name=target_name,
        details=details
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log