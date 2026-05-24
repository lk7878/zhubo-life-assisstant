// === D1: 用户与权限 ===
export type UserRole = 'admin' | 'operator' | 'finance';

export const USER_ROLE_LABEL: Record<UserRole, string> = {
  admin: '管理员',
  operator: '运营',
  finance: '财务',
};

export const USER_ROLE_COLOR: Record<UserRole, string> = {
  admin: '#FF3B30',
  operator: '#007AFF',
  finance: '#FF9500',
};

export interface User {
  id: string;
  username: string;
  real_name?: string | null;
  role: UserRole;
  is_active: boolean;
  remark?: string | null;
  last_login_at?: string | null;
  last_login_ip?: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserCreate {
  username: string;
  password: string;
  real_name?: string;
  role: UserRole;
  is_active?: boolean;
  remark?: string;
}

export interface UserUpdate {
  real_name?: string;
  role?: UserRole;
  is_active?: boolean;
  remark?: string;
}

export interface UserListResponse {
  items: User[];
  total: number;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export const AnchorStatus = {
  ONBOARDING: 'onboarding',
  ACTIVE: 'active',
  INACTIVE: 'inactive',
} as const;

export type AnchorStatus = typeof AnchorStatus[keyof typeof AnchorStatus];

export const NodeType = {
  ENTRY: 'entry',
  TRAINING: 'training',
  INTERVIEW: 'interview',
  MILESTONE: 'milestone',
  ASSESSMENT: 'assessment',
  EXIT: 'exit',
} as const;

export type NodeType = typeof NodeType[keyof typeof NodeType];

// 主播成长阶段（依据 hire_date 自动计算）
export const AnchorStage = {
  NEWBIE: 'newbie',     // 新人期 1-3 月
  GROWTH: 'growth',     // 成长期 3-6 月
  MATURE: 'mature',     // 成熟期 6-12 月
  TOP: 'top',           // 头部期 1 年+
  UNKNOWN: 'unknown',
} as const;

export type AnchorStage = typeof AnchorStage[keyof typeof AnchorStage];

export const STAGE_LABELS: Record<AnchorStage, string> = {
  newbie: '新人期',
  growth: '成长期',
  mature: '成熟期',
  top: '头部期',
  unknown: '未分阶段',
};

export const STAGE_COLORS: Record<AnchorStage, string> = {
  newbie: 'cyan',
  growth: 'blue',
  mature: 'geekblue',
  top: 'gold',
  unknown: 'default',
};

/**
 * 根据入职日期计算主播当前成长阶段
 * - 新人期：入职 < 3 个月
 * - 成长期：3 ~ 6 个月
 * - 成熟期：6 ~ 12 个月
 * - 头部期：>= 12 个月
 * 没有入职日期则返回 null
 */
export function computeStage(hireDate?: string | null, growthStage?: string | null): AnchorStage | null {
  if (growthStage && (Object.values(AnchorStage) as string[]).includes(growthStage)) {
    return growthStage as AnchorStage;
  }
  if (!hireDate) return null;
  const start = new Date(hireDate);
  if (isNaN(start.getTime())) return null;
  const now = new Date();
  const months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (months < 3) return AnchorStage.NEWBIE;
  if (months < 6) return AnchorStage.GROWTH;
  if (months < 12) return AnchorStage.MATURE;
  return AnchorStage.TOP;
}

export interface AnchorLiveStats {
  session_count: number;
  total_duration_minutes: number;
  avg_duration_minutes?: number | null;
  avg_viewers?: number | null;
  avg_gmv?: number | null;
  avg_conversion_rate?: number | null;
  total_new_followers: number;
  total_orders_count: number;
  total_gmv: number;
  last_live_date?: string | null;
}

export interface Anchor {
  id: string;
  name: string;
  stage_name: string;
  growth_stage?: AnchorStage | null;
  live_stats?: AnchorLiveStats;
  phone?: string;
  id_card?: string;
  platform?: string;
  gender?: string;
  age?: number;
  wechat?: string;
  city?: string;
  commute_distance?: string;
  marital_status?: string;
  has_children?: string;
  douyin_account?: string;
  kuaishou_account?: string;
  xiaohongshu_account?: string;
  weibo_account?: string;
  bilibili_account?: string;
  video_account?: string;
  followers_count?: number;
  average_viewers?: number;
  average_gmv?: number;
  conversion_rate?: number;
  fan_profile?: string;
  fan_growth?: number;
  bank_name?: string;
  bank_card_number?: string;
  bank_account_name?: string;
  emergency_contact_name?: string;
  emergency_contact_relation?: string;
  emergency_contact_phone?: string;
  category_tags?: string;
  style_tags?: string;
  level_tags?: string;
  grade?: string;
  grade_note?: string;
  status: AnchorStatus;
  hire_date?: string;
  leave_date?: string;
  avatar?: string;
  remark?: string;
  created_at: string;
  updated_at: string;
}

export interface AnchorCreate {
  name: string;
  stage_name: string;
  phone?: string;
  id_card?: string;
  platform?: string;
  gender?: string;
  age?: number;
  wechat?: string;
  city?: string;
  commute_distance?: string;
  marital_status?: string;
  has_children?: string;
  douyin_account?: string;
  kuaishou_account?: string;
  xiaohongshu_account?: string;
  weibo_account?: string;
  bilibili_account?: string;
  video_account?: string;
  followers_count?: number;
  average_viewers?: number;
  average_gmv?: number;
  conversion_rate?: number;
  fan_profile?: string;
  fan_growth?: number;
  bank_name?: string;
  bank_card_number?: string;
  bank_account_name?: string;
  emergency_contact_name?: string;
  emergency_contact_relation?: string;
  emergency_contact_phone?: string;
  category_tags?: string;
  style_tags?: string;
  level_tags?: string;
  grade?: string;
  grade_note?: string;
  status?: AnchorStatus;
  hire_date?: string;
  leave_date?: string;
  avatar?: string;
  remark?: string;
}

export interface AnchorUpdate {
  name?: string;
  stage_name?: string;
  phone?: string;
  id_card?: string;
  platform?: string;
  gender?: string;
  age?: number;
  wechat?: string;
  city?: string;
  commute_distance?: string;
  marital_status?: string;
  has_children?: string;
  douyin_account?: string;
  kuaishou_account?: string;
  xiaohongshu_account?: string;
  weibo_account?: string;
  bilibili_account?: string;
  video_account?: string;
  followers_count?: number;
  average_viewers?: number;
  average_gmv?: number;
  conversion_rate?: number;
  fan_profile?: string;
  fan_growth?: number;
  bank_name?: string;
  bank_card_number?: string;
  bank_account_name?: string;
  emergency_contact_name?: string;
  emergency_contact_relation?: string;
  emergency_contact_phone?: string;
  category_tags?: string;
  style_tags?: string;
  level_tags?: string;
  grade?: string;
  grade_note?: string;
  status?: AnchorStatus;
  hire_date?: string;
  leave_date?: string;
  avatar?: string;
  remark?: string;
}

export interface Node {
  id: string;
  anchor_id: string;
  type: NodeType;
  date: string;
  location?: string;
  title: string;
  content?: string;
  created_at: string;
  updated_at: string;
  files: FileRecord[];
}

export interface NodeCreate {
  type: NodeType;
  date: string;
  location?: string;
  title: string;
  content?: string;
}

export interface NodeUpdate {
  type?: NodeType;
  date?: string;
  location?: string;
  title?: string;
  content?: string;
}

export interface FileRecord {
  id: string;
  filename: string;
  original_name: string;
  file_type?: string;
  file_size?: number;
  category?: string;
  uploaded_at: string;
}

export interface TimelineNode {
  id: string;
  type: NodeType;
  date: string;
  title: string;
  location?: string;
}

export interface AnchorListResponse {
  items: Anchor[];
  total: number;
}

export interface NodeListResponse {
  items: Node[];
  total: number;
}

export interface LiveRecord {
  id: string;
  anchor_id: string;
  anchor_name?: string;
  anchor_stage_name?: string;
  platform?: string;
  live_room?: string;
  live_date: string;
  live_end_time?: string;
  duration_minutes?: number;
  viewers_count?: number;
  new_followers?: number;
  gmv?: number;
  orders_count?: number;
  conversion_rate?: number;
  review?: string;
  problems?: string;
  improvements?: string;
  created_at: string;
  updated_at: string;
}

export interface LiveRecordCreate {
  anchor_id: string;
  platform?: string;
  live_room?: string;
  live_date: string;
  live_end_time?: string;
  duration_minutes?: number;
  viewers_count?: number;
  new_followers?: number;
  gmv?: number;
  orders_count?: number;
  conversion_rate?: number;
  review?: string;
  problems?: string;
  improvements?: string;
}

export interface LiveRecordUpdate {
  anchor_id?: string;
  platform?: string;
  live_room?: string;
  live_date?: string;
  live_end_time?: string;
  duration_minutes?: number;
  viewers_count?: number;
  new_followers?: number;
  gmv?: number;
  orders_count?: number;
  conversion_rate?: number;
  review?: string;
  problems?: string;
  improvements?: string;
}

export interface LiveRecordListResponse {
  items: LiveRecord[];
  total: number;
}

export interface LibraryTreeNode {
  key?: string;
  name: string;
  path: string;
  type: 'folder' | 'file';
  children: LibraryTreeNode[];
  file_id?: string;
  isLeaf?: boolean;
  title?: string;
  orphan?: boolean;
}

export const STATUS_LABELS: Record<string, string> = {
  'onboarding': '实习',
  'active': '在职',
  'inactive': '离职',
};

export const STATUS_COLORS: Record<string, string> = {
  'onboarding': 'warning',
  'active': 'success',
  'inactive': 'default',
};

export const NODE_TYPE_LABELS: Record<string, string> = {
  'entry': '入职',
  'training': '培训',
  'interview': '谈话',
  'milestone': '里程碑',
  'assessment': '考核',
  'exit': '离职',
};

export const NODE_TYPE_COLORS: Record<string, string> = {
  'entry': 'blue',
  'training': 'green',
  'interview': 'orange',
  'milestone': 'purple',
  'assessment': 'red',
  'exit': 'gray',
};

export const NODE_TYPE_LIST = ['entry', 'training', 'interview', 'milestone', 'assessment', 'exit'];

// ---- Training ----

export const TrainingType = {
  NEW_HIRE: 'new_hire',
  PROMOTION: 'promotion',
  COMPLIANCE: 'compliance',
  SKILL: 'skill',
  OTHER: 'other',
} as const;
export type TrainingType = typeof TrainingType[keyof typeof TrainingType];

export const TRAINING_TYPE_LABELS: Record<TrainingType, string> = {
  new_hire: '新人培训',
  promotion: '晋升培训',
  compliance: '合规培训',
  skill: '专业技能',
  other: '其他',
};

export const TRAINING_TYPE_COLORS: Record<TrainingType, string> = {
  new_hire: 'cyan',
  promotion: 'purple',
  compliance: 'red',
  skill: 'blue',
  other: 'default',
};

export const TrainingMode = {
  ONLINE: 'online',
  OFFLINE: 'offline',
  HYBRID: 'hybrid',
} as const;
export type TrainingMode = typeof TrainingMode[keyof typeof TrainingMode];

export const TRAINING_MODE_LABELS: Record<TrainingMode, string> = {
  online: '线上',
  offline: '线下',
  hybrid: '混合',
};

export const TrainingStatus = {
  PLANNED: 'planned',
  ONGOING: 'ongoing',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;
export type TrainingStatus = typeof TrainingStatus[keyof typeof TrainingStatus];

export const TRAINING_STATUS_LABELS: Record<TrainingStatus, string> = {
  planned: '计划中',
  ongoing: '进行中',
  completed: '已完成',
  cancelled: '已取消',
};

export const TRAINING_STATUS_COLORS: Record<TrainingStatus, string> = {
  planned: 'default',
  ongoing: 'processing',
  completed: 'success',
  cancelled: 'error',
};

export const AttendanceStatus = {
  REGISTERED: 'registered',
  CHECKED_IN: 'checked_in',
  ABSENT: 'absent',
  LEAVE: 'leave',
} as const;
export type AttendanceStatus = typeof AttendanceStatus[keyof typeof AttendanceStatus];

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  registered: '已报名',
  checked_in: '已签到',
  absent: '缺席',
  leave: '请假',
};

export const ATTENDANCE_STATUS_COLORS: Record<AttendanceStatus, string> = {
  registered: 'default',
  checked_in: 'success',
  absent: 'error',
  leave: 'warning',
};

export interface TrainingAttendance {
  id: string;
  training_id: string;
  anchor_id: string;
  anchor_name?: string | null;
  anchor_stage_name?: string | null;
  status: AttendanceStatus;
  check_in_time?: string | null;
  check_in_method?: string | null;
  pre_training_note?: string | null;
  post_training_note?: string | null;
  score?: number | null;
  remark?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Training {
  id: string;
  title: string;
  training_type: TrainingType;
  trainer?: string | null;
  start_time: string;
  end_time?: string | null;
  duration_minutes?: number | null;
  mode: TrainingMode;
  location?: string | null;
  description?: string | null;
  materials?: string | null;
  status: TrainingStatus;
  is_compliance: number;
  remark?: string | null;
  attendance_count: number;
  checked_in_count: number;
  created_at: string;
  updated_at: string;
}

export interface TrainingDetail extends Training {
  attendances: TrainingAttendance[];
}

export interface TrainingCreate {
  title: string;
  training_type?: TrainingType;
  trainer?: string;
  start_time: string;
  end_time?: string;
  duration_minutes?: number;
  mode?: TrainingMode;
  location?: string;
  description?: string;
  materials?: string;
  status?: TrainingStatus;
  is_compliance?: number;
  remark?: string;
  anchor_ids?: string[];
}

export interface TrainingUpdate {
  title?: string;
  training_type?: TrainingType;
  trainer?: string;
  start_time?: string;
  end_time?: string;
  duration_minutes?: number;
  mode?: TrainingMode;
  location?: string;
  description?: string;
  materials?: string;
  status?: TrainingStatus;
  is_compliance?: number;
  remark?: string;
}

export interface TrainingListResponse {
  items: Training[];
  total: number;
}

export interface TrainingEffectMetric {
  label: string;
  before?: number | null;
  after?: number | null;
  delta?: number | null;
  delta_pct?: number | null;
}

export interface TrainingEffectResponse {
  anchor_id: string;
  anchor_name?: string | null;
  training_id: string;
  training_title: string;
  training_date: string;
  window_days: number;
  sessions_before: number;
  sessions_after: number;
  metrics: TrainingEffectMetric[];
}

// ---- Salary ----

export const SalaryPeriodType = {
  MONTH: 'month',
  DAY: 'day',
} as const;
export type SalaryPeriodType = typeof SalaryPeriodType[keyof typeof SalaryPeriodType];

export const SALARY_PERIOD_TYPE_LABELS: Record<SalaryPeriodType, string> = {
  month: '月结',
  day: '日结',
};

export const SalaryStatus = {
  DRAFT: 'draft',
  PAID: 'paid',
  CANCELLED: 'cancelled',
} as const;
export type SalaryStatus = typeof SalaryStatus[keyof typeof SalaryStatus];

export const SALARY_STATUS_LABELS: Record<SalaryStatus, string> = {
  draft: '草稿',
  paid: '已发放',
  cancelled: '已作废',
};

export const SALARY_STATUS_COLORS: Record<SalaryStatus, string> = {
  draft: 'default',
  paid: 'success',
  cancelled: 'error',
};

export const PaymentMethod = {
  BANK: 'bank',
  WECHAT: 'wechat',
  ALIPAY: 'alipay',
  CASH: 'cash',
  OTHER: 'other',
} as const;
export type PaymentMethod = typeof PaymentMethod[keyof typeof PaymentMethod];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  bank: '银行转账',
  wechat: '微信',
  alipay: '支付宝',
  cash: '现金',
  other: '其他',
};

export interface CommissionTier {
  min: number;
  max?: number | null;
  rate: number; // 百分比，5 表示 5%
}

export interface SalaryConfig {
  id: string;
  anchor_id: string | null;
  anchor_name?: string | null;
  anchor_stage_name?: string | null;
  is_default: boolean;
  base_salary: number;
  daily_base: number;
  commission_tiers: CommissionTier[];
  effective_from?: string | null;
  remark?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SalaryConfigUpdate {
  base_salary: number;
  daily_base: number;
  commission_tiers: CommissionTier[];
  effective_from?: string | null;
  remark?: string | null;
}

export interface SalaryConfigListResponse {
  items: SalaryConfig[];
  total: number;
}

export interface SalaryPreviewRequest {
  anchor_id: string;
  period_type: SalaryPeriodType;
  period_start: string;
  period_end: string;
}

export interface SalaryPreviewResponse {
  anchor_id: string;
  anchor_name?: string | null;
  period_type: SalaryPeriodType;
  period_start: string;
  period_end: string;
  base_salary: number;
  total_gmv: number;
  session_count: number;
  commission: number;
  total_payable: number;
  tiers_used: CommissionTier[];
}

export interface SalaryRecord {
  id: string;
  anchor_id: string;
  anchor_name?: string | null;
  anchor_stage_name?: string | null;
  period_type: SalaryPeriodType;
  period_start: string;
  period_end: string;
  base_salary: number;
  total_gmv: number;
  session_count: number;
  commission: number;
  bonus: number;
  deduction: number;
  total_payable: number;
  status: SalaryStatus;
  paid_at?: string | null;
  payment_method?: PaymentMethod | null;
  voucher?: string | null;
  formula_snapshot?: string | null;
  remark?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SalaryRecordCreate {
  anchor_id: string;
  period_type: SalaryPeriodType;
  period_start: string;
  period_end: string;
  bonus?: number;
  deduction?: number;
  remark?: string;
}

export interface SalaryRecordUpdate {
  bonus?: number;
  deduction?: number;
  remark?: string;
}

export interface SalaryRecordPay {
  paid_at?: string;
  payment_method: PaymentMethod;
  voucher?: string;
}

export interface SalaryRecordListResponse {
  items: SalaryRecord[];
  total: number;
}

// ---- Contract ----

export const ContractType = {
  PROBATION: 'probation',
  FORMAL: 'formal',
  RENEWAL: 'renewal',
  SUPPLEMENT: 'supplement',
} as const;
export type ContractType = typeof ContractType[keyof typeof ContractType];

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  probation: '试用合同',
  formal: '正式合同',
  renewal: '续签合同',
  supplement: '补充协议',
};

export const ContractStatus = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  EXPIRING_SOON: 'expiring_soon',
  EXPIRED: 'expired',
  TERMINATED: 'terminated',
} as const;
export type ContractStatus = typeof ContractStatus[keyof typeof ContractStatus];

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  draft: '草稿',
  active: '生效中',
  expiring_soon: '即将到期',
  expired: '已到期',
  terminated: '已终止',
};

export const CONTRACT_STATUS_COLORS: Record<ContractStatus, string> = {
  draft: 'default',
  active: 'green',
  expiring_soon: 'orange',
  expired: 'red',
  terminated: 'red',
};

export interface Contract {
  id: string;
  anchor_id: string;
  anchor_name?: string | null;
  anchor_stage_name?: string | null;
  contract_no?: string | null;
  contract_type: ContractType;
  party_a?: string | null;
  party_b?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  signed_at?: string | null;
  base_salary: number;
  commission_rate?: string | null;
  penalty_terms?: string | null;
  non_compete_terms?: string | null;
  exclusive: boolean;
  auto_renew: boolean;
  status: ContractStatus;
  previous_contract_id?: string | null;
  terminated_at?: string | null;
  termination_reason?: string | null;
  attachment_url?: string | null;
  attachment_name?: string | null;
  days_to_expire?: number | null;
  remark?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContractCreate {
  anchor_id: string;
  contract_no?: string;
  contract_type?: ContractType;
  party_a?: string;
  party_b?: string;
  start_date?: string;
  end_date?: string;
  signed_at?: string;
  base_salary?: number;
  commission_rate?: string;
  penalty_terms?: string;
  non_compete_terms?: string;
  exclusive?: boolean;
  auto_renew?: boolean;
  status?: ContractStatus;
  previous_contract_id?: string;
  remark?: string;
}

export interface ContractUpdate {
  contract_no?: string;
  contract_type?: ContractType;
  party_a?: string;
  party_b?: string;
  start_date?: string;
  end_date?: string;
  signed_at?: string;
  base_salary?: number;
  commission_rate?: string;
  penalty_terms?: string;
  non_compete_terms?: string;
  exclusive?: boolean;
  auto_renew?: boolean;
  status?: ContractStatus;
  remark?: string;
}

export interface ContractTerminate {
  terminated_at: string;
  termination_reason?: string;
}

export interface ContractRenew {
  new_start_date: string;
  new_end_date: string;
  contract_type?: ContractType;
  contract_no?: string;
  base_salary?: number;
  remark?: string;
}

export interface ContractListResponse {
  items: Contract[];
  total: number;
}

// ---- Assets: LiveRoom / Equipment / EquipmentLoan ----

export const LivePlatform = {
  KUAISHOU: 'kuaishou',
} as const;
export type LivePlatform = typeof LivePlatform[keyof typeof LivePlatform];

export const LIVE_PLATFORM_LABELS: Record<LivePlatform, string> = {
  kuaishou: '快手',
};

export const DecorationLevel = {
  BASIC: 'basic',
  STANDARD: 'standard',
  PREMIUM: 'premium',
} as const;
export type DecorationLevel = typeof DecorationLevel[keyof typeof DecorationLevel];

export const DECORATION_LEVEL_LABELS: Record<DecorationLevel, string> = {
  basic: '基础',
  standard: '标准',
  premium: '精装',
};

export const LiveRoomStatus = {
  ACTIVE: 'active',
  IDLE: 'idle',
  MAINTENANCE: 'maintenance',
  SCRAPPED: 'scrapped',
} as const;
export type LiveRoomStatus = typeof LiveRoomStatus[keyof typeof LiveRoomStatus];

export const LIVE_ROOM_STATUS_LABELS: Record<LiveRoomStatus, string> = {
  active: '启用中',
  idle: '空闲',
  maintenance: '维护中',
  scrapped: '已停用',
};

export const LIVE_ROOM_STATUS_COLORS: Record<LiveRoomStatus, string> = {
  active: 'green',
  idle: 'default',
  maintenance: 'orange',
  scrapped: 'red',
};

export const EquipmentCategory = {
  PHONE: 'phone',
  COMPUTER: 'computer',
  MICROPHONE: 'microphone',
  LIGHT: 'light',
  TRIPOD: 'tripod',
  SOUND_CARD: 'sound_card',
  CAMERA: 'camera',
  NETWORK: 'network',
  OTHER: 'other',
} as const;
export type EquipmentCategory = typeof EquipmentCategory[keyof typeof EquipmentCategory];

export const EQUIPMENT_CATEGORY_LABELS: Record<EquipmentCategory, string> = {
  phone: '手机',
  computer: '电脑',
  microphone: '麦克风',
  light: '补光灯',
  tripod: '支架',
  sound_card: '声卡',
  camera: '摄像头',
  network: '网络设备',
  other: '其他',
};

export const EquipmentStatus = {
  IN_STOCK: 'in_stock',
  IN_USE: 'in_use',
  BORROWED: 'borrowed',
  MAINTENANCE: 'maintenance',
  LOST: 'lost',
  SCRAPPED: 'scrapped',
} as const;
export type EquipmentStatus = typeof EquipmentStatus[keyof typeof EquipmentStatus];

export const EQUIPMENT_STATUS_LABELS: Record<EquipmentStatus, string> = {
  in_stock: '在库',
  in_use: '在用',
  borrowed: '借出',
  maintenance: '维护中',
  lost: '丢失',
  scrapped: '已报废',
};

export const EQUIPMENT_STATUS_COLORS: Record<EquipmentStatus, string> = {
  in_stock: 'green',
  in_use: 'blue',
  borrowed: 'orange',
  maintenance: 'gold',
  lost: 'volcano',
  scrapped: 'red',
};

export const LoanStatus = {
  BORROWED: 'borrowed',
  RETURNED: 'returned',
  OVERDUE: 'overdue',
  LOST: 'lost',
  DAMAGED: 'damaged',
} as const;
export type LoanStatus = typeof LoanStatus[keyof typeof LoanStatus];

export const LOAN_STATUS_LABELS: Record<LoanStatus, string> = {
  borrowed: '借出中',
  returned: '已归还',
  overdue: '已逾期',
  lost: '丢失',
  damaged: '损坏',
};

export const LOAN_STATUS_COLORS: Record<LoanStatus, string> = {
  borrowed: 'blue',
  returned: 'green',
  overdue: 'red',
  lost: 'red',
  damaged: 'orange',
};

export interface LiveRoom {
  id: string;
  name: string;
  platform: LivePlatform;
  platform_account?: string | null;
  room_id?: string | null;
  room_url?: string | null;
  decoration_level: DecorationLevel;
  decoration_note?: string | null;
  assigned_anchor_id?: string | null;
  assigned_anchor_name?: string | null;
  assigned_anchor_stage_name?: string | null;
  status: LiveRoomStatus;
  location?: string | null;
  equipment_count: number;
  remark?: string | null;
  created_at: string;
  updated_at: string;
}

export interface LiveRoomCreate {
  name: string;
  platform?: LivePlatform;
  platform_account?: string;
  room_id?: string;
  room_url?: string;
  decoration_level?: DecorationLevel;
  decoration_note?: string;
  assigned_anchor_id?: string | null;
  status?: LiveRoomStatus;
  location?: string;
  remark?: string;
}

export interface LiveRoomUpdate extends Partial<LiveRoomCreate> {}

export interface LiveRoomListResponse {
  items: LiveRoom[];
  total: number;
}

export interface Equipment {
  id: string;
  name: string;
  category: EquipmentCategory;
  brand?: string | null;
  model?: string | null;
  sn?: string | null;
  purchase_date?: string | null;
  purchase_price: number;
  warranty_until?: string | null;
  status: EquipmentStatus;
  live_room_id?: string | null;
  live_room_name?: string | null;
  current_holder_id?: string | null;
  current_holder_name?: string | null;
  location?: string | null;
  remark?: string | null;
  created_at: string;
  updated_at: string;
}

export interface EquipmentCreate {
  name: string;
  category?: EquipmentCategory;
  brand?: string;
  model?: string;
  sn?: string;
  purchase_date?: string;
  purchase_price?: number;
  warranty_until?: string;
  status?: EquipmentStatus;
  live_room_id?: string | null;
  location?: string;
  remark?: string;
}

export interface EquipmentUpdate extends Partial<EquipmentCreate> {}

export interface EquipmentListResponse {
  items: Equipment[];
  total: number;
}

export interface EquipmentLoan {
  id: string;
  equipment_id: string;
  equipment_name?: string | null;
  anchor_id: string;
  anchor_name?: string | null;
  anchor_stage_name?: string | null;
  borrowed_at: string;
  expected_return_at?: string | null;
  returned_at?: string | null;
  condition_on_borrow?: string | null;
  condition_on_return?: string | null;
  borrow_note?: string | null;
  return_note?: string | null;
  status: LoanStatus;
  days_overdue?: number | null;
  created_at: string;
  updated_at: string;
}

export interface EquipmentLoanCreate {
  equipment_id: string;
  anchor_id: string;
  borrowed_at?: string;
  expected_return_at?: string;
  condition_on_borrow?: string;
  borrow_note?: string;
}

export interface EquipmentLoanReturn {
  returned_at?: string;
  condition_on_return?: string;
  return_note?: string;
  status?: LoanStatus;
}

export interface EquipmentLoanListResponse {
  items: EquipmentLoan[];
  total: number;
}
