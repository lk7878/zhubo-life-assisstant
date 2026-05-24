from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_

from ..database import get_db
from ..models import (
    Anchor, Training, TrainingAttendance, LiveRecord,
    TrainingStatus, TrainingType, AttendanceStatus,
    OperationLog, OperationType, UserRole,
)
from ..schemas import (
    TrainingCreate, TrainingUpdate, TrainingResponse, TrainingDetailResponse, TrainingListResponse,
    AttendanceCreate, AttendanceUpdate, AttendanceResponse,
    TrainingEffectResponse, TrainingEffectMetric,
)
from ..utils.auth_deps import require_role

router = APIRouter(prefix="/api", tags=["trainings"])

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


def serialize_training(training: Training) -> dict:
    """构造 TrainingResponse 字典（带 attendance 计数）"""
    attendance_count = len(training.attendances) if training.attendances is not None else 0
    checked_in_count = sum(1 for a in (training.attendances or []) if a.status == AttendanceStatus.CHECKED_IN)
    return {
        "id": training.id,
        "title": training.title,
        "training_type": training.training_type,
        "trainer": training.trainer,
        "start_time": training.start_time,
        "end_time": training.end_time,
        "duration_minutes": training.duration_minutes,
        "mode": training.mode,
        "location": training.location,
        "description": training.description,
        "materials": training.materials,
        "status": training.status,
        "is_compliance": int(training.is_compliance or 0),
        "remark": training.remark,
        "created_at": training.created_at,
        "updated_at": training.updated_at,
        "attendance_count": attendance_count,
        "checked_in_count": checked_in_count,
    }


def serialize_attendance(attendance: TrainingAttendance) -> dict:
    return {
        "id": attendance.id,
        "training_id": attendance.training_id,
        "anchor_id": attendance.anchor_id,
        "anchor_name": attendance.anchor.name if attendance.anchor else None,
        "anchor_stage_name": attendance.anchor.stage_name if attendance.anchor else None,
        "status": attendance.status,
        "check_in_time": attendance.check_in_time,
        "check_in_method": attendance.check_in_method,
        "pre_training_note": attendance.pre_training_note,
        "post_training_note": attendance.post_training_note,
        "score": attendance.score,
        "remark": attendance.remark,
        "created_at": attendance.created_at,
        "updated_at": attendance.updated_at,
    }


# ---- Training CRUD ----

@router.get("/trainings", response_model=TrainingListResponse)
def list_trainings(
    keyword: Optional[str] = None,
    training_type: Optional[str] = None,
    status: Optional[str] = None,
    is_compliance: Optional[int] = None,
    anchor_id: Optional[str] = None,
    days: Optional[int] = Query(default=None, ge=1, le=365),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    query = db.query(Training)

    if keyword:
        like = f"%{keyword}%"
        query = query.filter(or_(Training.title.like(like), Training.trainer.like(like), Training.location.like(like)))
    if training_type:
        query = query.filter(Training.training_type == training_type)
    if status:
        query = query.filter(Training.status == status)
    if is_compliance is not None:
        query = query.filter(Training.is_compliance == int(bool(is_compliance)))
    if days:
        cutoff = datetime.now() - timedelta(days=days)
        query = query.filter(Training.start_time >= cutoff)
    if anchor_id:
        query = query.join(TrainingAttendance, TrainingAttendance.training_id == Training.id) \
                     .filter(TrainingAttendance.anchor_id == anchor_id).distinct()

    total = query.count()
    items = query.order_by(Training.start_time.desc()).offset(skip).limit(limit).all()
    return {
        "items": [serialize_training(t) for t in items],
        "total": total,
    }


@router.get("/trainings/{training_id}", response_model=TrainingDetailResponse)
def get_training(training_id: str, db: Session = Depends(get_db)):
    training = db.query(Training).filter(Training.id == training_id).first()
    if not training:
        raise HTTPException(status_code=404, detail="培训不存在")
    payload = serialize_training(training)
    payload["attendances"] = [serialize_attendance(a) for a in training.attendances]
    return payload


@router.post("/trainings", response_model=TrainingDetailResponse, status_code=201, dependencies=BUSINESS_WRITE)
def create_training(payload: TrainingCreate, db: Session = Depends(get_db)):
    data = payload.model_dump(exclude={"anchor_ids"})
    training = Training(**data)
    db.add(training)
    db.flush()

    for anchor_id in payload.anchor_ids or []:
        anchor = db.query(Anchor).filter(Anchor.id == anchor_id).first()
        if not anchor:
            continue
        attendance = TrainingAttendance(training_id=training.id, anchor_id=anchor_id)
        db.add(attendance)

    log_operation(db, OperationType.CREATE, "training",
                  target_id=training.id, target_name=training.title,
                  details=f"创建培训: {training.title}, 参训人数 {len(payload.anchor_ids or [])}")

    db.commit()
    db.refresh(training)
    payload_resp = serialize_training(training)
    payload_resp["attendances"] = [serialize_attendance(a) for a in training.attendances]
    return payload_resp


@router.put("/trainings/{training_id}", response_model=TrainingDetailResponse, dependencies=BUSINESS_WRITE)
def update_training(training_id: str, payload: TrainingUpdate, db: Session = Depends(get_db)):
    training = db.query(Training).filter(Training.id == training_id).first()
    if not training:
        raise HTTPException(status_code=404, detail="培训不存在")

    update_data = payload.model_dump(exclude_unset=True)
    changes = []
    for key, value in update_data.items():
        old = getattr(training, key)
        if old != value:
            changes.append(f"{key}: {old} -> {value}")
        setattr(training, key, value)
    training.updated_at = datetime.now()

    if changes:
        log_operation(db, OperationType.UPDATE, "training",
                      target_id=training.id, target_name=training.title,
                      details="更新培训: " + ", ".join(changes))

    db.commit()
    db.refresh(training)
    payload_resp = serialize_training(training)
    payload_resp["attendances"] = [serialize_attendance(a) for a in training.attendances]
    return payload_resp


@router.delete("/trainings/{training_id}", status_code=204, dependencies=BUSINESS_WRITE)
def delete_training(training_id: str, db: Session = Depends(get_db)):
    training = db.query(Training).filter(Training.id == training_id).first()
    if not training:
        raise HTTPException(status_code=404, detail="培训不存在")
    title = training.title
    log_operation(db, OperationType.DELETE, "training",
                  target_id=training.id, target_name=title, details=f"删除培训: {title}")
    db.delete(training)
    db.commit()
    return None


# ---- Attendance ----

@router.post("/trainings/{training_id}/attendances", response_model=List[AttendanceResponse], status_code=201, dependencies=BUSINESS_WRITE)
def add_attendances(training_id: str, payload: AttendanceCreate, db: Session = Depends(get_db)):
    training = db.query(Training).filter(Training.id == training_id).first()
    if not training:
        raise HTTPException(status_code=404, detail="培训不存在")

    existing = {a.anchor_id for a in training.attendances}
    added = []
    for anchor_id in payload.anchor_ids:
        if anchor_id in existing:
            continue
        anchor = db.query(Anchor).filter(Anchor.id == anchor_id).first()
        if not anchor:
            continue
        attendance = TrainingAttendance(training_id=training_id, anchor_id=anchor_id)
        db.add(attendance)
        db.flush()
        added.append(attendance)

    if added:
        log_operation(db, OperationType.UPDATE, "training",
                      target_id=training.id, target_name=training.title,
                      details=f"添加 {len(added)} 名参训主播")

    db.commit()
    return [serialize_attendance(a) for a in added]


@router.put("/attendances/{attendance_id}", response_model=AttendanceResponse, dependencies=BUSINESS_WRITE)
def update_attendance(attendance_id: str, payload: AttendanceUpdate, db: Session = Depends(get_db)):
    attendance = db.query(TrainingAttendance).filter(TrainingAttendance.id == attendance_id).first()
    if not attendance:
        raise HTTPException(status_code=404, detail="签到记录不存在")

    update_data = payload.model_dump(exclude_unset=True)

    # 切换为已签到时自动写 check_in_time
    if update_data.get("status") == AttendanceStatus.CHECKED_IN.value and not attendance.check_in_time and not update_data.get("check_in_time"):
        update_data["check_in_time"] = datetime.now()

    changes = []
    for key, value in update_data.items():
        old = getattr(attendance, key)
        if old != value:
            changes.append(f"{key}: {old} -> {value}")
        setattr(attendance, key, value)
    attendance.updated_at = datetime.now()

    if changes:
        log_operation(db, OperationType.UPDATE, "attendance",
                      target_id=attendance.id,
                      target_name=f"{attendance.training.title}/{attendance.anchor.stage_name if attendance.anchor else ''}",
                      details="更新签到: " + ", ".join(changes))

    db.commit()
    db.refresh(attendance)
    return serialize_attendance(attendance)


@router.delete("/attendances/{attendance_id}", status_code=204, dependencies=BUSINESS_WRITE)
def delete_attendance(attendance_id: str, db: Session = Depends(get_db)):
    attendance = db.query(TrainingAttendance).filter(TrainingAttendance.id == attendance_id).first()
    if not attendance:
        raise HTTPException(status_code=404, detail="签到记录不存在")
    log_operation(db, OperationType.DELETE, "attendance",
                  target_id=attendance.id,
                  target_name=f"{attendance.training.title}/{attendance.anchor.stage_name if attendance.anchor else ''}",
                  details=f"移除参训主播")
    db.delete(attendance)
    db.commit()
    return None


# ---- Effect comparison ----

def _avg(values):
    valid = [v for v in values if v is not None]
    return round(sum(valid) / len(valid), 2) if valid else None


def _delta(before, after):
    if before is None or after is None:
        return None, None
    delta = round(after - before, 2)
    pct = round(((after - before) / before) * 100, 2) if before else None
    return delta, pct


@router.get("/attendances/{attendance_id}/effect", response_model=TrainingEffectResponse)
def get_training_effect(attendance_id: str, window_days: int = Query(7, ge=1, le=60), db: Session = Depends(get_db)):
    """培训前后该主播直播数据均值对比，默认前后各 7 天"""
    attendance = db.query(TrainingAttendance).filter(TrainingAttendance.id == attendance_id).first()
    if not attendance:
        raise HTTPException(status_code=404, detail="签到记录不存在")

    training = attendance.training
    pivot = training.start_time

    before_start = pivot - timedelta(days=window_days)
    after_end = pivot + timedelta(days=window_days)

    rows_before = db.query(LiveRecord).filter(
        LiveRecord.anchor_id == attendance.anchor_id,
        LiveRecord.live_date >= before_start,
        LiveRecord.live_date < pivot,
    ).all()
    rows_after = db.query(LiveRecord).filter(
        LiveRecord.anchor_id == attendance.anchor_id,
        LiveRecord.live_date >= pivot,
        LiveRecord.live_date <= after_end,
    ).all()

    metric_specs = [
        ("场均时长(分钟)", "duration_minutes"),
        ("场均观看", "viewers_count"),
        ("场均GMV", "gmv"),
        ("平均转化率(%)", "conversion_rate"),
        ("场均新增粉丝", "new_followers"),
    ]

    metrics = []
    for label, attr in metric_specs:
        before_avg = _avg([getattr(r, attr) for r in rows_before])
        after_avg = _avg([getattr(r, attr) for r in rows_after])
        delta, pct = _delta(before_avg, after_avg)
        metrics.append(TrainingEffectMetric(
            label=label, before=before_avg, after=after_avg, delta=delta, delta_pct=pct,
        ))

    return TrainingEffectResponse(
        anchor_id=attendance.anchor_id,
        anchor_name=attendance.anchor.stage_name if attendance.anchor else None,
        training_id=training.id,
        training_title=training.title,
        training_date=training.start_time,
        window_days=window_days,
        sessions_before=len(rows_before),
        sessions_after=len(rows_after),
        metrics=metrics,
    )
