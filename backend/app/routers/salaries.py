from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Anchor, SalaryConfig, SalaryRecord, OperationLog, OperationType
from ..schemas import (
    SalaryConfigUpdate, SalaryConfigResponse, SalaryConfigListResponse,
    SalaryPreviewRequest, SalaryPreviewResponse,
    SalaryRecordCreate, SalaryRecordUpdate, SalaryRecordPay,
    SalaryRecordResponse, SalaryRecordListResponse,
)
from ..services import salary as salary_svc
from ..models import UserRole
from ..utils.auth_deps import require_role

router = APIRouter(prefix="/api/salary", tags=["salary"])

# 仅财务/管理员可写薪资数据
FINANCE_WRITE = [Depends(require_role(UserRole.ADMIN, UserRole.FINANCE))]


def log_operation(db: Session, action: OperationType, target_type: str,
                  target_id: str = None, target_name: str = None, details: str = None):
    from ..utils.request_context import get_current_ip, get_audit_operator, get_audit_user_id
    log = OperationLog(
        operator=get_audit_operator(), user_id=get_audit_user_id(),
        action=action, target_type=target_type,
        target_id=target_id, target_name=target_name, details=details,
        ip_address=get_current_ip(),
    )
    db.add(log)


def serialize_config(cfg: SalaryConfig) -> dict:
    return {
        "id": cfg.id,
        "anchor_id": cfg.anchor_id,
        "anchor_name": cfg.anchor.name if cfg.anchor else None,
        "anchor_stage_name": cfg.anchor.stage_name if cfg.anchor else None,
        "is_default": cfg.anchor_id is None,
        "base_salary": float(cfg.base_salary or 0),
        "daily_base": float(cfg.daily_base or 0),
        "commission_tiers": [t.model_dump() for t in salary_svc.parse_tiers(cfg.commission_tiers)],
        "effective_from": cfg.effective_from,
        "remark": cfg.remark,
        "created_at": cfg.created_at,
        "updated_at": cfg.updated_at,
    }


def serialize_record(rec: SalaryRecord) -> dict:
    return {
        "id": rec.id,
        "anchor_id": rec.anchor_id,
        "anchor_name": rec.anchor.name if rec.anchor else None,
        "anchor_stage_name": rec.anchor.stage_name if rec.anchor else None,
        "period_type": rec.period_type,
        "period_start": rec.period_start,
        "period_end": rec.period_end,
        "base_salary": float(rec.base_salary or 0),
        "total_gmv": float(rec.total_gmv or 0),
        "session_count": int(rec.session_count or 0),
        "commission": float(rec.commission or 0),
        "bonus": float(rec.bonus or 0),
        "deduction": float(rec.deduction or 0),
        "total_payable": float(rec.total_payable or 0),
        "status": rec.status,
        "paid_at": rec.paid_at,
        "payment_method": rec.payment_method,
        "voucher": rec.voucher,
        "formula_snapshot": rec.formula_snapshot,
        "remark": rec.remark,
        "created_at": rec.created_at,
        "updated_at": rec.updated_at,
    }


# ---- Config ----

@router.get("/configs", response_model=SalaryConfigListResponse)
def list_configs(db: Session = Depends(get_db)):
    items = db.query(SalaryConfig).all()
    return {"items": [serialize_config(c) for c in items], "total": len(items)}


@router.get("/configs/default", response_model=SalaryConfigResponse)
def get_default_config(db: Session = Depends(get_db)):
    cfg = db.query(SalaryConfig).filter(SalaryConfig.anchor_id.is_(None)).first()
    if not cfg:
        # 不存在则懒创建一份代码默认值的配置
        cfg = SalaryConfig(
            anchor_id=None,
            base_salary=salary_svc.DEFAULT_BASE_SALARY,
            daily_base=salary_svc.DEFAULT_DAILY_BASE,
            commission_tiers=salary_svc.serialize_tiers(salary_svc.DEFAULT_TIERS),
        )
        db.add(cfg)
        db.commit()
        db.refresh(cfg)
    return serialize_config(cfg)


@router.put("/configs/default", response_model=SalaryConfigResponse, dependencies=FINANCE_WRITE)
def update_default_config(payload: SalaryConfigUpdate, db: Session = Depends(get_db)):
    cfg = db.query(SalaryConfig).filter(SalaryConfig.anchor_id.is_(None)).first()
    if not cfg:
        cfg = SalaryConfig(anchor_id=None)
        db.add(cfg)
    cfg.base_salary = payload.base_salary
    cfg.daily_base = payload.daily_base
    cfg.commission_tiers = salary_svc.serialize_tiers(payload.commission_tiers)
    cfg.effective_from = payload.effective_from
    cfg.remark = payload.remark
    cfg.updated_at = datetime.now()
    log_operation(db, OperationType.UPDATE, "salary_config",
                  target_id=cfg.id, target_name="默认配置",
                  details=f"更新默认薪资配置, base={payload.base_salary}, daily_base={payload.daily_base}, tiers={len(payload.commission_tiers)}")
    db.commit()
    db.refresh(cfg)
    return serialize_config(cfg)


@router.get("/configs/anchor/{anchor_id}", response_model=SalaryConfigResponse)
def get_anchor_config(anchor_id: str, db: Session = Depends(get_db)):
    cfg = db.query(SalaryConfig).filter(SalaryConfig.anchor_id == anchor_id).first()
    if not cfg:
        # 没有则继承默认值（不落库，仅返回视图）
        defaults = salary_svc.get_effective_config(db, anchor_id)
        anchor = db.query(Anchor).filter(Anchor.id == anchor_id).first()
        return {
            "id": "",
            "anchor_id": anchor_id,
            "anchor_name": anchor.name if anchor else None,
            "anchor_stage_name": anchor.stage_name if anchor else None,
            "is_default": False,
            "base_salary": defaults["base_salary"],
            "daily_base": defaults["daily_base"],
            "commission_tiers": [t.model_dump() for t in defaults["tiers"]],
            "effective_from": None,
            "remark": "（继承自默认配置，未单独设置）",
            "created_at": datetime.now(),
            "updated_at": datetime.now(),
        }
    return serialize_config(cfg)


@router.put("/configs/anchor/{anchor_id}", response_model=SalaryConfigResponse, dependencies=FINANCE_WRITE)
def update_anchor_config(anchor_id: str, payload: SalaryConfigUpdate, db: Session = Depends(get_db)):
    anchor = db.query(Anchor).filter(Anchor.id == anchor_id).first()
    if not anchor:
        raise HTTPException(status_code=404, detail="主播不存在")

    cfg = db.query(SalaryConfig).filter(SalaryConfig.anchor_id == anchor_id).first()
    if not cfg:
        cfg = SalaryConfig(anchor_id=anchor_id)
        db.add(cfg)
    cfg.base_salary = payload.base_salary
    cfg.daily_base = payload.daily_base
    cfg.commission_tiers = salary_svc.serialize_tiers(payload.commission_tiers)
    cfg.effective_from = payload.effective_from
    cfg.remark = payload.remark
    cfg.updated_at = datetime.now()
    log_operation(db, OperationType.UPDATE, "salary_config",
                  target_id=cfg.id, target_name=f"{anchor.name}({anchor.stage_name})",
                  details=f"更新薪资配置: base={payload.base_salary}, tiers={len(payload.commission_tiers)}")
    db.commit()
    db.refresh(cfg)
    return serialize_config(cfg)


@router.delete("/configs/anchor/{anchor_id}", status_code=204, dependencies=FINANCE_WRITE)
def delete_anchor_config(anchor_id: str, db: Session = Depends(get_db)):
    cfg = db.query(SalaryConfig).filter(SalaryConfig.anchor_id == anchor_id).first()
    if not cfg:
        return None
    log_operation(db, OperationType.DELETE, "salary_config",
                  target_id=cfg.id, target_name=cfg.anchor.name if cfg.anchor else "",
                  details=f"删除主播薪资配置")
    db.delete(cfg)
    db.commit()
    return None


# ---- Preview ----

@router.post("/preview", response_model=SalaryPreviewResponse)
def preview_record(payload: SalaryPreviewRequest, db: Session = Depends(get_db)):
    anchor = db.query(Anchor).filter(Anchor.id == payload.anchor_id).first()
    if not anchor:
        raise HTTPException(status_code=404, detail="主播不存在")
    result = salary_svc.preview(db, payload.anchor_id, payload.period_type.value,
                                payload.period_start, payload.period_end)
    return {
        "anchor_id": payload.anchor_id,
        "anchor_name": anchor.stage_name,
        "period_type": payload.period_type,
        "period_start": payload.period_start,
        "period_end": payload.period_end,
        **result,
    }


# ---- Records ----

@router.get("/records", response_model=SalaryRecordListResponse)
def list_records(
    anchor_id: Optional[str] = None,
    status: Optional[str] = None,
    period_type: Optional[str] = None,
    month: Optional[str] = Query(None, description="过滤指定月份 YYYY-MM"),
    skip: int = 0,
    limit: int = 200,
    db: Session = Depends(get_db),
):
    query = db.query(SalaryRecord)
    if anchor_id:
        query = query.filter(SalaryRecord.anchor_id == anchor_id)
    if status:
        query = query.filter(SalaryRecord.status == status)
    if period_type:
        query = query.filter(SalaryRecord.period_type == period_type)
    if month:
        try:
            y, m = month.split("-")
            from datetime import date as _date
            start = _date(int(y), int(m), 1)
            end = _date(int(y) + (1 if int(m) == 12 else 0), 1 if int(m) == 12 else int(m) + 1, 1)
            query = query.filter(SalaryRecord.period_start >= start, SalaryRecord.period_start < end)
        except Exception:
            pass

    total = query.count()
    items = query.order_by(SalaryRecord.period_start.desc(), SalaryRecord.created_at.desc()).offset(skip).limit(limit).all()
    return {"items": [serialize_record(r) for r in items], "total": total}


@router.get("/records/{record_id}", response_model=SalaryRecordResponse)
def get_record(record_id: str, db: Session = Depends(get_db)):
    rec = db.query(SalaryRecord).filter(SalaryRecord.id == record_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="结算单不存在")
    return serialize_record(rec)


@router.post("/records", response_model=SalaryRecordResponse, status_code=201, dependencies=FINANCE_WRITE)
def create_record(payload: SalaryRecordCreate, db: Session = Depends(get_db)):
    anchor = db.query(Anchor).filter(Anchor.id == payload.anchor_id).first()
    if not anchor:
        raise HTTPException(status_code=404, detail="主播不存在")

    result = salary_svc.preview(db, payload.anchor_id, payload.period_type.value,
                                payload.period_start, payload.period_end)
    bonus = float(payload.bonus or 0)
    deduction = float(payload.deduction or 0)
    total_payable = round(result["base_salary"] + result["commission"] + bonus - deduction, 2)

    snapshot = salary_svc.serialize_tiers(result["tiers_used"])
    rec = SalaryRecord(
        anchor_id=payload.anchor_id,
        period_type=payload.period_type,
        period_start=payload.period_start,
        period_end=payload.period_end,
        base_salary=result["base_salary"],
        total_gmv=result["total_gmv"],
        session_count=result["session_count"],
        commission=result["commission"],
        bonus=bonus,
        deduction=deduction,
        total_payable=total_payable,
        formula_snapshot=snapshot,
        remark=payload.remark,
    )
    db.add(rec)
    db.flush()
    log_operation(db, OperationType.CREATE, "salary_record",
                  target_id=rec.id, target_name=f"{anchor.name}({anchor.stage_name})",
                  details=f"生成结算单: {payload.period_start}~{payload.period_end} 应发 {total_payable}")
    db.commit()
    db.refresh(rec)
    return serialize_record(rec)


@router.put("/records/{record_id}", response_model=SalaryRecordResponse, dependencies=FINANCE_WRITE)
def update_record(record_id: str, payload: SalaryRecordUpdate, db: Session = Depends(get_db)):
    rec = db.query(SalaryRecord).filter(SalaryRecord.id == record_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="结算单不存在")
    update = payload.model_dump(exclude_unset=True)
    changes = []
    for k, v in update.items():
        old = getattr(rec, k)
        if old != v:
            changes.append(f"{k}: {old} -> {v}")
        setattr(rec, k, v)
    rec.total_payable = round(
        float(rec.base_salary or 0) + float(rec.commission or 0) + float(rec.bonus or 0) - float(rec.deduction or 0), 2
    )
    rec.updated_at = datetime.now()
    if changes:
        log_operation(db, OperationType.UPDATE, "salary_record",
                      target_id=rec.id,
                      target_name=rec.anchor.stage_name if rec.anchor else "",
                      details="调整结算单: " + ", ".join(changes))
    db.commit()
    db.refresh(rec)
    return serialize_record(rec)


@router.put("/records/{record_id}/pay", response_model=SalaryRecordResponse, dependencies=FINANCE_WRITE)
def pay_record(record_id: str, payload: SalaryRecordPay, db: Session = Depends(get_db)):
    from ..models import SalaryStatus as SS
    rec = db.query(SalaryRecord).filter(SalaryRecord.id == record_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="结算单不存在")
    rec.status = SS.PAID
    rec.paid_at = payload.paid_at or datetime.now()
    rec.payment_method = payload.payment_method
    rec.voucher = payload.voucher
    rec.updated_at = datetime.now()
    log_operation(db, OperationType.UPDATE, "salary_record",
                  target_id=rec.id, target_name=rec.anchor.stage_name if rec.anchor else "",
                  details=f"标记发放: {payload.payment_method.value} 金额 {rec.total_payable}")
    db.commit()
    db.refresh(rec)
    return serialize_record(rec)


@router.delete("/records/{record_id}", status_code=204, dependencies=FINANCE_WRITE)
def delete_record(record_id: str, db: Session = Depends(get_db)):
    from ..models import SalaryStatus as SS
    rec = db.query(SalaryRecord).filter(SalaryRecord.id == record_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="结算单不存在")
    if rec.status == SS.PAID:
        raise HTTPException(status_code=400, detail="已发放的结算单不能删除，请先作废或保留")
    log_operation(db, OperationType.DELETE, "salary_record",
                  target_id=rec.id, target_name=rec.anchor.stage_name if rec.anchor else "",
                  details=f"删除结算单 {rec.period_start}~{rec.period_end}")
    db.delete(rec)
    db.commit()
    return None
