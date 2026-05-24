import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Date, DateTime, ForeignKey, Enum as SQLEnum, Integer, Float, Numeric, Boolean
from sqlalchemy.orm import relationship
from .database import Base
import enum


class AnchorStatus(str, enum.Enum):
    ONBOARDING = "onboarding"
    ACTIVE = "active"
    INACTIVE = "inactive"


class NodeType(str, enum.Enum):
    ENTRY = "entry"
    TRAINING = "training"
    INTERVIEW = "interview"
    MILESTONE = "milestone"
    ASSESSMENT = "assessment"
    EXIT = "exit"


class OperationType(str, enum.Enum):
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"


class TrainingType(str, enum.Enum):
    NEW_HIRE = "new_hire"        # 新人培训
    PROMOTION = "promotion"      # 晋升培训
    COMPLIANCE = "compliance"    # 合规培训
    SKILL = "skill"              # 专业技能
    OTHER = "other"              # 其他


class TrainingMode(str, enum.Enum):
    ONLINE = "online"            # 线上
    OFFLINE = "offline"          # 线下
    HYBRID = "hybrid"            # 混合


class TrainingStatus(str, enum.Enum):
    PLANNED = "planned"          # 计划中
    ONGOING = "ongoing"          # 进行中
    COMPLETED = "completed"      # 已完成
    CANCELLED = "cancelled"      # 已取消


class AttendanceStatus(str, enum.Enum):
    REGISTERED = "registered"    # 已报名
    CHECKED_IN = "checked_in"    # 已签到
    ABSENT = "absent"            # 缺席
    LEAVE = "leave"              # 请假


class SalaryPeriodType(str, enum.Enum):
    MONTH = "month"              # 月结
    DAY = "day"                  # 日结


class SalaryStatus(str, enum.Enum):
    DRAFT = "draft"              # 草稿
    PAID = "paid"                # 已发放
    CANCELLED = "cancelled"      # 已作废


class PaymentMethod(str, enum.Enum):
    BANK = "bank"                # 银行转账
    WECHAT = "wechat"            # 微信
    ALIPAY = "alipay"            # 支付宝
    CASH = "cash"                # 现金
    OTHER = "other"              # 其他


class ContractType(str, enum.Enum):
    PROBATION = "probation"          # 试用合同
    FORMAL = "formal"                # 正式合同
    RENEWAL = "renewal"              # 续签合同
    SUPPLEMENT = "supplement"        # 补充协议


class ContractStatus(str, enum.Enum):
    DRAFT = "draft"                  # 草稿（未签订）
    ACTIVE = "active"                # 生效中
    EXPIRING_SOON = "expiring_soon"  # 即将到期（30 天内）
    EXPIRED = "expired"              # 已到期
    TERMINATED = "terminated"        # 已终止（提前解除）


class LivePlatform(str, enum.Enum):
    DOUYIN = "douyin"
    KUAISHOU = "kuaishou"
    BILIBILI = "bilibili"
    HUYA = "huya"
    XIAOHONGSHU = "xiaohongshu"
    WECHAT = "wechat"
    TAOBAO = "taobao"
    OTHER = "other"


class DecorationLevel(str, enum.Enum):
    BASIC = "basic"          # 基础
    STANDARD = "standard"    # 标准
    PREMIUM = "premium"      # 精装


class LiveRoomStatus(str, enum.Enum):
    ACTIVE = "active"           # 启用中
    IDLE = "idle"               # 空闲
    MAINTENANCE = "maintenance" # 维护中
    SCRAPPED = "scrapped"       # 已停用


class EquipmentCategory(str, enum.Enum):
    PHONE = "phone"
    COMPUTER = "computer"
    MICROPHONE = "microphone"
    LIGHT = "light"
    TRIPOD = "tripod"
    SOUND_CARD = "sound_card"
    CAMERA = "camera"
    NETWORK = "network"
    OTHER = "other"


class EquipmentStatus(str, enum.Enum):
    IN_STOCK = "in_stock"         # 在库可用
    IN_USE = "in_use"             # 在用（绑定到直播间）
    BORROWED = "borrowed"         # 借出
    MAINTENANCE = "maintenance"   # 维护中
    LOST = "lost"
    SCRAPPED = "scrapped"         # 已报废


class LoanStatus(str, enum.Enum):
    BORROWED = "borrowed"
    RETURNED = "returned"
    OVERDUE = "overdue"
    LOST = "lost"
    DAMAGED = "damaged"


class UserRole(str, enum.Enum):
    ADMIN = "admin"          # 管理员：全权限
    OPERATOR = "operator"    # 运营：除薪资写权限/合同终止/用户管理外可写
    FINANCE = "finance"      # 财务：薪资读写、其他模块只读


def generate_uuid():
    return str(uuid.uuid4())


class Anchor(Base):
    __tablename__ = "anchors"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(100), nullable=False)
    stage_name = Column(String(100), nullable=False)
    phone = Column(String(20))
    id_card = Column(String(18))
    platform = Column(String(50))
    gender = Column(String(20))
    age = Column(Integer)
    wechat = Column(String(100))
    city = Column(String(100))
    commute_distance = Column(String(100))
    marital_status = Column(String(20))
    has_children = Column(String(20))
    douyin_account = Column(String(100))
    kuaishou_account = Column(String(100))
    xiaohongshu_account = Column(String(100))
    weibo_account = Column(String(100))
    bilibili_account = Column(String(100))
    video_account = Column(String(100))
    followers_count = Column(Integer)
    average_viewers = Column(Float)
    average_gmv = Column(Float)
    conversion_rate = Column(Float)
    fan_profile = Column(Text)
    fan_growth = Column(Integer)
    bank_name = Column(String(100))
    bank_card_number = Column(String(50))
    bank_account_name = Column(String(100))
    emergency_contact_name = Column(String(100))
    emergency_contact_relation = Column(String(50))
    emergency_contact_phone = Column(String(20))
    category_tags = Column(String(255))
    style_tags = Column(String(255))
    level_tags = Column(String(255))
    grade = Column(String(20))
    grade_note = Column(Text)
    status = Column(SQLEnum(AnchorStatus), default=AnchorStatus.ONBOARDING)
    hire_date = Column(Date)
    leave_date = Column(Date)
    avatar = Column(String(500))
    remark = Column(Text)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    nodes = relationship("Node", back_populates="anchor", cascade="all, delete-orphan")
    live_records = relationship("LiveRecord", back_populates="anchor", cascade="all, delete-orphan")


class Node(Base):
    __tablename__ = "nodes"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    anchor_id = Column(String(36), ForeignKey("anchors.id", ondelete="CASCADE"), nullable=False)
    type = Column(SQLEnum(NodeType), nullable=False)
    date = Column(DateTime, nullable=False)
    location = Column(String(200))
    title = Column(String(200), nullable=False)
    content = Column(Text)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    anchor = relationship("Anchor", back_populates="nodes")
    files = relationship("FileRecord", back_populates="node", cascade="all, delete-orphan")


class FileRecord(Base):
    __tablename__ = "files"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    node_id = Column(String(36), ForeignKey("nodes.id", ondelete="CASCADE"), nullable=False)
    filename = Column(String(255), nullable=False)
    original_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_type = Column(String(50))
    file_size = Column(Integer)
    category = Column(String(50))
    uploaded_at = Column(DateTime, default=datetime.now)

    node = relationship("Node", back_populates="files")


class LiveRecord(Base):
    __tablename__ = "live_records"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    anchor_id = Column(String(36), ForeignKey("anchors.id", ondelete="CASCADE"), nullable=False)
    platform = Column(String(50))
    live_room = Column(String(100))
    live_date = Column(DateTime, nullable=False)
    live_end_time = Column(DateTime)
    duration_minutes = Column(Integer)
    viewers_count = Column(Integer)
    new_followers = Column(Integer)
    gmv = Column(Float)
    orders_count = Column(Integer)
    conversion_rate = Column(Float)
    review = Column(Text)
    problems = Column(Text)
    improvements = Column(Text)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    anchor = relationship("Anchor", back_populates="live_records")


class Training(Base):
    __tablename__ = "trainings"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    title = Column(String(200), nullable=False)
    training_type = Column(SQLEnum(TrainingType), default=TrainingType.SKILL)
    trainer = Column(String(100))
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime)
    duration_minutes = Column(Integer)
    mode = Column(SQLEnum(TrainingMode), default=TrainingMode.OFFLINE)
    location = Column(String(200))
    description = Column(Text)
    materials = Column(Text)
    status = Column(SQLEnum(TrainingStatus), default=TrainingStatus.PLANNED)
    is_compliance = Column(Integer, default=0)  # 0/1, 用 Integer 兼容 SQLite
    remark = Column(Text)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    attendances = relationship("TrainingAttendance", back_populates="training", cascade="all, delete-orphan")


class TrainingAttendance(Base):
    __tablename__ = "training_attendances"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    training_id = Column(String(36), ForeignKey("trainings.id", ondelete="CASCADE"), nullable=False)
    anchor_id = Column(String(36), ForeignKey("anchors.id", ondelete="CASCADE"), nullable=False)
    status = Column(SQLEnum(AttendanceStatus), default=AttendanceStatus.REGISTERED)
    check_in_time = Column(DateTime)
    check_in_method = Column(String(20))  # online / offline
    pre_training_note = Column(Text)
    post_training_note = Column(Text)
    score = Column(Float)
    remark = Column(Text)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    training = relationship("Training", back_populates="attendances")
    anchor = relationship("Anchor")


class SalaryConfig(Base):
    """薪资配置：每个主播一份；anchor_id 为空则为公司默认配置。"""
    __tablename__ = "salary_configs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    anchor_id = Column(String(36), ForeignKey("anchors.id", ondelete="CASCADE"), nullable=True, index=True)
    base_salary = Column(Float, default=0.0)         # 月底薪
    daily_base = Column(Float, default=0.0)          # 日基数（用于按日结算）
    commission_tiers = Column(Text)                  # JSON: [{"min":0,"max":10000,"rate":5}, ...]
    effective_from = Column(Date)                    # 生效日期
    remark = Column(Text)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    anchor = relationship("Anchor")


class SalaryRecord(Base):
    """结算单（工资单）"""
    __tablename__ = "salary_records"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    anchor_id = Column(String(36), ForeignKey("anchors.id", ondelete="CASCADE"), nullable=False, index=True)
    period_type = Column(SQLEnum(SalaryPeriodType), default=SalaryPeriodType.MONTH)
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)

    # 计算明细
    base_salary = Column(Float, default=0.0)
    total_gmv = Column(Float, default=0.0)
    session_count = Column(Integer, default=0)
    commission = Column(Float, default=0.0)
    bonus = Column(Float, default=0.0)
    deduction = Column(Float, default=0.0)
    total_payable = Column(Float, default=0.0)

    # 发放状态
    status = Column(SQLEnum(SalaryStatus), default=SalaryStatus.DRAFT)
    paid_at = Column(DateTime)
    payment_method = Column(SQLEnum(PaymentMethod))
    voucher = Column(String(500))                   # 发放凭证（截图路径或编号）

    formula_snapshot = Column(Text)                 # JSON 快照：结算时使用的阶梯规则
    remark = Column(Text)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    anchor = relationship("Anchor")


class Contract(Base):
    """合同信息：跟主播绑定，支持续签链。"""
    __tablename__ = "contracts"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    anchor_id = Column(String(36), ForeignKey("anchors.id", ondelete="CASCADE"), nullable=False, index=True)

    contract_no = Column(String(100), index=True)              # 合同编号
    contract_type = Column(SQLEnum(ContractType), default=ContractType.FORMAL, index=True)

    party_a = Column(String(200), default="重庆君燚无双文化传媒有限公司")
    party_b = Column(String(200))                              # 乙方姓名（默认主播姓名）

    start_date = Column(Date)
    end_date = Column(Date, index=True)                        # 用于到期计算
    signed_at = Column(Date)                                   # 实际签订日期

    # 合同要点
    base_salary = Column(Numeric(10, 2), default=0)            # 约定底薪
    commission_rate = Column(String(200))                      # 提成约定（文本，可写"按公司阶梯执行"或具体规则）
    penalty_terms = Column(Text)                               # 违约金条款
    non_compete_terms = Column(Text)                           # 竞业条款
    exclusive = Column(Boolean, default=False)                 # 是否独家
    auto_renew = Column(Boolean, default=False)                # 是否自动续签

    status = Column(SQLEnum(ContractStatus), default=ContractStatus.DRAFT, index=True)

    # 续签链
    previous_contract_id = Column(String(36), ForeignKey("contracts.id", ondelete="SET NULL"), nullable=True)

    # 终止
    terminated_at = Column(Date)
    termination_reason = Column(Text)

    # 附件
    attachment_url = Column(String(500))                       # 服务器上的路径
    attachment_name = Column(String(200))                      # 原始文件名

    remark = Column(Text)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    anchor = relationship("Anchor")
    previous_contract = relationship("Contract", remote_side="Contract.id", foreign_keys=[previous_contract_id])


class LiveRoom(Base):
    """直播间档案：平台账号 / 房间号 / 装修标准 / 长期分配主播"""
    __tablename__ = "live_rooms"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(100), nullable=False)
    platform = Column(SQLEnum(LivePlatform), default=LivePlatform.KUAISHOU)
    platform_account = Column(String(100))
    room_id = Column(String(100), index=True)        # 平台直播间编号
    room_url = Column(String(500))
    decoration_level = Column(SQLEnum(DecorationLevel), default=DecorationLevel.STANDARD)
    decoration_note = Column(Text)
    assigned_anchor_id = Column(String(36), ForeignKey("anchors.id", ondelete="SET NULL"), nullable=True, index=True)
    status = Column(SQLEnum(LiveRoomStatus), default=LiveRoomStatus.ACTIVE)
    location = Column(String(200))                   # 物理位置
    remark = Column(Text)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    assigned_anchor = relationship("Anchor", foreign_keys=[assigned_anchor_id])


class Equipment(Base):
    """设备资产：手机 / 麦克风 / 补光灯 等。"""
    __tablename__ = "equipment"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(200), nullable=False)
    category = Column(SQLEnum(EquipmentCategory), default=EquipmentCategory.OTHER, index=True)
    brand = Column(String(100))
    model = Column(String(100))
    sn = Column(String(200), index=True)            # 序列号
    purchase_date = Column(Date)
    purchase_price = Column(Numeric(10, 2), default=0)
    warranty_until = Column(Date)
    status = Column(SQLEnum(EquipmentStatus), default=EquipmentStatus.IN_STOCK, index=True)
    live_room_id = Column(String(36), ForeignKey("live_rooms.id", ondelete="SET NULL"), nullable=True, index=True)
    current_holder_id = Column(String(36), ForeignKey("anchors.id", ondelete="SET NULL"), nullable=True, index=True)
    location = Column(String(200))                  # 存放位置（如：仓库 A1）
    remark = Column(Text)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    live_room = relationship("LiveRoom", foreign_keys=[live_room_id])
    current_holder = relationship("Anchor", foreign_keys=[current_holder_id])


class EquipmentLoan(Base):
    """设备借用记录：谁借了什么、什么时候归还。"""
    __tablename__ = "equipment_loans"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    equipment_id = Column(String(36), ForeignKey("equipment.id", ondelete="CASCADE"), nullable=False, index=True)
    anchor_id = Column(String(36), ForeignKey("anchors.id", ondelete="CASCADE"), nullable=False, index=True)

    borrowed_at = Column(DateTime, default=datetime.now)
    expected_return_at = Column(Date)
    returned_at = Column(DateTime)

    condition_on_borrow = Column(String(200))       # 借出时设备状态描述
    condition_on_return = Column(String(200))       # 归还时设备状态描述
    borrow_note = Column(Text)
    return_note = Column(Text)

    status = Column(SQLEnum(LoanStatus), default=LoanStatus.BORROWED, index=True)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    equipment = relationship("Equipment")
    anchor = relationship("Anchor")


class OperationLog(Base):
    __tablename__ = "operation_logs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    operator = Column(String(100), default="系统")
    user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    action = Column(SQLEnum(OperationType), nullable=False)
    target_type = Column(String(50), nullable=False)  # "anchor", "node", "file"
    target_id = Column(String(36))
    target_name = Column(String(200))
    details = Column(Text)
    ip_address = Column(String(64))
    created_at = Column(DateTime, default=datetime.now)


class User(Base):
    """系统账号：admin / operator / finance 三个角色"""
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    username = Column(String(64), nullable=False, unique=True, index=True)
    password_hash = Column(String(255), nullable=False)
    real_name = Column(String(100))
    role = Column(SQLEnum(UserRole), nullable=False, default=UserRole.OPERATOR, index=True)
    is_active = Column(Boolean, default=True, nullable=False)
    last_login_at = Column(DateTime)
    last_login_ip = Column(String(64))
    remark = Column(Text)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)