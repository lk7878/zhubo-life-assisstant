import type {
  Anchor, AnchorCreate, AnchorUpdate, AnchorListResponse,
  Node, NodeCreate, NodeUpdate, NodeListResponse, TimelineNode,
  FileRecord, LibraryTreeNode, AnchorStatus,
  LiveRecord, LiveRecordCreate, LiveRecordListResponse, LiveRecordUpdate,
  TrainingCreate, TrainingUpdate, TrainingDetail, TrainingListResponse,
  TrainingAttendance, TrainingEffectResponse,
  SalaryConfig, SalaryConfigUpdate, SalaryConfigListResponse,
  SalaryPreviewRequest, SalaryPreviewResponse,
  SalaryRecord, SalaryRecordCreate, SalaryRecordUpdate, SalaryRecordPay, SalaryRecordListResponse,
  Contract, ContractCreate, ContractUpdate, ContractTerminate, ContractRenew, ContractListResponse,
  LiveRoom, LiveRoomCreate, LiveRoomUpdate, LiveRoomListResponse,
  Equipment, EquipmentCreate, EquipmentUpdate, EquipmentListResponse,
  EquipmentLoan, EquipmentLoanCreate, EquipmentLoanReturn, EquipmentLoanListResponse,
  User, UserCreate, UserUpdate, UserListResponse, UserRole, LoginRequest, LoginResponse,
} from '../types';

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) || '/api';
const TOKEN_KEY = 'zhubo_token';

/** 全局未授权处理：调用 authStore.logout 并跳转 /login */
let unauthorizedHandler: (() => void) | null = null;
export function setUnauthorizedHandler(handler: () => void) {
  unauthorizedHandler = handler;
}

// token 仅保存在 sessionStorage：浏览器（全部窗口）关闭后自动失效，需重新登录。
// 同时清理历史 localStorage 中残留的旧 token，避免老用户保持登录态。
if (typeof localStorage !== 'undefined' && localStorage.getItem(TOKEN_KEY)) {
  localStorage.removeItem(TOKEN_KEY);
}

export function getStoredToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null) {
  if (token) sessionStorage.setItem(TOKEN_KEY, token);
  else sessionStorage.removeItem(TOKEN_KEY);
}

function apiUrl(url: string): string {
  return url.startsWith('http://') || url.startsWith('https://') ? url : `${API_BASE}${url}`;
}

function filenameFromDisposition(disposition: string | null): string | null {
  if (!disposition) return null;
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) return decodeURIComponent(utf8Match[1]);
  const asciiMatch = disposition.match(/filename="?([^"]+)"?/i);
  return asciiMatch?.[1] ? decodeURIComponent(asciiMatch[1]) : null;
}

async function fetchBlob(url: string): Promise<{ blob: Blob; filename: string | null }> {
  const token = getStoredToken();
  const response = await fetch(apiUrl(url), {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  if (response.status === 401) {
    if (getStoredToken() && unauthorizedHandler) unauthorizedHandler();
    const error = await response.json().catch(() => ({ detail: '未登录或登录已过期' }));
    throw new Error(error.detail || '未登录或登录已过期');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: '请求失败' }));
    throw new Error(error.detail || '请求失败');
  }

  return {
    blob: await response.blob(),
    filename: filenameFromDisposition(response.headers.get('content-disposition')),
  };
}

async function downloadBlob(url: string, fallbackFilename: string): Promise<void> {
  const { blob, filename } = await fetchBlob(url);
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename || fallbackFilename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
}

async function openBlob(url: string): Promise<string> {
  const { blob } = await fetchBlob(url);
  const objectUrl = URL.createObjectURL(blob);
  window.open(objectUrl, '_blank', 'noopener,noreferrer');
  setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  return objectUrl;
}

async function fetchApi<T>(url: string, options?: RequestInit): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string> | undefined),
  };
  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    // 触发统一登出（避免循环跳转：只在已有 token 时清空）
    if (getStoredToken() && unauthorizedHandler) unauthorizedHandler();
    const error = await response.json().catch(() => ({ detail: '未登录或登录已过期' }));
    throw new Error(error.detail || '未登录或登录已过期');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: '请求失败' }));
    throw new Error(error.detail || '请求失败');
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

// === Auth API ===
export const authApi = {
  login: (data: LoginRequest) =>
    fetchApi<LoginResponse>('/auth/login', { method: 'POST', body: JSON.stringify(data) }) as Promise<LoginResponse>,
  me: () => fetchApi<User>('/auth/me') as Promise<User>,
  logout: () => fetchApi<{ ok: boolean }>('/auth/logout', { method: 'POST' }) as Promise<{ ok: boolean }>,
  changePassword: (oldPwd: string, newPwd: string) =>
    fetchApi<User>('/auth/change-password', {
      method: 'PUT',
      body: JSON.stringify({ old_password: oldPwd, new_password: newPwd }),
    }) as Promise<User>,
};

// === Users API（仅 admin 可用）===
export const usersApi = {
  list: (params?: { role?: UserRole; is_active?: boolean; search?: string; skip?: number; limit?: number }) => {
    const sp = new URLSearchParams();
    if (params?.role) sp.set('role', params.role);
    if (params?.is_active !== undefined) sp.set('is_active', String(params.is_active));
    if (params?.search) sp.set('search', params.search);
    if (params?.skip) sp.set('skip', String(params.skip));
    if (params?.limit) sp.set('limit', String(params.limit));
    const q = sp.toString();
    return fetchApi<UserListResponse>(`/users${q ? `?${q}` : ''}`) as Promise<UserListResponse>;
  },
  get: (id: string) => fetchApi<User>(`/users/${id}`) as Promise<User>,
  create: (data: UserCreate) =>
    fetchApi<User>('/users', { method: 'POST', body: JSON.stringify(data) }) as Promise<User>,
  update: (id: string, data: UserUpdate) =>
    fetchApi<User>(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }) as Promise<User>,
  resetPassword: (id: string, newPassword: string) =>
    fetchApi<User>(`/users/${id}/password`, { method: 'PUT', body: JSON.stringify({ new_password: newPassword }) }) as Promise<User>,
  resetBusinessData: () =>
    fetchApi<{ ok: boolean; deleted: Record<string, number> }>('/users/reset-business-data', { method: 'POST' }) as Promise<{ ok: boolean; deleted: Record<string, number> }>,
  delete: (id: string) => fetchApi<void>(`/users/${id}`, { method: 'DELETE' }),
};



export const dashboardApi = {
  overview: <T = unknown>(days = 30) => fetchApi<T>(`/dashboard/overview?days=${days}`) as Promise<T>,
};

// Anchors API
export const anchorsApi = {
  list: (params?: { search?: string; status?: AnchorStatus; skip?: number; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.set('search', params.search);
    if (params?.status) searchParams.set('status', params.status);
    if (params?.skip) searchParams.set('skip', String(params.skip));
    if (params?.limit) searchParams.set('limit', String(params.limit));
    const query = searchParams.toString();
    return fetchApi<AnchorListResponse>(`/anchors${query ? `?${query}` : ''}`) as Promise<AnchorListResponse>;
  },

  get: (id: string) => fetchApi<Anchor>(`/anchors/${id}`) as Promise<Anchor>,

  create: (data: AnchorCreate) =>
    fetchApi<Anchor>('/anchors', {
      method: 'POST',
      body: JSON.stringify(data),
    }) as Promise<Anchor>,

  update: (id: string, data: AnchorUpdate) =>
    fetchApi<Anchor>(`/anchors/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }) as Promise<Anchor>,

  delete: (id: string) =>
    fetchApi<void>(`/anchors/${id}`, { method: 'DELETE' }),

  timeline: (id: string) => fetchApi<TimelineNode[]>(`/anchors/${id}/timeline`) as Promise<TimelineNode[]>,
};

// Nodes API
export const nodesApi = {
  list: (anchorId: string, params?: { node_type?: string; skip?: number; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.node_type) searchParams.set('node_type', params.node_type);
    if (params?.skip) searchParams.set('skip', String(params.skip));
    if (params?.limit) searchParams.set('limit', String(params.limit));
    const query = searchParams.toString();
    return fetchApi<NodeListResponse>(`/anchors/${anchorId}/nodes${query ? `?${query}` : ''}`) as Promise<NodeListResponse>;
  },

  get: (id: string) => fetchApi<Node>(`/nodes/${id}`) as Promise<Node>,

  create: (anchorId: string, data: NodeCreate) =>
    fetchApi<Node>(`/anchors/${anchorId}/nodes`, {
      method: 'POST',
      body: JSON.stringify(data),
    }) as Promise<Node>,

  update: (id: string, data: NodeUpdate) =>
    fetchApi<Node>(`/nodes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }) as Promise<Node>,

  delete: (id: string) =>
    fetchApi<void>(`/nodes/${id}`, { method: 'DELETE' }),
};

export const liveRecordsApi = {
  list: (params?: { anchor_id?: string; platform?: string; skip?: number; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.anchor_id) searchParams.set('anchor_id', params.anchor_id);
    if (params?.platform) searchParams.set('platform', params.platform);
    if (params?.skip) searchParams.set('skip', String(params.skip));
    if (params?.limit) searchParams.set('limit', String(params.limit));
    const query = searchParams.toString();
    return fetchApi<LiveRecordListResponse>(`/live-records${query ? `?${query}` : ''}`) as Promise<LiveRecordListResponse>;
  },

  get: (id: string) => fetchApi<LiveRecord>(`/live-records/${id}`) as Promise<LiveRecord>,

  create: (data: LiveRecordCreate) =>
    fetchApi<LiveRecord>('/live-records', {
      method: 'POST',
      body: JSON.stringify(data),
    }) as Promise<LiveRecord>,

  update: (id: string, data: LiveRecordUpdate) =>
    fetchApi<LiveRecord>(`/live-records/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }) as Promise<LiveRecord>,

  delete: (id: string) =>
    fetchApi<void>(`/live-records/${id}`, { method: 'DELETE' }),
};

// Files API
export const filesApi = {
  upload: async (nodeId: string, category: string, file: File): Promise<FileRecord> => {
    const formData = new FormData();
    formData.append('category', category);
    formData.append('file', file);

    const token = getStoredToken();
    const response = await fetch(`${API_BASE}/nodes/${nodeId}/files`, {
      method: 'POST',
      body: formData,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });

    if (response.status === 401 && unauthorizedHandler) unauthorizedHandler();
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: '上传失败' }));
      throw new Error(error.detail || '上传失败');
    }

    return response.json();
  },

  download: (id: string, filename = 'file') =>
    downloadBlob(`/files/${id}`, filename),

  preview: (id: string) =>
    fetchBlob(`/files/${id}`).then(({ blob }) => URL.createObjectURL(blob)),

  openPreview: (id: string) =>
    openBlob(`/files/${id}`),

  delete: (id: string) =>
    fetchApi<void>(`/files/${id}`, { method: 'DELETE' }),
};

// Library API
export const libraryApi = {
  tree: () => fetchApi<LibraryTreeNode[]>('/library/tree') as Promise<LibraryTreeNode[]>,

  files: (params?: { category?: string; anchor_id?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.category) searchParams.set('category', params.category);
    if (params?.anchor_id) searchParams.set('anchor_id', params.anchor_id);
    const query = searchParams.toString();
    return fetchApi<any[]>(`/library/files${query ? `?${query}` : ''}`) as Promise<any[]>;
  },

  preview: (id: string) =>
    fetchBlob(`/library/preview/${id}`).then(({ blob }) => URL.createObjectURL(blob)),

  openPreview: (id: string) =>
    openBlob(`/library/preview/${id}`),

  deleteFile: (path: string) =>
    fetchApi<void>(`/library/file?path=${encodeURIComponent(path)}`, { method: 'DELETE' }),

  deleteFolder: (path: string) =>
    fetchApi<void>(`/library/folder?path=${encodeURIComponent(path)}`, { method: 'DELETE' }),

  cleanupOrphans: () =>
    fetchApi<{ removed_folders: string[]; removed_records: number }>(
      '/library/cleanup-orphans',
      { method: 'POST' },
    ) as Promise<{ removed_folders: string[]; removed_records: number }>,
};

// Trainings API
export const trainingsApi = {
  list: (params?: {
    keyword?: string;
    training_type?: string;
    status?: string;
    is_compliance?: number;
    anchor_id?: string;
    days?: number;
    skip?: number;
    limit?: number;
  }) => {
    const sp = new URLSearchParams();
    if (params?.keyword) sp.set('keyword', params.keyword);
    if (params?.training_type) sp.set('training_type', params.training_type);
    if (params?.status) sp.set('status', params.status);
    if (params?.is_compliance !== undefined) sp.set('is_compliance', String(params.is_compliance));
    if (params?.anchor_id) sp.set('anchor_id', params.anchor_id);
    if (params?.days) sp.set('days', String(params.days));
    if (params?.skip) sp.set('skip', String(params.skip));
    if (params?.limit) sp.set('limit', String(params.limit));
    const q = sp.toString();
    return fetchApi<TrainingListResponse>(`/trainings${q ? `?${q}` : ''}`) as Promise<TrainingListResponse>;
  },
  get: (id: string) => fetchApi<TrainingDetail>(`/trainings/${id}`) as Promise<TrainingDetail>,
  create: (data: TrainingCreate) =>
    fetchApi<TrainingDetail>('/trainings', { method: 'POST', body: JSON.stringify(data) }) as Promise<TrainingDetail>,
  update: (id: string, data: TrainingUpdate) =>
    fetchApi<TrainingDetail>(`/trainings/${id}`, { method: 'PUT', body: JSON.stringify(data) }) as Promise<TrainingDetail>,
  delete: (id: string) => fetchApi<void>(`/trainings/${id}`, { method: 'DELETE' }),

  addAttendances: (trainingId: string, anchor_ids: string[]) =>
    fetchApi<TrainingAttendance[]>(`/trainings/${trainingId}/attendances`, {
      method: 'POST',
      body: JSON.stringify({ anchor_ids }),
    }) as Promise<TrainingAttendance[]>,

  updateAttendance: (attendanceId: string, data: Partial<TrainingAttendance>) =>
    fetchApi<TrainingAttendance>(`/attendances/${attendanceId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }) as Promise<TrainingAttendance>,

  deleteAttendance: (attendanceId: string) =>
    fetchApi<void>(`/attendances/${attendanceId}`, { method: 'DELETE' }),

  effect: (attendanceId: string, window_days = 7) =>
    fetchApi<TrainingEffectResponse>(`/attendances/${attendanceId}/effect?window_days=${window_days}`) as Promise<TrainingEffectResponse>,
};

// Salary API
export const salaryApi = {
  getDefaultConfig: () =>
    fetchApi<SalaryConfig>('/salary/configs/default') as Promise<SalaryConfig>,
  updateDefaultConfig: (data: SalaryConfigUpdate) =>
    fetchApi<SalaryConfig>('/salary/configs/default', { method: 'PUT', body: JSON.stringify(data) }) as Promise<SalaryConfig>,

  listConfigs: () =>
    fetchApi<SalaryConfigListResponse>('/salary/configs') as Promise<SalaryConfigListResponse>,
  getAnchorConfig: (anchorId: string) =>
    fetchApi<SalaryConfig>(`/salary/configs/anchor/${anchorId}`) as Promise<SalaryConfig>,
  updateAnchorConfig: (anchorId: string, data: SalaryConfigUpdate) =>
    fetchApi<SalaryConfig>(`/salary/configs/anchor/${anchorId}`, { method: 'PUT', body: JSON.stringify(data) }) as Promise<SalaryConfig>,
  deleteAnchorConfig: (anchorId: string) =>
    fetchApi<void>(`/salary/configs/anchor/${anchorId}`, { method: 'DELETE' }),

  preview: (data: SalaryPreviewRequest) =>
    fetchApi<SalaryPreviewResponse>('/salary/preview', { method: 'POST', body: JSON.stringify(data) }) as Promise<SalaryPreviewResponse>,

  listRecords: (params?: { anchor_id?: string; status?: string; period_type?: string; month?: string; skip?: number; limit?: number }) => {
    const sp = new URLSearchParams();
    if (params?.anchor_id) sp.set('anchor_id', params.anchor_id);
    if (params?.status) sp.set('status', params.status);
    if (params?.period_type) sp.set('period_type', params.period_type);
    if (params?.month) sp.set('month', params.month);
    if (params?.skip) sp.set('skip', String(params.skip));
    if (params?.limit) sp.set('limit', String(params.limit));
    const q = sp.toString();
    return fetchApi<SalaryRecordListResponse>(`/salary/records${q ? `?${q}` : ''}`) as Promise<SalaryRecordListResponse>;
  },
  createRecord: (data: SalaryRecordCreate) =>
    fetchApi<SalaryRecord>('/salary/records', { method: 'POST', body: JSON.stringify(data) }) as Promise<SalaryRecord>,
  updateRecord: (id: string, data: SalaryRecordUpdate) =>
    fetchApi<SalaryRecord>(`/salary/records/${id}`, { method: 'PUT', body: JSON.stringify(data) }) as Promise<SalaryRecord>,
  payRecord: (id: string, data: SalaryRecordPay) =>
    fetchApi<SalaryRecord>(`/salary/records/${id}/pay`, { method: 'PUT', body: JSON.stringify(data) }) as Promise<SalaryRecord>,
  deleteRecord: (id: string) =>
    fetchApi<void>(`/salary/records/${id}`, { method: 'DELETE' }),
};

// Contract API
export const contractsApi = {
  list: (params?: { anchor_id?: string; status?: string; contract_type?: string; search?: string; skip?: number; limit?: number }) => {
    const sp = new URLSearchParams();
    if (params?.anchor_id) sp.set('anchor_id', params.anchor_id);
    if (params?.status) sp.set('status', params.status);
    if (params?.contract_type) sp.set('contract_type', params.contract_type);
    if (params?.search) sp.set('search', params.search);
    if (params?.skip) sp.set('skip', String(params.skip));
    if (params?.limit) sp.set('limit', String(params.limit));
    const q = sp.toString();
    return fetchApi<ContractListResponse>(`/contracts${q ? `?${q}` : ''}`) as Promise<ContractListResponse>;
  },
  expiring: (days = 30) =>
    fetchApi<ContractListResponse>(`/contracts/expiring?days=${days}`) as Promise<ContractListResponse>,
  get: (id: string) => fetchApi<Contract>(`/contracts/${id}`) as Promise<Contract>,
  create: (data: ContractCreate) =>
    fetchApi<Contract>('/contracts', { method: 'POST', body: JSON.stringify(data) }) as Promise<Contract>,
  update: (id: string, data: ContractUpdate) =>
    fetchApi<Contract>(`/contracts/${id}`, { method: 'PUT', body: JSON.stringify(data) }) as Promise<Contract>,
  terminate: (id: string, data: ContractTerminate) =>
    fetchApi<Contract>(`/contracts/${id}/terminate`, { method: 'PUT', body: JSON.stringify(data) }) as Promise<Contract>,
  renew: (id: string, data: ContractRenew) =>
    fetchApi<Contract>(`/contracts/${id}/renew`, { method: 'POST', body: JSON.stringify(data) }) as Promise<Contract>,
  uploadAttachment: async (id: string, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    const token = getStoredToken();
    const res = await fetch(`${API_BASE}/contracts/${id}/attachment`, {
      method: 'POST',
      body: fd,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (res.status === 401 && unauthorizedHandler) unauthorizedHandler();
    if (!res.ok) throw new Error((await res.json()).detail || `${res.status}`);
    return res.json() as Promise<Contract>;
  },
  downloadAttachment: (id: string, filename = 'contract-attachment') =>
    downloadBlob(`/contracts/${id}/attachment/download`, filename),
  delete: (id: string) => fetchApi<void>(`/contracts/${id}`, { method: 'DELETE' }),
};

// Live Rooms API
export const liveRoomsApi = {
  list: (params?: { platform?: string; status?: string; assigned_anchor_id?: string; search?: string; skip?: number; limit?: number }) => {
    const sp = new URLSearchParams();
    if (params?.platform) sp.set('platform', params.platform);
    if (params?.status) sp.set('status', params.status);
    if (params?.assigned_anchor_id) sp.set('assigned_anchor_id', params.assigned_anchor_id);
    if (params?.search) sp.set('search', params.search);
    if (params?.skip) sp.set('skip', String(params.skip));
    if (params?.limit) sp.set('limit', String(params.limit));
    const q = sp.toString();
    return fetchApi<LiveRoomListResponse>(`/live-rooms${q ? `?${q}` : ''}`) as Promise<LiveRoomListResponse>;
  },
  get: (id: string) => fetchApi<LiveRoom>(`/live-rooms/${id}`) as Promise<LiveRoom>,
  create: (data: LiveRoomCreate) =>
    fetchApi<LiveRoom>('/live-rooms', { method: 'POST', body: JSON.stringify(data) }) as Promise<LiveRoom>,
  update: (id: string, data: LiveRoomUpdate) =>
    fetchApi<LiveRoom>(`/live-rooms/${id}`, { method: 'PUT', body: JSON.stringify(data) }) as Promise<LiveRoom>,
  delete: (id: string) => fetchApi<void>(`/live-rooms/${id}`, { method: 'DELETE' }),
};

// Equipment API
export const equipmentApi = {
  list: (params?: { category?: string; status?: string; live_room_id?: string; search?: string; skip?: number; limit?: number }) => {
    const sp = new URLSearchParams();
    if (params?.category) sp.set('category', params.category);
    if (params?.status) sp.set('status', params.status);
    if (params?.live_room_id) sp.set('live_room_id', params.live_room_id);
    if (params?.search) sp.set('search', params.search);
    if (params?.skip) sp.set('skip', String(params.skip));
    if (params?.limit) sp.set('limit', String(params.limit));
    const q = sp.toString();
    return fetchApi<EquipmentListResponse>(`/equipment${q ? `?${q}` : ''}`) as Promise<EquipmentListResponse>;
  },
  get: (id: string) => fetchApi<Equipment>(`/equipment/${id}`) as Promise<Equipment>,
  create: (data: EquipmentCreate) =>
    fetchApi<Equipment>('/equipment', { method: 'POST', body: JSON.stringify(data) }) as Promise<Equipment>,
  update: (id: string, data: EquipmentUpdate) =>
    fetchApi<Equipment>(`/equipment/${id}`, { method: 'PUT', body: JSON.stringify(data) }) as Promise<Equipment>,
  delete: (id: string) => fetchApi<void>(`/equipment/${id}`, { method: 'DELETE' }),
};

// Equipment Loan API
export const equipmentLoansApi = {
  list: (params?: { equipment_id?: string; anchor_id?: string; status?: string; skip?: number; limit?: number }) => {
    const sp = new URLSearchParams();
    if (params?.equipment_id) sp.set('equipment_id', params.equipment_id);
    if (params?.anchor_id) sp.set('anchor_id', params.anchor_id);
    if (params?.status) sp.set('status', params.status);
    if (params?.skip) sp.set('skip', String(params.skip));
    if (params?.limit) sp.set('limit', String(params.limit));
    const q = sp.toString();
    return fetchApi<EquipmentLoanListResponse>(`/equipment-loans${q ? `?${q}` : ''}`) as Promise<EquipmentLoanListResponse>;
  },
  create: (data: EquipmentLoanCreate) =>
    fetchApi<EquipmentLoan>('/equipment-loans', { method: 'POST', body: JSON.stringify(data) }) as Promise<EquipmentLoan>,
  returnLoan: (id: string, data: EquipmentLoanReturn) =>
    fetchApi<EquipmentLoan>(`/equipment-loans/${id}/return`, { method: 'PUT', body: JSON.stringify(data) }) as Promise<EquipmentLoan>,
  delete: (id: string) => fetchApi<void>(`/equipment-loans/${id}`, { method: 'DELETE' }),
};

// Operation Logs API
export interface OperationLog {
  id: string;
  operator: string;
  action: string;
  target_type: string;
  target_id: string | null;
  target_name: string | null;
  details: string | null;
  ip_address?: string | null;
  created_at: string;
}

interface OperationLogListResponse {
  items: OperationLog[];
  total: number;
}

export const historyApi = {
  list: (params?: { action?: string; target_type?: string; days?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.action) searchParams.set('action', params.action);
    if (params?.target_type) searchParams.set('target_type', params.target_type);
    if (params?.days) searchParams.set('days', String(params.days));
    const query = searchParams.toString();
    return fetchApi<OperationLogListResponse>(`/logs${query ? `?${query}` : ''}`) as Promise<OperationLogListResponse>;
  },

  get: (id: string) => fetchApi<OperationLog>(`/logs/${id}`) as Promise<OperationLog>,
};