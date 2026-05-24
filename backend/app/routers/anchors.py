import os
import shutil
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional, Dict
from datetime import datetime, date

from ..database import get_db
from ..models import Anchor, AnchorStatus, Node, NodeType, OperationLog, OperationType, LiveRecord, UserRole
from ..schemas import (
    AnchorCreate, AnchorUpdate, AnchorResponse, AnchorListResponse,
    AnchorLiveStats, TimelineNode
)
from ..utils.auth_deps import require_role
from ..config import FILES_DIR, FILE_CATEGORIES

BUSINESS_WRITE = [Depends(require_role(UserRole.ADMIN, UserRole.OPERATOR))]


def compute_live_stats(db: Session, anchor_id: str) -> AnchorLiveStats:
    rows = db.query(LiveRecord).filter(LiveRecord.anchor_id == anchor_id).all()
    if not rows:
        return AnchorLiveStats()

    def mean(values):
        valid = [v for v in values if v is not None]
        return round(sum(valid) / len(valid), 2) if valid else None

    durations = [r.duration_minutes for r in rows]
    viewers = [r.viewers_count for r in rows]
    gmvs = [r.gmv for r in rows]
    conv_rates = [r.conversion_rate for r in rows]

    return AnchorLiveStats(
        session_count=len(rows),
        total_duration_minutes=sum(d or 0 for d in durations),
        avg_duration_minutes=mean(durations),
        avg_viewers=mean(viewers),
        avg_gmv=mean(gmvs),
        avg_conversion_rate=mean(conv_rates),
        total_new_followers=sum((r.new_followers or 0) for r in rows),
        total_orders_count=sum((r.orders_count or 0) for r in rows),
        total_gmv=round(sum((g or 0) for g in gmvs), 2),
        last_live_date=max((r.live_date for r in rows if r.live_date), default=None),
    )


def batch_live_stats(db: Session, anchor_ids: List[str]) -> Dict[str, AnchorLiveStats]:
    """批量计算 live_stats，避免 N+1。"""
    if not anchor_ids:
        return {}
    rows = db.query(LiveRecord).filter(LiveRecord.anchor_id.in_(anchor_ids)).all()
    grouped: Dict[str, list] = {}
    for r in rows:
        grouped.setdefault(r.anchor_id, []).append(r)

    def mean(values):
        valid = [v for v in values if v is not None]
        return round(sum(valid) / len(valid), 2) if valid else None

    out: Dict[str, AnchorLiveStats] = {}
    for aid in anchor_ids:
        rs = grouped.get(aid, [])
        if not rs:
            out[aid] = AnchorLiveStats()
            continue
        durations = [r.duration_minutes for r in rs]
        viewers = [r.viewers_count for r in rs]
        gmvs = [r.gmv for r in rs]
        conv_rates = [r.conversion_rate for r in rs]
        out[aid] = AnchorLiveStats(
            session_count=len(rs),
            total_duration_minutes=sum(d or 0 for d in durations),
            avg_duration_minutes=mean(durations),
            avg_viewers=mean(viewers),
            avg_gmv=mean(gmvs),
            avg_conversion_rate=mean(conv_rates),
            total_new_followers=sum((r.new_followers or 0) for r in rs),
            total_orders_count=sum((r.orders_count or 0) for r in rs),
            total_gmv=round(sum((g or 0) for g in gmvs), 2),
            last_live_date=max((r.live_date for r in rs if r.live_date), default=None),
        )
    return out


# 成长阶段判定阈值（可调）
STAGE_TOP_AVG_GMV = 20000
STAGE_TOP_TOTAL_GMV = 500000
STAGE_TOP_SESSION = 80
STAGE_TOP_MONTHS = 12

STAGE_MATURE_AVG_GMV = 5000
STAGE_MATURE_SESSION = 30
STAGE_MATURE_MONTHS = 6

STAGE_GROWTH_SESSION = 8
STAGE_GROWTH_MONTHS = 3


def compute_growth_stage(anchor: Anchor, stats: Optional[AnchorLiveStats]) -> str:
    """根据入职时长 + 直播数据综合判定主播成长阶段。

    返回值：'newbie' | 'growth' | 'mature' | 'top'
    判定（自上而下，先满足者优先）：
      - top: (月数 >= 12 OR 场次 >= 80) AND 场均GMV >= 20000 AND 累计GMV >= 500000
      - mature: (月数 >= 6) OR (场次 >= 30 AND 场均GMV >= 5000)
      - growth: (月数 >= 3) OR (场次 >= 8)
      - newbie: 其他
    """
    months = 0.0
    if anchor.hire_date:
        try:
            today = date.today()
            d = anchor.hire_date if isinstance(anchor.hire_date, date) else anchor.hire_date.date()
            months = (today - d).days / 30.4375
        except Exception:
            months = 0.0

    session_count = (stats.session_count if stats else 0) or 0
    avg_gmv = (stats.avg_gmv if stats and stats.avg_gmv is not None else 0.0) or 0.0
    total_gmv = (stats.total_gmv if stats else 0.0) or 0.0

    is_top = (
        (months >= STAGE_TOP_MONTHS or session_count >= STAGE_TOP_SESSION)
        and avg_gmv >= STAGE_TOP_AVG_GMV
        and total_gmv >= STAGE_TOP_TOTAL_GMV
    )
    if is_top:
        return "top"

    is_mature = (months >= STAGE_MATURE_MONTHS) or (
        session_count >= STAGE_MATURE_SESSION and avg_gmv >= STAGE_MATURE_AVG_GMV
    )
    if is_mature:
        return "mature"

    is_growth = (months >= STAGE_GROWTH_MONTHS) or (session_count >= STAGE_GROWTH_SESSION)
    if is_growth:
        return "growth"

    return "newbie"


def serialize_anchor(anchor: Anchor, stats: Optional[AnchorLiveStats] = None) -> AnchorResponse:
    response = AnchorResponse.model_validate(anchor)
    response.live_stats = stats
    response.growth_stage = compute_growth_stage(anchor, stats)
    return response

router = APIRouter(prefix="/api/anchors", tags=["anchors"])


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


@router.get("", response_model=AnchorListResponse)
def get_anchors(
    search: Optional[str] = None,
    status: Optional[AnchorStatus] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(Anchor)

    if search:
        query = query.filter(
            (Anchor.name.contains(search)) |
            (Anchor.stage_name.contains(search))
        )

    if status:
        query = query.filter(Anchor.status == status)

    total = query.count()
    items = query.order_by(Anchor.created_at.desc()).offset(skip).limit(limit).all()
    stats_map = batch_live_stats(db, [a.id for a in items])

    return AnchorListResponse(
        items=[serialize_anchor(a, stats_map.get(a.id)) for a in items],
        total=total,
    )


@router.get("/{anchor_id}", response_model=AnchorResponse)
def get_anchor(anchor_id: str, db: Session = Depends(get_db)):
    anchor = db.query(Anchor).filter(Anchor.id == anchor_id).first()
    if not anchor:
        raise HTTPException(status_code=404, detail="主播不存在")
    stats = compute_live_stats(db, anchor_id)
    return serialize_anchor(anchor, stats)


@router.post("", response_model=AnchorResponse, status_code=201, dependencies=BUSINESS_WRITE)
def create_anchor(anchor_data: AnchorCreate, db: Session = Depends(get_db)):
    data = anchor_data.model_dump()
    data.update({
        "platform": "快手",
        "douyin_account": None,
        "xiaohongshu_account": None,
        "weibo_account": None,
        "bilibili_account": None,
        "video_account": None,
        "fan_profile": None,
        "category_tags": None,
        "style_tags": None,
    })
    anchor = Anchor(**data)
    db.add(anchor)
    db.flush()

    # 记录操作日志
    log_operation(
        db, OperationType.CREATE, "anchor",
        target_id=anchor.id,
        target_name=f"{anchor.name}({anchor.stage_name})",
        details=f"创建主播: {anchor.name}"
    )

    db.commit()
    db.refresh(anchor)
    return serialize_anchor(anchor, AnchorLiveStats())


@router.put("/{anchor_id}", response_model=AnchorResponse, dependencies=BUSINESS_WRITE)
def update_anchor(anchor_id: str, anchor_data: AnchorUpdate, db: Session = Depends(get_db)):
    anchor = db.query(Anchor).filter(Anchor.id == anchor_id).first()
    if not anchor:
        raise HTTPException(status_code=404, detail="主播不存在")

    update_data = anchor_data.model_dump(exclude_unset=True)
    update_data.update({
        "platform": "快手",
        "douyin_account": None,
        "xiaohongshu_account": None,
        "weibo_account": None,
        "bilibili_account": None,
        "video_account": None,
        "fan_profile": None,
        "category_tags": None,
        "style_tags": None,
    })

    # 记录变更详情
    changes = []
    for key, value in update_data.items():
        old_value = getattr(anchor, key)
        if old_value != value:
            changes.append(f"{key}: {old_value} -> {value}")
        setattr(anchor, key, value)

    anchor.updated_at = datetime.now()

    # 记录操作日志
    if changes:
        log_operation(
            db, OperationType.UPDATE, "anchor",
            target_id=anchor.id,
            target_name=f"{anchor.name}({anchor.stage_name})",
            details=f"更新主播: {', '.join(changes)}"
        )

    db.commit()
    db.refresh(anchor)
    stats = compute_live_stats(db, anchor_id)
    return serialize_anchor(anchor, stats)


@router.delete("/{anchor_id}", status_code=204, dependencies=BUSINESS_WRITE)
def delete_anchor(anchor_id: str, db: Session = Depends(get_db)):
    anchor = db.query(Anchor).filter(Anchor.id == anchor_id).first()
    if not anchor:
        raise HTTPException(status_code=404, detail="主播不存在")

    anchor_name = f"{anchor.name}({anchor.stage_name})"
    anchor_id_str = anchor.id

    # 记录操作日志（在删除前）
    log_operation(
        db, OperationType.DELETE, "anchor",
        target_id=anchor.id,
        target_name=anchor_name,
        details=f"删除主播: {anchor_name}"
    )

    db.delete(anchor)
    db.commit()

    # 同步清理磁盘上该主播的材料库目录，避免成为孤儿
    for category_key in FILE_CATEGORIES.keys():
        anchor_dir = os.path.join(FILES_DIR, category_key, anchor_id_str)
        if os.path.isdir(anchor_dir):
            try:
                shutil.rmtree(anchor_dir)
            except OSError:
                # 磁盘清理失败不影响主播删除本身，可以后续一键清理孤儿补偿
                continue
    return None


@router.get("/{anchor_id}/timeline", response_model=List[TimelineNode])
def get_anchor_timeline(anchor_id: str, db: Session = Depends(get_db)):
    anchor = db.query(Anchor).filter(Anchor.id == anchor_id).first()
    if not anchor:
        raise HTTPException(status_code=404, detail="主播不存在")

    nodes = db.query(Node).filter(Node.anchor_id == anchor_id).order_by(Node.date.desc()).all()
    return nodes