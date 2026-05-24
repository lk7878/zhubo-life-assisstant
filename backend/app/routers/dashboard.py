from datetime import date, datetime, timedelta
from typing import Any, Dict

from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import (
    Anchor,
    AnchorStatus,
    Contract,
    ContractStatus,
    Equipment,
    EquipmentLoan,
    LoanStatus,
    LiveRecord,
    LiveRoom,
    LiveRoomStatus,
    SalaryRecord,
    SalaryStatus,
    Training,
    TrainingStatus,
)
from .anchors import batch_live_stats, compute_growth_stage

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


def enum_key(value: Any) -> str:
    return getattr(value, "value", str(value))


def iso(value: Any) -> str | None:
    return value.isoformat() if value else None


def count_by(rows) -> Dict[str, int]:
    return {enum_key(k): int(v or 0) for k, v in rows}


@router.get("/overview")
def overview(days: int = Query(30, ge=1, le=365), db: Session = Depends(get_db)):
    today = date.today()
    now = datetime.now()
    start_dt = now - timedelta(days=days)
    month_start = today.replace(day=1)
    expiring_until = today + timedelta(days=30)

    anchors = db.query(Anchor).all()
    stats_map = batch_live_stats(db, [a.id for a in anchors])
    stage_counts: Dict[str, int] = {"newbie": 0, "growth": 0, "mature": 0, "top": 0}
    for anchor in anchors:
        stage = compute_growth_stage(anchor, stats_map.get(anchor.id))
        stage_counts[stage] = stage_counts.get(stage, 0) + 1

    anchor_status_counts = count_by(
        db.query(Anchor.status, func.count(Anchor.id)).group_by(Anchor.status).all()
    )

    live_summary = db.query(
        func.count(LiveRecord.id),
        func.coalesce(func.sum(LiveRecord.duration_minutes), 0),
        func.coalesce(func.sum(LiveRecord.gmv), 0),
        func.coalesce(func.sum(LiveRecord.orders_count), 0),
        func.coalesce(func.sum(LiveRecord.new_followers), 0),
        func.avg(LiveRecord.viewers_count),
        func.avg(LiveRecord.conversion_rate),
    ).filter(LiveRecord.live_date >= start_dt).one()

    salary_month = db.query(
        func.coalesce(func.sum(SalaryRecord.total_payable), 0),
        func.coalesce(func.sum(SalaryRecord.commission), 0),
        func.count(SalaryRecord.id),
    ).filter(SalaryRecord.period_start >= month_start).one()

    pending_salary_total = db.query(func.coalesce(func.sum(SalaryRecord.total_payable), 0)).filter(
        SalaryRecord.status == SalaryStatus.DRAFT
    ).scalar()

    contract_status_counts = count_by(
        db.query(Contract.status, func.count(Contract.id)).group_by(Contract.status).all()
    )
    expiring_contracts = db.query(func.count(Contract.id)).filter(
        Contract.end_date.isnot(None),
        Contract.end_date >= today,
        Contract.end_date <= expiring_until,
        Contract.status.in_([ContractStatus.ACTIVE, ContractStatus.EXPIRING_SOON]),
    ).scalar()

    training_status_counts = count_by(
        db.query(Training.status, func.count(Training.id)).group_by(Training.status).all()
    )
    upcoming_trainings = db.query(func.count(Training.id)).filter(
        Training.start_time >= now,
        Training.status.in_([TrainingStatus.PLANNED, TrainingStatus.ONGOING]),
    ).scalar()

    live_room_status_counts = count_by(
        db.query(LiveRoom.status, func.count(LiveRoom.id)).group_by(LiveRoom.status).all()
    )
    equipment_status_counts = count_by(
        db.query(Equipment.status, func.count(Equipment.id)).group_by(Equipment.status).all()
    )
    active_loans = db.query(func.count(EquipmentLoan.id)).filter(
        EquipmentLoan.status == LoanStatus.BORROWED
    ).scalar()
    overdue_loans = db.query(func.count(EquipmentLoan.id)).filter(
        or_(
            EquipmentLoan.status == LoanStatus.OVERDUE,
            and_(
                EquipmentLoan.status == LoanStatus.BORROWED,
                EquipmentLoan.expected_return_at.isnot(None),
                EquipmentLoan.expected_return_at < today,
                EquipmentLoan.returned_at.is_(None),
            ),
        )
    ).scalar()

    top_anchors = db.query(
        Anchor.id,
        Anchor.stage_name,
        Anchor.name,
        func.count(LiveRecord.id).label("session_count"),
        func.coalesce(func.sum(LiveRecord.gmv), 0).label("total_gmv"),
        func.coalesce(func.sum(LiveRecord.orders_count), 0).label("total_orders"),
    ).join(LiveRecord, LiveRecord.anchor_id == Anchor.id).filter(
        LiveRecord.live_date >= start_dt
    ).group_by(Anchor.id, Anchor.stage_name, Anchor.name).order_by(
        func.coalesce(func.sum(LiveRecord.gmv), 0).desc()
    ).limit(10).all()

    recent_live_records = db.query(LiveRecord, Anchor.stage_name).join(
        Anchor, LiveRecord.anchor_id == Anchor.id
    ).order_by(LiveRecord.live_date.desc()).limit(10).all()

    return {
        "period": {
            "days": days,
            "start_at": iso(start_dt),
            "end_at": iso(now),
        },
        "anchors": {
            "total": len(anchors),
            "status_counts": anchor_status_counts,
            "stage_counts": stage_counts,
            "active_total": anchor_status_counts.get(AnchorStatus.ACTIVE.value, 0),
            "onboarding_total": anchor_status_counts.get(AnchorStatus.ONBOARDING.value, 0),
        },
        "live": {
            "session_count": int(live_summary[0] or 0),
            "total_duration_minutes": int(live_summary[1] or 0),
            "total_gmv": float(live_summary[2] or 0),
            "total_orders": int(live_summary[3] or 0),
            "total_new_followers": int(live_summary[4] or 0),
            "avg_viewers": round(float(live_summary[5] or 0), 2),
            "avg_conversion_rate": round(float(live_summary[6] or 0), 2),
            "top_anchors": [
                {
                    "anchor_id": row.id,
                    "stage_name": row.stage_name,
                    "name": row.name,
                    "session_count": int(row.session_count or 0),
                    "total_gmv": float(row.total_gmv or 0),
                    "total_orders": int(row.total_orders or 0),
                }
                for row in top_anchors
            ],
            "recent_records": [
                {
                    "id": record.id,
                    "anchor_id": record.anchor_id,
                    "stage_name": stage_name,
                    "platform": record.platform,
                    "live_room": record.live_room,
                    "live_date": iso(record.live_date),
                    "duration_minutes": record.duration_minutes,
                    "viewers_count": record.viewers_count,
                    "gmv": float(record.gmv or 0),
                    "orders_count": record.orders_count,
                }
                for record, stage_name in recent_live_records
            ],
        },
        "salary": {
            "month_total_payable": float(salary_month[0] or 0),
            "month_commission": float(salary_month[1] or 0),
            "month_record_count": int(salary_month[2] or 0),
            "pending_total_payable": float(pending_salary_total or 0),
        },
        "contracts": {
            "status_counts": contract_status_counts,
            "expiring_soon_total": int(expiring_contracts or 0),
        },
        "trainings": {
            "status_counts": training_status_counts,
            "upcoming_total": int(upcoming_trainings or 0),
        },
        "assets": {
            "live_room_status_counts": live_room_status_counts,
            "equipment_status_counts": equipment_status_counts,
            "active_loans": int(active_loans or 0),
            "overdue_loans": int(overdue_loans or 0),
            "active_rooms": live_room_status_counts.get(LiveRoomStatus.ACTIVE.value, 0),
        },
    }
