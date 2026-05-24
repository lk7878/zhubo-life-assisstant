from datetime import datetime, date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import (
    Anchor, LiveRoom, Equipment, EquipmentLoan,
    LivePlatform, LiveRoomStatus, EquipmentStatus, LoanStatus,
    OperationLog, OperationType, UserRole,
)
from ..schemas import (
    LiveRoomCreate, LiveRoomUpdate, LiveRoomResponse, LiveRoomListResponse,
    EquipmentCreate, EquipmentUpdate, EquipmentResponse, EquipmentListResponse,
    EquipmentLoanCreate, EquipmentLoanReturn, EquipmentLoanResponse, EquipmentLoanListResponse,
)
from ..utils.auth_deps import require_role

router = APIRouter(tags=["assets"])

BUSINESS_WRITE = [Depends(require_role(UserRole.ADMIN, UserRole.OPERATOR))]


def log_op(db: Session, action: OperationType, target_type: str,
           target_id: str = None, target_name: str = None, details: str = None):
    from ..utils.request_context import get_current_ip, get_audit_operator, get_audit_user_id
    db.add(OperationLog(
        operator=get_audit_operator(), user_id=get_audit_user_id(),
        action=action, target_type=target_type,
        target_id=target_id, target_name=target_name, details=details,
        ip_address=get_current_ip(),
    ))


# ============================================================
# LiveRoom
# ============================================================

def serialize_room(r: LiveRoom, equipment_count: int = 0) -> dict:
    return {
        "id": r.id,
        "name": r.name,
        "platform": r.platform,
        "platform_account": r.platform_account,
        "room_id": r.room_id,
        "room_url": r.room_url,
        "decoration_level": r.decoration_level,
        "decoration_note": r.decoration_note,
        "assigned_anchor_id": r.assigned_anchor_id,
        "assigned_anchor_name": r.assigned_anchor.name if r.assigned_anchor else None,
        "assigned_anchor_stage_name": r.assigned_anchor.stage_name if r.assigned_anchor else None,
        "status": r.status,
        "location": r.location,
        "equipment_count": equipment_count,
        "remark": r.remark,
        "created_at": r.created_at,
        "updated_at": r.updated_at,
    }


@router.get("/api/live-rooms", response_model=LiveRoomListResponse)
def list_rooms(
    platform: Optional[str] = None,
    status: Optional[str] = None,
    assigned_anchor_id: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 200,
    db: Session = Depends(get_db),
):
    query = db.query(LiveRoom)
    if platform:
        query = query.filter(LiveRoom.platform == platform)
    if status:
        query = query.filter(LiveRoom.status == status)
    if assigned_anchor_id:
        query = query.filter(LiveRoom.assigned_anchor_id == assigned_anchor_id)
    if search:
        like = f"%{search}%"
        query = query.filter((LiveRoom.name.ilike(like)) | (LiveRoom.platform_account.ilike(like)) | (LiveRoom.room_id.ilike(like)))

    total = query.count()
    items = query.order_by(LiveRoom.created_at.desc()).offset(skip).limit(limit).all()

    # 顺手统计每间设备数
    counts = dict(
        db.query(Equipment.live_room_id, func.count(Equipment.id))
        .filter(Equipment.live_room_id.in_([r.id for r in items]))
        .group_by(Equipment.live_room_id).all()
    )
    return {"items": [serialize_room(r, counts.get(r.id, 0)) for r in items], "total": total}


@router.get("/api/live-rooms/{rid}", response_model=LiveRoomResponse)
def get_room(rid: str, db: Session = Depends(get_db)):
    r = db.query(LiveRoom).filter(LiveRoom.id == rid).first()
    if not r:
        raise HTTPException(status_code=404, detail="直播间不存在")
    ec = db.query(Equipment).filter(Equipment.live_room_id == rid).count()
    return serialize_room(r, ec)


@router.post("/api/live-rooms", response_model=LiveRoomResponse, status_code=201, dependencies=BUSINESS_WRITE)
def create_room(payload: LiveRoomCreate, db: Session = Depends(get_db)):
    if payload.assigned_anchor_id:
        if not db.query(Anchor).filter(Anchor.id == payload.assigned_anchor_id).first():
            raise HTTPException(status_code=404, detail="主播不存在")
    data = payload.model_dump()
    data["platform"] = LivePlatform.KUAISHOU
    r = LiveRoom(**data)
    db.add(r)
    db.flush()
    log_op(db, OperationType.CREATE, "live_room", target_id=r.id, target_name=r.name,
           details=f"创建直播间, 平台={r.platform.value}, 账号={r.platform_account}")
    db.commit()
    db.refresh(r)
    return serialize_room(r, 0)


@router.put("/api/live-rooms/{rid}", response_model=LiveRoomResponse, dependencies=BUSINESS_WRITE)
def update_room(rid: str, payload: LiveRoomUpdate, db: Session = Depends(get_db)):
    r = db.query(LiveRoom).filter(LiveRoom.id == rid).first()
    if not r:
        raise HTTPException(status_code=404, detail="直播间不存在")
    update = payload.model_dump(exclude_unset=True)
    update["platform"] = LivePlatform.KUAISHOU
    changes = []
    for k, v in update.items():
        old = getattr(r, k)
        if old != v:
            changes.append(f"{k}: {old} -> {v}")
        setattr(r, k, v)
    r.updated_at = datetime.now()
    if changes:
        log_op(db, OperationType.UPDATE, "live_room", target_id=r.id, target_name=r.name,
               details="更新直播间: " + ", ".join(changes))
    db.commit()
    db.refresh(r)
    ec = db.query(Equipment).filter(Equipment.live_room_id == rid).count()
    return serialize_room(r, ec)


@router.delete("/api/live-rooms/{rid}", status_code=204, dependencies=BUSINESS_WRITE)
def delete_room(rid: str, db: Session = Depends(get_db)):
    r = db.query(LiveRoom).filter(LiveRoom.id == rid).first()
    if not r:
        raise HTTPException(status_code=404, detail="直播间不存在")
    in_room = db.query(Equipment).filter(Equipment.live_room_id == rid).count()
    if in_room > 0:
        raise HTTPException(status_code=400, detail=f"该直播间还绑定 {in_room} 件设备，请先解绑或移走")
    log_op(db, OperationType.DELETE, "live_room", target_id=r.id, target_name=r.name,
           details=f"删除直播间")
    db.delete(r)
    db.commit()
    return None


# ============================================================
# Equipment
# ============================================================

def serialize_equipment(e: Equipment) -> dict:
    return {
        "id": e.id,
        "name": e.name,
        "category": e.category,
        "brand": e.brand,
        "model": e.model,
        "sn": e.sn,
        "purchase_date": e.purchase_date,
        "purchase_price": float(e.purchase_price or 0),
        "warranty_until": e.warranty_until,
        "status": e.status,
        "live_room_id": e.live_room_id,
        "live_room_name": e.live_room.name if e.live_room else None,
        "current_holder_id": e.current_holder_id,
        "current_holder_name": e.current_holder.stage_name if e.current_holder else None,
        "location": e.location,
        "remark": e.remark,
        "created_at": e.created_at,
        "updated_at": e.updated_at,
    }


@router.get("/api/equipment", response_model=EquipmentListResponse)
def list_equipment(
    category: Optional[str] = None,
    status: Optional[str] = None,
    live_room_id: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 300,
    db: Session = Depends(get_db),
):
    query = db.query(Equipment)
    if category:
        query = query.filter(Equipment.category == category)
    if status:
        query = query.filter(Equipment.status == status)
    if live_room_id:
        query = query.filter(Equipment.live_room_id == live_room_id)
    if search:
        like = f"%{search}%"
        query = query.filter((Equipment.name.ilike(like)) | (Equipment.brand.ilike(like)) |
                             (Equipment.model.ilike(like)) | (Equipment.sn.ilike(like)))
    total = query.count()
    items = query.order_by(Equipment.created_at.desc()).offset(skip).limit(limit).all()
    return {"items": [serialize_equipment(e) for e in items], "total": total}


@router.get("/api/equipment/{eid}", response_model=EquipmentResponse)
def get_equipment(eid: str, db: Session = Depends(get_db)):
    e = db.query(Equipment).filter(Equipment.id == eid).first()
    if not e:
        raise HTTPException(status_code=404, detail="设备不存在")
    return serialize_equipment(e)


@router.post("/api/equipment", response_model=EquipmentResponse, status_code=201, dependencies=BUSINESS_WRITE)
def create_equipment(payload: EquipmentCreate, db: Session = Depends(get_db)):
    if payload.sn:
        dup = db.query(Equipment).filter(Equipment.sn == payload.sn).first()
        if dup:
            raise HTTPException(status_code=400, detail=f"序列号已存在: {payload.sn}")
    if payload.live_room_id:
        if not db.query(LiveRoom).filter(LiveRoom.id == payload.live_room_id).first():
            raise HTTPException(status_code=404, detail="绑定的直播间不存在")
    e = Equipment(**payload.model_dump())
    db.add(e)
    db.flush()
    log_op(db, OperationType.CREATE, "equipment", target_id=e.id, target_name=e.name,
           details=f"创建设备 {e.name} ({e.brand or ''} {e.model or ''}) SN={e.sn}")
    db.commit()
    db.refresh(e)
    return serialize_equipment(e)


@router.put("/api/equipment/{eid}", response_model=EquipmentResponse, dependencies=BUSINESS_WRITE)
def update_equipment(eid: str, payload: EquipmentUpdate, db: Session = Depends(get_db)):
    e = db.query(Equipment).filter(Equipment.id == eid).first()
    if not e:
        raise HTTPException(status_code=404, detail="设备不存在")
    update = payload.model_dump(exclude_unset=True)
    if "sn" in update and update["sn"] and update["sn"] != e.sn:
        dup = db.query(Equipment).filter(Equipment.sn == update["sn"]).first()
        if dup:
            raise HTTPException(status_code=400, detail=f"序列号已存在: {update['sn']}")
    changes = []
    for k, v in update.items():
        old = getattr(e, k)
        if old != v:
            changes.append(f"{k}: {old} -> {v}")
        setattr(e, k, v)
    e.updated_at = datetime.now()
    if changes:
        log_op(db, OperationType.UPDATE, "equipment", target_id=e.id, target_name=e.name,
               details="更新设备: " + ", ".join(changes))
    db.commit()
    db.refresh(e)
    return serialize_equipment(e)


@router.delete("/api/equipment/{eid}", status_code=204, dependencies=BUSINESS_WRITE)
def delete_equipment(eid: str, db: Session = Depends(get_db)):
    e = db.query(Equipment).filter(Equipment.id == eid).first()
    if not e:
        raise HTTPException(status_code=404, detail="设备不存在")
    if e.status == EquipmentStatus.BORROWED:
        raise HTTPException(status_code=400, detail="设备处于借出状态，请先归还")
    log_op(db, OperationType.DELETE, "equipment", target_id=e.id, target_name=e.name,
           details=f"删除设备 {e.name} SN={e.sn}")
    db.delete(e)
    db.commit()
    return None


# ============================================================
# EquipmentLoan
# ============================================================

def serialize_loan(l: EquipmentLoan) -> dict:
    today = date.today()
    overdue = None
    if l.status == LoanStatus.BORROWED and l.expected_return_at and today > l.expected_return_at:
        overdue = (today - l.expected_return_at).days
    return {
        "id": l.id,
        "equipment_id": l.equipment_id,
        "equipment_name": l.equipment.name if l.equipment else None,
        "anchor_id": l.anchor_id,
        "anchor_name": l.anchor.name if l.anchor else None,
        "anchor_stage_name": l.anchor.stage_name if l.anchor else None,
        "borrowed_at": l.borrowed_at,
        "expected_return_at": l.expected_return_at,
        "returned_at": l.returned_at,
        "condition_on_borrow": l.condition_on_borrow,
        "condition_on_return": l.condition_on_return,
        "borrow_note": l.borrow_note,
        "return_note": l.return_note,
        "status": l.status,
        "days_overdue": overdue,
        "created_at": l.created_at,
        "updated_at": l.updated_at,
    }


@router.get("/api/equipment-loans", response_model=EquipmentLoanListResponse)
def list_loans(
    equipment_id: Optional[str] = None,
    anchor_id: Optional[str] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 200,
    db: Session = Depends(get_db),
):
    query = db.query(EquipmentLoan)
    if equipment_id:
        query = query.filter(EquipmentLoan.equipment_id == equipment_id)
    if anchor_id:
        query = query.filter(EquipmentLoan.anchor_id == anchor_id)
    if status:
        query = query.filter(EquipmentLoan.status == status)

    total = query.count()
    items = query.order_by(EquipmentLoan.borrowed_at.desc()).offset(skip).limit(limit).all()

    # 顺手刷新一次 overdue 状态
    today = date.today()
    changed = False
    for l in items:
        if l.status == LoanStatus.BORROWED and l.expected_return_at and today > l.expected_return_at:
            l.status = LoanStatus.OVERDUE
            changed = True
    if changed:
        db.commit()

    return {"items": [serialize_loan(l) for l in items], "total": total}


@router.post("/api/equipment-loans", response_model=EquipmentLoanResponse, status_code=201, dependencies=BUSINESS_WRITE)
def create_loan(payload: EquipmentLoanCreate, db: Session = Depends(get_db)):
    e = db.query(Equipment).filter(Equipment.id == payload.equipment_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="设备不存在")
    if e.status in (EquipmentStatus.BORROWED, EquipmentStatus.LOST, EquipmentStatus.SCRAPPED):
        raise HTTPException(status_code=400, detail=f"设备状态为 {e.status.value}，不可借出")
    anchor = db.query(Anchor).filter(Anchor.id == payload.anchor_id).first()
    if not anchor:
        raise HTTPException(status_code=404, detail="主播不存在")

    l = EquipmentLoan(
        equipment_id=payload.equipment_id,
        anchor_id=payload.anchor_id,
        borrowed_at=payload.borrowed_at or datetime.now(),
        expected_return_at=payload.expected_return_at,
        condition_on_borrow=payload.condition_on_borrow,
        borrow_note=payload.borrow_note,
        status=LoanStatus.BORROWED,
    )
    # 联动设备状态
    e.status = EquipmentStatus.BORROWED
    e.current_holder_id = payload.anchor_id
    db.add(l)
    db.flush()
    log_op(db, OperationType.CREATE, "equipment_loan",
           target_id=l.id, target_name=f"{e.name} -> {anchor.stage_name}",
           details=f"借出, 预计归还 {l.expected_return_at}")
    db.commit()
    db.refresh(l)
    return serialize_loan(l)


@router.put("/api/equipment-loans/{lid}/return", response_model=EquipmentLoanResponse, dependencies=BUSINESS_WRITE)
def return_loan(lid: str, payload: EquipmentLoanReturn, db: Session = Depends(get_db)):
    l = db.query(EquipmentLoan).filter(EquipmentLoan.id == lid).first()
    if not l:
        raise HTTPException(status_code=404, detail="借用记录不存在")
    if l.status in (LoanStatus.RETURNED, LoanStatus.LOST, LoanStatus.DAMAGED):
        raise HTTPException(status_code=400, detail=f"借用记录已结束: {l.status.value}")

    l.status = payload.status
    l.returned_at = payload.returned_at or datetime.now()
    l.condition_on_return = payload.condition_on_return
    l.return_note = payload.return_note
    l.updated_at = datetime.now()

    # 联动设备
    e = db.query(Equipment).filter(Equipment.id == l.equipment_id).first()
    if e:
        if payload.status == LoanStatus.RETURNED:
            e.status = EquipmentStatus.IN_STOCK
        elif payload.status == LoanStatus.DAMAGED:
            e.status = EquipmentStatus.MAINTENANCE
        elif payload.status == LoanStatus.LOST:
            e.status = EquipmentStatus.LOST
        e.current_holder_id = None

    log_op(db, OperationType.UPDATE, "equipment_loan",
           target_id=l.id, target_name=f"{e.name if e else ''} <- {l.anchor.stage_name if l.anchor else ''}",
           details=f"归还结果: {payload.status.value}")
    db.commit()
    db.refresh(l)
    return serialize_loan(l)


@router.delete("/api/equipment-loans/{lid}", status_code=204, dependencies=BUSINESS_WRITE)
def delete_loan(lid: str, db: Session = Depends(get_db)):
    l = db.query(EquipmentLoan).filter(EquipmentLoan.id == lid).first()
    if not l:
        raise HTTPException(status_code=404, detail="借用记录不存在")
    if l.status == LoanStatus.BORROWED:
        raise HTTPException(status_code=400, detail="借出中的记录不能删除，请先归还")
    log_op(db, OperationType.DELETE, "equipment_loan", target_id=l.id,
           target_name=l.equipment.name if l.equipment else "",
           details=f"删除借用记录")
    db.delete(l)
    db.commit()
    return None
