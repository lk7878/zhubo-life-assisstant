from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Anchor, LiveRecord, OperationLog, OperationType, UserRole
from ..schemas import LiveRecordCreate, LiveRecordListResponse, LiveRecordResponse, LiveRecordUpdate
from ..utils.auth_deps import require_role

router = APIRouter(prefix="/api/live-records", tags=["live-records"])

BUSINESS_WRITE = [Depends(require_role(UserRole.ADMIN, UserRole.OPERATOR))]


def log_operation(db: Session, action: OperationType, target_type: str, target_id: str = None, target_name: str = None, details: str = None):
    from ..utils.request_context import get_current_ip, get_audit_operator, get_audit_user_id
    log = OperationLog(
        operator=get_audit_operator(),
        user_id=get_audit_user_id(),
        action=action,
        target_type=target_type,
        target_id=target_id,
        target_name=target_name,
        details=details,
        ip_address=get_current_ip(),
    )
    db.add(log)


def serialize_live_record(record: LiveRecord) -> LiveRecordResponse:
    data = {
        "id": record.id,
        "anchor_id": record.anchor_id,
        "anchor_name": record.anchor.name if record.anchor else None,
        "anchor_stage_name": record.anchor.stage_name if record.anchor else None,
        "platform": record.platform,
        "live_room": record.live_room,
        "live_date": record.live_date,
        "live_end_time": record.live_end_time,
        "duration_minutes": record.duration_minutes,
        "viewers_count": record.viewers_count,
        "new_followers": record.new_followers,
        "gmv": record.gmv,
        "orders_count": record.orders_count,
        "conversion_rate": record.conversion_rate,
        "review": record.review,
        "problems": record.problems,
        "improvements": record.improvements,
        "created_at": record.created_at,
        "updated_at": record.updated_at,
    }
    return LiveRecordResponse(**data)


@router.get("", response_model=LiveRecordListResponse)
def get_live_records(
    anchor_id: Optional[str] = None,
    platform: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(LiveRecord)

    if anchor_id:
        query = query.filter(LiveRecord.anchor_id == anchor_id)

    if platform:
        query = query.filter(LiveRecord.platform == platform)

    total = query.count()
    items = query.order_by(LiveRecord.live_date.desc()).offset(skip).limit(limit).all()
    return LiveRecordListResponse(items=[serialize_live_record(item) for item in items], total=total)


@router.get("/{record_id}", response_model=LiveRecordResponse)
def get_live_record(record_id: str, db: Session = Depends(get_db)):
    record = db.query(LiveRecord).filter(LiveRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="直播记录不存在")
    return serialize_live_record(record)


@router.post("", response_model=LiveRecordResponse, status_code=201, dependencies=BUSINESS_WRITE)
def create_live_record(record_data: LiveRecordCreate, db: Session = Depends(get_db)):
    anchor = db.query(Anchor).filter(Anchor.id == record_data.anchor_id).first()
    if not anchor:
        raise HTTPException(status_code=404, detail="主播不存在")

    data = record_data.model_dump()
    data["platform"] = "快手"
    record = LiveRecord(**data)
    db.add(record)
    db.flush()

    log_operation(
        db,
        OperationType.CREATE,
        "live_record",
        target_id=record.id,
        target_name=f"{anchor.stage_name} {record.live_date.strftime('%Y-%m-%d')}",
        details=f"创建直播记录: {anchor.name}({anchor.stage_name})"
    )

    db.commit()
    db.refresh(record)
    return serialize_live_record(record)


@router.put("/{record_id}", response_model=LiveRecordResponse, dependencies=BUSINESS_WRITE)
def update_live_record(record_id: str, record_data: LiveRecordUpdate, db: Session = Depends(get_db)):
    record = db.query(LiveRecord).filter(LiveRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="直播记录不存在")

    update_data = record_data.model_dump(exclude_unset=True)
    update_data["platform"] = "快手"
    if "anchor_id" in update_data:
        anchor = db.query(Anchor).filter(Anchor.id == update_data["anchor_id"]).first()
        if not anchor:
            raise HTTPException(status_code=404, detail="主播不存在")

    changes = []
    for key, value in update_data.items():
        old_value = getattr(record, key)
        if old_value != value:
            changes.append(f"{key}: {old_value} -> {value}")
        setattr(record, key, value)

    record.updated_at = datetime.now()

    if changes:
        log_operation(
            db,
            OperationType.UPDATE,
            "live_record",
            target_id=record.id,
            target_name=f"{record.anchor.stage_name if record.anchor else ''} {record.live_date.strftime('%Y-%m-%d')}",
            details=f"更新直播记录: {', '.join(changes)}"
        )

    db.commit()
    db.refresh(record)
    return serialize_live_record(record)


@router.delete("/{record_id}", status_code=204, dependencies=BUSINESS_WRITE)
def delete_live_record(record_id: str, db: Session = Depends(get_db)):
    record = db.query(LiveRecord).filter(LiveRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="直播记录不存在")

    target_name = f"{record.anchor.stage_name if record.anchor else ''} {record.live_date.strftime('%Y-%m-%d')}"
    log_operation(
        db,
        OperationType.DELETE,
        "live_record",
        target_id=record.id,
        target_name=target_name,
        details=f"删除直播记录: {target_name}"
    )

    db.delete(record)
    db.commit()
    return None
