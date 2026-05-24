"""薪资结算业务逻辑：阶梯提成 + 期间数据汇总。

注意：算法都集中在这一个文件，方便后续按业务需求修改。
默认阶梯（DEFAULT_TIERS）和默认底薪（DEFAULT_*）也都集中在这里。
"""
import json
from datetime import date, datetime, timedelta
from typing import List, Optional

from sqlalchemy.orm import Session

from ..models import LiveRecord, SalaryConfig
from ..schemas import CommissionTier


# ===========================================================
# 默认配置（先随便写一份，等以后按业务调整时只需改这里）
# ===========================================================
DEFAULT_BASE_SALARY = 3000.0      # 默认月底薪
DEFAULT_DAILY_BASE = 100.0        # 默认日薪基数

# 阶梯：单位 RMB；rate 单位 % (5 表示 5%)
DEFAULT_TIERS: List[CommissionTier] = [
    CommissionTier(min=0,      max=10000,  rate=5),    # 0~1万      5%
    CommissionTier(min=10000,  max=50000,  rate=8),    # 1~5万      8%
    CommissionTier(min=50000,  max=200000, rate=12),   # 5~20万    12%
    CommissionTier(min=200000, max=None,   rate=15),   # 20万以上  15%
]


def calc_commission(total_gmv: float, tiers: List[CommissionTier]) -> float:
    """阶梯提成（分段累计）。

    例如：tiers=[(0,1万,5%),(1万,5万,8%),(5万,_,12%)], GMV=8万 →
       1万*5% + 4万*8% + 3万*12% = 500+3200+3600 = 7300
    """
    if total_gmv <= 0 or not tiers:
        return 0.0
    sorted_tiers = sorted(tiers, key=lambda t: t.min)
    commission = 0.0
    for tier in sorted_tiers:
        if total_gmv <= tier.min:
            break
        cap = tier.max if tier.max is not None else total_gmv
        slice_gmv = max(0.0, min(total_gmv, cap) - tier.min)
        commission += slice_gmv * (tier.rate / 100.0)
    return round(commission, 2)


def get_effective_config(db: Session, anchor_id: str) -> dict:
    """优先取主播自己的配置，否则取默认配置（anchor_id is NULL），都没有则用代码默认值。

    返回 dict：base_salary、daily_base、tiers (List[CommissionTier])。
    """
    own = db.query(SalaryConfig).filter(SalaryConfig.anchor_id == anchor_id).first()
    if not own:
        own = db.query(SalaryConfig).filter(SalaryConfig.anchor_id.is_(None)).first()

    if own:
        try:
            tiers = [CommissionTier(**t) for t in json.loads(own.commission_tiers or "[]")]
        except Exception:
            tiers = []
        return {
            "base_salary": float(own.base_salary or 0),
            "daily_base": float(own.daily_base or 0),
            "tiers": tiers if tiers else DEFAULT_TIERS,
            "source": "anchor" if own.anchor_id else "default",
        }

    return {
        "base_salary": DEFAULT_BASE_SALARY,
        "daily_base": DEFAULT_DAILY_BASE,
        "tiers": DEFAULT_TIERS,
        "source": "fallback",
    }


def aggregate_live(db: Session, anchor_id: str, period_start: date, period_end: date) -> dict:
    """聚合期间内直播数据"""
    start_dt = datetime.combine(period_start, datetime.min.time())
    end_dt = datetime.combine(period_end, datetime.max.time())
    rows = db.query(LiveRecord).filter(
        LiveRecord.anchor_id == anchor_id,
        LiveRecord.live_date >= start_dt,
        LiveRecord.live_date <= end_dt,
    ).all()
    total_gmv = round(sum((r.gmv or 0) for r in rows), 2)
    return {
        "session_count": len(rows),
        "total_gmv": total_gmv,
    }


def compute_period_base(period_type: str, period_start: date, period_end: date,
                        base_salary: float, daily_base: float) -> float:
    """根据期间类型计算底薪（保留改动窗口）。

    - month：直接使用配置的月底薪
    - day：天数 * 日基数
    """
    if period_type == "day":
        days = max(1, (period_end - period_start).days + 1)
        return round(daily_base * days, 2)
    return round(base_salary, 2)


def preview(db: Session, anchor_id: str, period_type: str, period_start: date, period_end: date) -> dict:
    cfg = get_effective_config(db, anchor_id)
    aggr = aggregate_live(db, anchor_id, period_start, period_end)
    commission = calc_commission(aggr["total_gmv"], cfg["tiers"])
    base = compute_period_base(period_type, period_start, period_end, cfg["base_salary"], cfg["daily_base"])
    return {
        "base_salary": base,
        "total_gmv": aggr["total_gmv"],
        "session_count": aggr["session_count"],
        "commission": commission,
        "total_payable": round(base + commission, 2),
        "tiers_used": cfg["tiers"],
    }


def serialize_tiers(tiers: List[CommissionTier]) -> str:
    return json.dumps([t.model_dump() for t in tiers], ensure_ascii=False)


def parse_tiers(text: Optional[str]) -> List[CommissionTier]:
    if not text:
        return []
    try:
        return [CommissionTier(**t) for t in json.loads(text)]
    except Exception:
        return []
