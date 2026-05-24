"""合同状态自动判定服务。

规则：
- 若 status 已是 DRAFT 或 TERMINATED → 不自动改
- 若 end_date 不存在 → 保持 ACTIVE（默认）
- 若 today > end_date → EXPIRED
- 若 end_date - today <= EXPIRING_DAYS → EXPIRING_SOON
- 否则 → ACTIVE
"""
from datetime import date
from typing import Optional

from ..models import Contract, ContractStatus

EXPIRING_DAYS = 30  # 即将到期阈值，可统一调整


def compute_status(contract: Contract, today: Optional[date] = None) -> ContractStatus:
    """根据合同的 end_date 自动判定状态。DRAFT/TERMINATED 不动。"""
    if contract.status in (ContractStatus.DRAFT, ContractStatus.TERMINATED):
        return contract.status
    if not contract.end_date:
        return ContractStatus.ACTIVE
    today = today or date.today()
    if today > contract.end_date:
        return ContractStatus.EXPIRED
    delta = (contract.end_date - today).days
    if delta <= EXPIRING_DAYS:
        return ContractStatus.EXPIRING_SOON
    return ContractStatus.ACTIVE


def days_to_expire(contract: Contract, today: Optional[date] = None) -> Optional[int]:
    if not contract.end_date:
        return None
    today = today or date.today()
    return (contract.end_date - today).days


def refresh_status(contract: Contract) -> bool:
    """更新合同状态字段；返回是否有变更。"""
    new_status = compute_status(contract)
    if new_status != contract.status:
        contract.status = new_status
        return True
    return False
