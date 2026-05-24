import os
import shutil
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import (
    Anchor, Contract, ContractStatus, ContractType,
    Node, NodeType,
    OperationLog, OperationType,
)
from ..schemas import (
    ContractCreate, ContractUpdate, ContractTerminate, ContractRenew,
    ContractResponse, ContractListResponse,
)
from ..services import contract as contract_svc
from ..models import UserRole
from ..utils.auth_deps import require_role

router = APIRouter(prefix="/api/contracts", tags=["contracts"])

# 终止合同仅管理员可执行
ADMIN_ONLY = [Depends(require_role(UserRole.ADMIN))]
# 合同 CRUD 仅 admin / operator
BUSINESS_WRITE = [Depends(require_role(UserRole.ADMIN, UserRole.OPERATOR))]

UPLOAD_DIR = os.environ.get("ZHUBO_UPLOAD_DIR") or os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads", "contracts"
)
os.makedirs(UPLOAD_DIR, exist_ok=True)


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


def _node_dt_for_contract(c: Contract) -> datetime:
    """从合同推出节点日期：优先签订日期，其次生效日期，都没有则取当前时间。"""
    target = c.signed_at or c.start_date
    if target is None:
        return datetime.now()
    return datetime.combine(target, datetime.min.time())


def _ensure_entry_node(db: Session, anchor: Anchor, c: Contract) -> None:
    """试用/正式合同创建后：若主播尚未有入职节点，自动补一条。"""
    if c.contract_type not in (ContractType.PROBATION, ContractType.FORMAL):
        return
    existing = db.query(Node).filter(
        Node.anchor_id == anchor.id,
        Node.type == NodeType.ENTRY,
    ).first()
    if existing:
        return
    type_label = "正式合同" if c.contract_type == ContractType.FORMAL else "试用合同"
    db.add(Node(
        anchor_id=anchor.id,
        type=NodeType.ENTRY,
        date=_node_dt_for_contract(c),
        title=f"入职（{type_label}）",
        content=f"根据合同自动生成。合同号：{c.contract_no or '-'}，期限：{c.start_date or '-'} ~ {c.end_date or '-'}。",
    ))


def _add_renewal_milestone(db: Session, anchor: Anchor, c: Contract) -> None:
    """续签合同创建后，追加一条里程碑节点。"""
    db.add(Node(
        anchor_id=anchor.id,
        type=NodeType.MILESTONE,
        date=_node_dt_for_contract(c),
        title=f"合同续签",
        content=f"根据续签合同自动生成。合同号：{c.contract_no or '-'}，新期限：{c.start_date or '-'} ~ {c.end_date or '-'}。",
    ))


def serialize(c: Contract) -> dict:
    return {
        "id": c.id,
        "anchor_id": c.anchor_id,
        "anchor_name": c.anchor.name if c.anchor else None,
        "anchor_stage_name": c.anchor.stage_name if c.anchor else None,
        "contract_no": c.contract_no,
        "contract_type": c.contract_type,
        "party_a": c.party_a,
        "party_b": c.party_b,
        "start_date": c.start_date,
        "end_date": c.end_date,
        "signed_at": c.signed_at,
        "base_salary": float(c.base_salary or 0),
        "commission_rate": c.commission_rate,
        "penalty_terms": c.penalty_terms,
        "non_compete_terms": c.non_compete_terms,
        "exclusive": bool(c.exclusive),
        "auto_renew": bool(c.auto_renew),
        "status": c.status,
        "previous_contract_id": c.previous_contract_id,
        "terminated_at": c.terminated_at,
        "termination_reason": c.termination_reason,
        "attachment_url": c.attachment_url,
        "attachment_name": c.attachment_name,
        "days_to_expire": contract_svc.days_to_expire(c),
        "remark": c.remark,
        "created_at": c.created_at,
        "updated_at": c.updated_at,
    }


def refresh_all(db: Session, contracts: list[Contract]):
    """对每个合同根据 end_date 刷新自动状态。"""
    changed = False
    for c in contracts:
        if contract_svc.refresh_status(c):
            changed = True
    if changed:
        db.commit()


@router.get("", response_model=ContractListResponse)
def list_contracts(
    anchor_id: Optional[str] = None,
    status: Optional[str] = None,
    contract_type: Optional[str] = None,
    search: Optional[str] = Query(None, description="合同号/乙方姓名"),
    skip: int = 0,
    limit: int = 200,
    db: Session = Depends(get_db),
):
    query = db.query(Contract)
    if anchor_id:
        query = query.filter(Contract.anchor_id == anchor_id)
    if contract_type:
        query = query.filter(Contract.contract_type == contract_type)
    if search:
        like = f"%{search}%"
        query = query.filter((Contract.contract_no.ilike(like)) | (Contract.party_b.ilike(like)))

    all_items = query.order_by(Contract.created_at.desc()).all()
    refresh_all(db, all_items)

    if status:
        all_items = [c for c in all_items if c.status.value == status]
    total = len(all_items)
    items = all_items[skip:skip + limit]
    return {"items": [serialize(c) for c in items], "total": total}


@router.get("/expiring", response_model=ContractListResponse)
def list_expiring(days: int = Query(30, ge=1, le=365), db: Session = Depends(get_db)):
    """即将到期的合同（默认 30 天内）。"""
    items = db.query(Contract).filter(
        Contract.status.in_([ContractStatus.ACTIVE, ContractStatus.EXPIRING_SOON]),
        Contract.end_date.isnot(None),
    ).all()
    refresh_all(db, items)
    from datetime import date as _date, timedelta
    today = _date.today()
    cutoff = today + timedelta(days=days)
    filtered = [c for c in items if c.end_date and today <= c.end_date <= cutoff]
    filtered.sort(key=lambda c: c.end_date or _date.max)
    return {"items": [serialize(c) for c in filtered], "total": len(filtered)}


@router.get("/{cid}", response_model=ContractResponse)
def get_contract(cid: str, db: Session = Depends(get_db)):
    c = db.query(Contract).filter(Contract.id == cid).first()
    if not c:
        raise HTTPException(status_code=404, detail="合同不存在")
    contract_svc.refresh_status(c)
    db.commit()
    return serialize(c)


@router.post("", response_model=ContractResponse, status_code=201, dependencies=BUSINESS_WRITE)
def create_contract(payload: ContractCreate, db: Session = Depends(get_db)):
    anchor = db.query(Anchor).filter(Anchor.id == payload.anchor_id).first()
    if not anchor:
        raise HTTPException(status_code=404, detail="主播不存在")

    data = payload.model_dump()
    data["party_b"] = data.get("party_b") or anchor.name

    c = Contract(**data)
    # 若是新签状态非草稿，进入算法判定一遍
    contract_svc.refresh_status(c)
    db.add(c)
    db.flush()
    _ensure_entry_node(db, anchor, c)
    log_operation(db, OperationType.CREATE, "contract",
                  target_id=c.id, target_name=f"{anchor.stage_name}-{c.contract_no or c.contract_type.value}",
                  details=f"创建合同, 期限 {c.start_date} ~ {c.end_date}")
    db.commit()
    db.refresh(c)
    return serialize(c)


@router.put("/{cid}", response_model=ContractResponse, dependencies=BUSINESS_WRITE)
def update_contract(cid: str, payload: ContractUpdate, db: Session = Depends(get_db)):
    c = db.query(Contract).filter(Contract.id == cid).first()
    if not c:
        raise HTTPException(status_code=404, detail="合同不存在")

    update = payload.model_dump(exclude_unset=True)
    changes = []
    for k, v in update.items():
        old = getattr(c, k)
        if old != v:
            changes.append(f"{k}: {old} -> {v}")
        setattr(c, k, v)
    # 状态如果用户没手动改，重新自动判定
    if "status" not in update:
        contract_svc.refresh_status(c)
    c.updated_at = datetime.now()
    if changes:
        log_operation(db, OperationType.UPDATE, "contract",
                      target_id=c.id, target_name=c.anchor.stage_name if c.anchor else "",
                      details="更新合同: " + ", ".join(changes))
    db.commit()
    db.refresh(c)
    return serialize(c)


@router.put("/{cid}/terminate", response_model=ContractResponse, dependencies=ADMIN_ONLY)
def terminate_contract(cid: str, payload: ContractTerminate, db: Session = Depends(get_db)):
    c = db.query(Contract).filter(Contract.id == cid).first()
    if not c:
        raise HTTPException(status_code=404, detail="合同不存在")
    if c.status in (ContractStatus.TERMINATED, ContractStatus.EXPIRED):
        raise HTTPException(status_code=400, detail="合同已结束，无需终止")
    c.status = ContractStatus.TERMINATED
    c.terminated_at = payload.terminated_at
    c.termination_reason = payload.termination_reason
    c.updated_at = datetime.now()
    log_operation(db, OperationType.UPDATE, "contract",
                  target_id=c.id, target_name=c.anchor.stage_name if c.anchor else "",
                  details=f"终止合同 @ {payload.terminated_at}, 原因: {payload.termination_reason or '-'}")
    db.commit()
    db.refresh(c)
    return serialize(c)


@router.post("/{cid}/renew", response_model=ContractResponse, status_code=201, dependencies=BUSINESS_WRITE)
def renew_contract(cid: str, payload: ContractRenew, db: Session = Depends(get_db)):
    """基于该合同续签：创建新合同，previous_contract_id 指向当前合同。"""
    c = db.query(Contract).filter(Contract.id == cid).first()
    if not c:
        raise HTTPException(status_code=404, detail="原合同不存在")

    new_c = Contract(
        anchor_id=c.anchor_id,
        contract_no=payload.contract_no or (f"{c.contract_no}-R" if c.contract_no else None),
        contract_type=payload.contract_type,
        party_a=c.party_a,
        party_b=c.party_b,
        start_date=payload.new_start_date,
        end_date=payload.new_end_date,
        base_salary=payload.base_salary if payload.base_salary is not None else c.base_salary,
        commission_rate=c.commission_rate,
        penalty_terms=c.penalty_terms,
        non_compete_terms=c.non_compete_terms,
        exclusive=c.exclusive,
        auto_renew=c.auto_renew,
        previous_contract_id=c.id,
        remark=payload.remark,
        status=ContractStatus.DRAFT,
    )
    db.add(new_c)
    db.flush()
    contract_svc.refresh_status(new_c)
    if new_c.anchor is not None:
        _add_renewal_milestone(db, new_c.anchor, new_c)
    log_operation(db, OperationType.CREATE, "contract",
                  target_id=new_c.id, target_name=new_c.anchor.stage_name if new_c.anchor else "",
                  details=f"续签合同 from {c.id} 期限 {payload.new_start_date} ~ {payload.new_end_date}")
    db.commit()
    db.refresh(new_c)
    return serialize(new_c)


@router.post("/{cid}/attachment", response_model=ContractResponse, dependencies=BUSINESS_WRITE)
async def upload_attachment(cid: str, file: UploadFile = File(...), db: Session = Depends(get_db)):
    c = db.query(Contract).filter(Contract.id == cid).first()
    if not c:
        raise HTTPException(status_code=404, detail="合同不存在")

    # 简单校验
    if not file.filename:
        raise HTTPException(status_code=400, detail="文件名为空")
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in {".pdf", ".png", ".jpg", ".jpeg", ".doc", ".docx", ".zip"}:
        raise HTTPException(status_code=400, detail="不支持的文件类型")

    saved_name = f"{c.id}_{uuid.uuid4().hex[:8]}{ext}"
    saved_path = os.path.join(UPLOAD_DIR, saved_name)
    with open(saved_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    c.attachment_url = f"/api/contracts/{c.id}/attachment/download"
    c.attachment_name = file.filename
    c._saved_attachment_path = saved_path  # 不持久化，仅作记录
    c.updated_at = datetime.now()

    # 把真正路径存到 attachment_url 用 file:// 风格不方便；我们用一个隐式约定：
    # attachment_url 始终是下载端点，真实文件名按 cid 前缀查找
    log_operation(db, OperationType.UPDATE, "contract",
                  target_id=c.id, target_name=c.anchor.stage_name if c.anchor else "",
                  details=f"上传附件: {file.filename}")
    db.commit()
    db.refresh(c)
    return serialize(c)


@router.get("/{cid}/attachment/download")
def download_attachment(cid: str, db: Session = Depends(get_db)):
    c = db.query(Contract).filter(Contract.id == cid).first()
    if not c or not c.attachment_url:
        raise HTTPException(status_code=404, detail="附件不存在")
    # 找以 cid_ 开头的文件
    files = [f for f in os.listdir(UPLOAD_DIR) if f.startswith(f"{cid}_")]
    if not files:
        raise HTTPException(status_code=404, detail="附件文件已丢失")
    files.sort(reverse=True)
    path = os.path.join(UPLOAD_DIR, files[0])
    return FileResponse(path, filename=c.attachment_name or files[0])


@router.delete("/{cid}", status_code=204, dependencies=BUSINESS_WRITE)
def delete_contract(cid: str, db: Session = Depends(get_db)):
    c = db.query(Contract).filter(Contract.id == cid).first()
    if not c:
        raise HTTPException(status_code=404, detail="合同不存在")

    # 如后续合同通过 previous_contract_id 指向当前合同，先断开引用；
    # 否则在部分数据库/外键配置下会导致当前合同删不掉。
    db.query(Contract).filter(Contract.previous_contract_id == cid).update(
        {Contract.previous_contract_id: None},
        synchronize_session=False,
    )

    # 删除关联的附件文件
    for f in os.listdir(UPLOAD_DIR):
        if f.startswith(f"{cid}_"):
            try:
                os.remove(os.path.join(UPLOAD_DIR, f))
            except OSError:
                pass
    log_operation(db, OperationType.DELETE, "contract",
                  target_id=c.id, target_name=c.anchor.stage_name if c.anchor else "",
                  details=f"删除合同 {c.contract_no or c.id}")
    db.delete(c)
    db.commit()
    return None
