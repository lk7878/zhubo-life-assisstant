from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime
from enum import Enum


class AnchorStatus(str, Enum):
    ONBOARDING = "onboarding"
    ACTIVE = "active"
    INACTIVE = "inactive"


class NodeType(str, Enum):
    ENTRY = "entry"
    TRAINING = "training"
    INTERVIEW = "interview"
    MILESTONE = "milestone"
    ASSESSMENT = "assessment"
    EXIT = "exit"


# Anchor Schemas
class AnchorBase(BaseModel):
    name: str
    stage_name: str
    phone: Optional[str] = None
    id_card: Optional[str] = None
    platform: Optional[str] = None
    gender: Optional[str] = None
    age: Optional[int] = None
    wechat: Optional[str] = None
    city: Optional[str] = None
    commute_distance: Optional[str] = None
    marital_status: Optional[str] = None
    has_children: Optional[str] = None
    douyin_account: Optional[str] = None
    kuaishou_account: Optional[str] = None
    xiaohongshu_account: Optional[str] = None
    weibo_account: Optional[str] = None
    bilibili_account: Optional[str] = None
    video_account: Optional[str] = None
    followers_count: Optional[int] = None
    average_viewers: Optional[float] = None
    average_gmv: Optional[float] = None
    conversion_rate: Optional[float] = None
    fan_profile: Optional[str] = None
    fan_growth: Optional[int] = None
    bank_name: Optional[str] = None
    bank_card_number: Optional[str] = None
    bank_account_name: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_relation: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    category_tags: Optional[str] = None
    style_tags: Optional[str] = None
    level_tags: Optional[str] = None
    grade: Optional[str] = None
    grade_note: Optional[str] = None
    status: AnchorStatus = AnchorStatus.ONBOARDING
    hire_date: Optional[date] = None
    leave_date: Optional[date] = None
    avatar: Optional[str] = None
    remark: Optional[str] = None


class AnchorCreate(AnchorBase):
    pass


class AnchorUpdate(BaseModel):
    name: Optional[str] = None
    stage_name: Optional[str] = None
    phone: Optional[str] = None
    id_card: Optional[str] = None
    platform: Optional[str] = None
    gender: Optional[str] = None
    age: Optional[int] = None
    wechat: Optional[str] = None
    city: Optional[str] = None
    commute_distance: Optional[str] = None
    marital_status: Optional[str] = None
    has_children: Optional[str] = None
    douyin_account: Optional[str] = None
    kuaishou_account: Optional[str] = None
    xiaohongshu_account: Optional[str] = None
    weibo_account: Optional[str] = None
    bilibili_account: Optional[str] = None
    video_account: Optional[str] = None
    followers_count: Optional[int] = None
    average_viewers: Optional[float] = None
    average_gmv: Optional[float] = None
    conversion_rate: Optional[float] = None
    fan_profile: Optional[str] = None
    fan_growth: Optional[int] = None
    bank_name: Optional[str] = None
    bank_card_number: Optional[str] = None
    bank_account_name: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_relation: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    category_tags: Optional[str] = None
    style_tags: Optional[str] = None
    level_tags: Optional[str] = None
    grade: Optional[str] = None
    grade_note: Optional[str] = None
    status: Optional[AnchorStatus] = None
    hire_date: Optional[date] = None
    leave_date: Optional[date] = None
    avatar: Optional[str] = None
    remark: Optional[str] = None


class AnchorLiveStats(BaseModel):
    session_count: int = 0
    total_duration_minutes: int = 0
    avg_duration_minutes: Optional[float] = None
    avg_viewers: Optional[float] = None
    avg_gmv: Optional[float] = None
    avg_conversion_rate: Optional[float] = None
    total_new_followers: int = 0
    total_orders_count: int = 0
    total_gmv: float = 0.0
    last_live_date: Optional[datetime] = None


class AnchorResponse(AnchorBase):
    id: str
    created_at: datetime
    updated_at: datetime
    live_stats: Optional[AnchorLiveStats] = None
    # 成长阶段：newbie/growth/mature/top（基于入职时长 + 直播数据多维计算）
    growth_stage: Optional[str] = None

    class Config:
        from_attributes = True


# Node Schemas
class NodeBase(BaseModel):
    type: NodeType
    date: datetime
    location: Optional[str] = None
    title: str
    content: Optional[str] = None


class NodeCreate(NodeBase):
    pass


class NodeUpdate(BaseModel):
    type: Optional[NodeType] = None
    date: Optional[datetime] = None
    location: Optional[str] = None
    title: Optional[str] = None
    content: Optional[str] = None


class FileResponse(BaseModel):
    id: str
    filename: str
    original_name: str
    file_type: Optional[str]
    file_size: Optional[int]
    category: Optional[str]
    uploaded_at: datetime

    class Config:
        from_attributes = True


class NodeResponse(NodeBase):
    id: str
    anchor_id: str
    created_at: datetime
    updated_at: datetime
    files: List[FileResponse] = []

    class Config:
        from_attributes = True


class TimelineNode(BaseModel):
    id: str
    type: NodeType
    date: datetime
    title: str
    location: Optional[str] = None

    class Config:
        from_attributes = True


# File Schemas
class FileUploadResponse(BaseModel):
    id: str
    filename: str
    original_name: str
    file_path: str
    file_type: Optional[str]
    file_size: Optional[int]
    category: Optional[str]
    uploaded_at: datetime

    class Config:
        from_attributes = True


# Library Schemas
class LibraryTreeNode(BaseModel):
    name: str
    path: str
    type: str  # "folder" or "file"
    children: List["LibraryTreeNode"] = []
    file_id: Optional[str] = None
    orphan: Optional[bool] = None  # 该目录对应主播已删除/不存在


# Pagination
class AnchorListResponse(BaseModel):
    items: List[AnchorResponse]
    total: int


class NodeListResponse(BaseModel):
    items: List[NodeResponse]
    total: int


class LiveRecordBase(BaseModel):
    anchor_id: str
    platform: Optional[str] = None
    live_room: Optional[str] = None
    live_date: datetime
    live_end_time: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    viewers_count: Optional[int] = None
    new_followers: Optional[int] = None
    gmv: Optional[float] = None
    orders_count: Optional[int] = None
    conversion_rate: Optional[float] = None
    review: Optional[str] = None
    problems: Optional[str] = None
    improvements: Optional[str] = None


class LiveRecordCreate(LiveRecordBase):
    pass


class LiveRecordUpdate(BaseModel):
    anchor_id: Optional[str] = None
    platform: Optional[str] = None
    live_room: Optional[str] = None
    live_date: Optional[datetime] = None
    live_end_time: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    viewers_count: Optional[int] = None
    new_followers: Optional[int] = None
    gmv: Optional[float] = None
    orders_count: Optional[int] = None
    conversion_rate: Optional[float] = None
    review: Optional[str] = None
    problems: Optional[str] = None
    improvements: Optional[str] = None


class LiveRecordResponse(LiveRecordBase):
    id: str
    anchor_name: Optional[str] = None
    anchor_stage_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class LiveRecordListResponse(BaseModel):
    items: List[LiveRecordResponse]
    total: int


# Training Schemas
class TrainingType(str, Enum):
    NEW_HIRE = "new_hire"
    PROMOTION = "promotion"
    COMPLIANCE = "compliance"
    SKILL = "skill"
    OTHER = "other"


class TrainingMode(str, Enum):
    ONLINE = "online"
    OFFLINE = "offline"
    HYBRID = "hybrid"


class TrainingStatus(str, Enum):
    PLANNED = "planned"
    ONGOING = "ongoing"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class AttendanceStatus(str, Enum):
    REGISTERED = "registered"
    CHECKED_IN = "checked_in"
    ABSENT = "absent"
    LEAVE = "leave"


class TrainingBase(BaseModel):
    title: str
    training_type: TrainingType = TrainingType.SKILL
    trainer: Optional[str] = None
    start_time: datetime
    end_time: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    mode: TrainingMode = TrainingMode.OFFLINE
    location: Optional[str] = None
    description: Optional[str] = None
    materials: Optional[str] = None
    status: TrainingStatus = TrainingStatus.PLANNED
    is_compliance: int = 0
    remark: Optional[str] = None


class TrainingCreate(TrainingBase):
    anchor_ids: List[str] = []  # 创建时一次性把参训主播加进来


class TrainingUpdate(BaseModel):
    title: Optional[str] = None
    training_type: Optional[TrainingType] = None
    trainer: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    mode: Optional[TrainingMode] = None
    location: Optional[str] = None
    description: Optional[str] = None
    materials: Optional[str] = None
    status: Optional[TrainingStatus] = None
    is_compliance: Optional[int] = None
    remark: Optional[str] = None


class AttendanceBase(BaseModel):
    anchor_id: str
    status: AttendanceStatus = AttendanceStatus.REGISTERED
    check_in_time: Optional[datetime] = None
    check_in_method: Optional[str] = None
    pre_training_note: Optional[str] = None
    post_training_note: Optional[str] = None
    score: Optional[float] = None
    remark: Optional[str] = None


class AttendanceCreate(BaseModel):
    anchor_ids: List[str]  # 批量添加参训主播


class AttendanceUpdate(BaseModel):
    status: Optional[AttendanceStatus] = None
    check_in_time: Optional[datetime] = None
    check_in_method: Optional[str] = None
    pre_training_note: Optional[str] = None
    post_training_note: Optional[str] = None
    score: Optional[float] = None
    remark: Optional[str] = None


class AttendanceResponse(AttendanceBase):
    id: str
    training_id: str
    anchor_name: Optional[str] = None
    anchor_stage_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TrainingResponse(TrainingBase):
    id: str
    attendance_count: int = 0
    checked_in_count: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TrainingDetailResponse(TrainingResponse):
    attendances: List[AttendanceResponse] = []


class TrainingListResponse(BaseModel):
    items: List[TrainingResponse]
    total: int


class TrainingEffectMetric(BaseModel):
    """培训前后某个指标的对比"""
    label: str
    before: Optional[float] = None
    after: Optional[float] = None
    delta: Optional[float] = None
    delta_pct: Optional[float] = None


class TrainingEffectResponse(BaseModel):
    anchor_id: str
    anchor_name: Optional[str] = None
    training_id: str
    training_title: str
    training_date: datetime
    window_days: int = 7
    sessions_before: int = 0
    sessions_after: int = 0
    metrics: List[TrainingEffectMetric] = []


# Salary Schemas
class SalaryPeriodType(str, Enum):
    MONTH = "month"
    DAY = "day"


class SalaryStatus(str, Enum):
    DRAFT = "draft"
    PAID = "paid"
    CANCELLED = "cancelled"


class PaymentMethod(str, Enum):
    BANK = "bank"
    WECHAT = "wechat"
    ALIPAY = "alipay"
    CASH = "cash"
    OTHER = "other"


class CommissionTier(BaseModel):
    """单个阶梯：min ~ max（max 可空表示无上限），rate 是百分比 5 表示 5%"""
    min: float = 0
    max: Optional[float] = None
    rate: float = 0


class SalaryConfigBase(BaseModel):
    base_salary: float = 0.0
    daily_base: float = 0.0
    commission_tiers: List[CommissionTier] = []
    effective_from: Optional[date] = None
    remark: Optional[str] = None


class SalaryConfigUpdate(SalaryConfigBase):
    pass


class SalaryConfigResponse(SalaryConfigBase):
    id: str
    anchor_id: Optional[str] = None
    anchor_name: Optional[str] = None
    anchor_stage_name: Optional[str] = None
    is_default: bool = False
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SalaryConfigListResponse(BaseModel):
    items: List[SalaryConfigResponse]
    total: int


class SalaryPreviewRequest(BaseModel):
    anchor_id: str
    period_type: SalaryPeriodType = SalaryPeriodType.MONTH
    period_start: date
    period_end: date


class SalaryPreviewResponse(BaseModel):
    anchor_id: str
    anchor_name: Optional[str] = None
    period_type: SalaryPeriodType
    period_start: date
    period_end: date
    base_salary: float
    total_gmv: float
    session_count: int
    commission: float
    total_payable: float
    tiers_used: List[CommissionTier]


class SalaryRecordCreate(BaseModel):
    anchor_id: str
    period_type: SalaryPeriodType = SalaryPeriodType.MONTH
    period_start: date
    period_end: date
    bonus: float = 0
    deduction: float = 0
    remark: Optional[str] = None


class SalaryRecordUpdate(BaseModel):
    bonus: Optional[float] = None
    deduction: Optional[float] = None
    remark: Optional[str] = None


class SalaryRecordPay(BaseModel):
    paid_at: Optional[datetime] = None
    payment_method: PaymentMethod = PaymentMethod.BANK
    voucher: Optional[str] = None


class SalaryRecordResponse(BaseModel):
    id: str
    anchor_id: str
    anchor_name: Optional[str] = None
    anchor_stage_name: Optional[str] = None
    period_type: SalaryPeriodType
    period_start: date
    period_end: date
    base_salary: float
    total_gmv: float
    session_count: int
    commission: float
    bonus: float
    deduction: float
    total_payable: float
    status: SalaryStatus
    paid_at: Optional[datetime] = None
    payment_method: Optional[PaymentMethod] = None
    voucher: Optional[str] = None
    formula_snapshot: Optional[str] = None
    remark: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SalaryRecordListResponse(BaseModel):
    items: List[SalaryRecordResponse]
    total: int


# Contract Schemas
class ContractType(str, Enum):
    PROBATION = "probation"
    FORMAL = "formal"
    RENEWAL = "renewal"
    SUPPLEMENT = "supplement"


class ContractStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    EXPIRING_SOON = "expiring_soon"
    EXPIRED = "expired"
    TERMINATED = "terminated"


class ContractBase(BaseModel):
    contract_no: Optional[str] = None
    contract_type: ContractType = ContractType.FORMAL
    party_a: Optional[str] = "重庆君燚无双文化传媒有限公司"
    party_b: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    signed_at: Optional[date] = None
    base_salary: Optional[float] = 0
    commission_rate: Optional[str] = None
    penalty_terms: Optional[str] = None
    non_compete_terms: Optional[str] = None
    exclusive: bool = False
    auto_renew: bool = False
    previous_contract_id: Optional[str] = None
    remark: Optional[str] = None


class ContractCreate(ContractBase):
    anchor_id: str
    status: ContractStatus = ContractStatus.DRAFT


class ContractUpdate(BaseModel):
    contract_no: Optional[str] = None
    contract_type: Optional[ContractType] = None
    party_a: Optional[str] = None
    party_b: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    signed_at: Optional[date] = None
    base_salary: Optional[float] = None
    commission_rate: Optional[str] = None
    penalty_terms: Optional[str] = None
    non_compete_terms: Optional[str] = None
    exclusive: Optional[bool] = None
    auto_renew: Optional[bool] = None
    status: Optional[ContractStatus] = None
    remark: Optional[str] = None


class ContractTerminate(BaseModel):
    terminated_at: date
    termination_reason: Optional[str] = None


class ContractRenew(BaseModel):
    new_start_date: date
    new_end_date: date
    contract_type: ContractType = ContractType.RENEWAL
    contract_no: Optional[str] = None
    base_salary: Optional[float] = None
    remark: Optional[str] = None


class ContractResponse(BaseModel):
    id: str
    anchor_id: str
    anchor_name: Optional[str] = None
    anchor_stage_name: Optional[str] = None
    contract_no: Optional[str] = None
    contract_type: ContractType
    party_a: Optional[str] = None
    party_b: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    signed_at: Optional[date] = None
    base_salary: float = 0
    commission_rate: Optional[str] = None
    penalty_terms: Optional[str] = None
    non_compete_terms: Optional[str] = None
    exclusive: bool = False
    auto_renew: bool = False
    status: ContractStatus
    previous_contract_id: Optional[str] = None
    terminated_at: Optional[date] = None
    termination_reason: Optional[str] = None
    attachment_url: Optional[str] = None
    attachment_name: Optional[str] = None
    days_to_expire: Optional[int] = None
    remark: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ContractListResponse(BaseModel):
    items: List[ContractResponse]
    total: int


# ===== Assets: LiveRoom / Equipment / EquipmentLoan =====

class LivePlatform(str, Enum):
    DOUYIN = "douyin"
    KUAISHOU = "kuaishou"
    BILIBILI = "bilibili"
    HUYA = "huya"
    XIAOHONGSHU = "xiaohongshu"
    WECHAT = "wechat"
    TAOBAO = "taobao"
    OTHER = "other"


class DecorationLevel(str, Enum):
    BASIC = "basic"
    STANDARD = "standard"
    PREMIUM = "premium"


class LiveRoomStatus(str, Enum):
    ACTIVE = "active"
    IDLE = "idle"
    MAINTENANCE = "maintenance"
    SCRAPPED = "scrapped"


class EquipmentCategory(str, Enum):
    PHONE = "phone"
    COMPUTER = "computer"
    MICROPHONE = "microphone"
    LIGHT = "light"
    TRIPOD = "tripod"
    SOUND_CARD = "sound_card"
    CAMERA = "camera"
    NETWORK = "network"
    OTHER = "other"


class EquipmentStatus(str, Enum):
    IN_STOCK = "in_stock"
    IN_USE = "in_use"
    BORROWED = "borrowed"
    MAINTENANCE = "maintenance"
    LOST = "lost"
    SCRAPPED = "scrapped"


class LoanStatus(str, Enum):
    BORROWED = "borrowed"
    RETURNED = "returned"
    OVERDUE = "overdue"
    LOST = "lost"
    DAMAGED = "damaged"


class LiveRoomCreate(BaseModel):
    name: str
    platform: LivePlatform = LivePlatform.KUAISHOU
    platform_account: Optional[str] = None
    room_id: Optional[str] = None
    room_url: Optional[str] = None
    decoration_level: DecorationLevel = DecorationLevel.STANDARD
    decoration_note: Optional[str] = None
    assigned_anchor_id: Optional[str] = None
    status: LiveRoomStatus = LiveRoomStatus.ACTIVE
    location: Optional[str] = None
    remark: Optional[str] = None


class LiveRoomUpdate(BaseModel):
    name: Optional[str] = None
    platform: Optional[LivePlatform] = None
    platform_account: Optional[str] = None
    room_id: Optional[str] = None
    room_url: Optional[str] = None
    decoration_level: Optional[DecorationLevel] = None
    decoration_note: Optional[str] = None
    assigned_anchor_id: Optional[str] = None
    status: Optional[LiveRoomStatus] = None
    location: Optional[str] = None
    remark: Optional[str] = None


class LiveRoomResponse(BaseModel):
    id: str
    name: str
    platform: LivePlatform
    platform_account: Optional[str] = None
    room_id: Optional[str] = None
    room_url: Optional[str] = None
    decoration_level: DecorationLevel
    decoration_note: Optional[str] = None
    assigned_anchor_id: Optional[str] = None
    assigned_anchor_name: Optional[str] = None
    assigned_anchor_stage_name: Optional[str] = None
    status: LiveRoomStatus
    location: Optional[str] = None
    equipment_count: int = 0
    remark: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class LiveRoomListResponse(BaseModel):
    items: List[LiveRoomResponse]
    total: int


class EquipmentCreate(BaseModel):
    name: str
    category: EquipmentCategory = EquipmentCategory.OTHER
    brand: Optional[str] = None
    model: Optional[str] = None
    sn: Optional[str] = None
    purchase_date: Optional[date] = None
    purchase_price: Optional[float] = 0
    warranty_until: Optional[date] = None
    status: EquipmentStatus = EquipmentStatus.IN_STOCK
    live_room_id: Optional[str] = None
    location: Optional[str] = None
    remark: Optional[str] = None


class EquipmentUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[EquipmentCategory] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    sn: Optional[str] = None
    purchase_date: Optional[date] = None
    purchase_price: Optional[float] = None
    warranty_until: Optional[date] = None
    status: Optional[EquipmentStatus] = None
    live_room_id: Optional[str] = None
    location: Optional[str] = None
    remark: Optional[str] = None


class EquipmentResponse(BaseModel):
    id: str
    name: str
    category: EquipmentCategory
    brand: Optional[str] = None
    model: Optional[str] = None
    sn: Optional[str] = None
    purchase_date: Optional[date] = None
    purchase_price: float = 0
    warranty_until: Optional[date] = None
    status: EquipmentStatus
    live_room_id: Optional[str] = None
    live_room_name: Optional[str] = None
    current_holder_id: Optional[str] = None
    current_holder_name: Optional[str] = None
    location: Optional[str] = None
    remark: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class EquipmentListResponse(BaseModel):
    items: List[EquipmentResponse]
    total: int


class EquipmentLoanCreate(BaseModel):
    equipment_id: str
    anchor_id: str
    borrowed_at: Optional[datetime] = None
    expected_return_at: Optional[date] = None
    condition_on_borrow: Optional[str] = None
    borrow_note: Optional[str] = None


class EquipmentLoanReturn(BaseModel):
    returned_at: Optional[datetime] = None
    condition_on_return: Optional[str] = None
    return_note: Optional[str] = None
    status: LoanStatus = LoanStatus.RETURNED  # 也可以是 lost / damaged


class EquipmentLoanResponse(BaseModel):
    id: str
    equipment_id: str
    equipment_name: Optional[str] = None
    anchor_id: str
    anchor_name: Optional[str] = None
    anchor_stage_name: Optional[str] = None
    borrowed_at: datetime
    expected_return_at: Optional[date] = None
    returned_at: Optional[datetime] = None
    condition_on_borrow: Optional[str] = None
    condition_on_return: Optional[str] = None
    borrow_note: Optional[str] = None
    return_note: Optional[str] = None
    status: LoanStatus
    days_overdue: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class EquipmentLoanListResponse(BaseModel):
    items: List[EquipmentLoanResponse]
    total: int


# Operation Log Schemas
class OperationType(str, Enum):
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"


class OperationLogResponse(BaseModel):
    id: str
    operator: str
    action: OperationType
    target_type: str
    target_id: Optional[str]
    target_name: Optional[str]
    details: Optional[str]
    ip_address: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class OperationLogListResponse(BaseModel):
    items: List[OperationLogResponse]
    total: int


# ============== 用户与权限 Schemas ==============
class UserRole(str, Enum):
    ADMIN = "admin"
    OPERATOR = "operator"
    FINANCE = "finance"


class UserBase(BaseModel):
    username: str
    real_name: Optional[str] = None
    role: UserRole = UserRole.OPERATOR
    is_active: bool = True
    remark: Optional[str] = None


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    real_name: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    remark: Optional[str] = None


class UserPasswordReset(BaseModel):
    new_password: str


class UserResponse(UserBase):
    id: str
    last_login_at: Optional[datetime] = None
    last_login_ip: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class UserListResponse(BaseModel):
    items: List[UserResponse]
    total: int


# 登录
class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str
