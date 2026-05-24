import { create } from 'zustand';
import { authApi, getStoredToken, setStoredToken, setUnauthorizedHandler } from '../api';
import type { User, UserRole } from '../types';

const USER_KEY = 'zhubo_user';

// 用户信息仅保存在 sessionStorage：浏览器（全部窗口）关闭后自动清空；
// 清理历史 localStorage 中残留的旧用户信息，避免误用旧身份。
if (typeof localStorage !== 'undefined' && localStorage.getItem(USER_KEY)) {
  localStorage.removeItem(USER_KEY);
}

function readStoredUser(): User | null {
  try {
    const raw = sessionStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

function writeStoredUser(user: User | null) {
  if (user) sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  else sessionStorage.removeItem(USER_KEY);
}

interface AuthState {
  token: string | null;
  user: User | null;
  loading: boolean;
  error: string | null;

  login: (username: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  /** 用本地 token 拉一次 /me，刷新 user 资料；token 过期会自动登出 */
  refreshMe: () => Promise<User | null>;
  /** 修改自己密码 */
  changePassword: (oldPwd: string, newPwd: string) => Promise<void>;

  // 权限工具
  hasRole: (...roles: UserRole[]) => boolean;
  isAdmin: () => boolean;
  /** 写权限粗粒度判断：模块 -> 是否可写 */
  canWrite: (module: WritableModule) => boolean;
}

export type WritableModule =
  | 'anchor' | 'node' | 'live_record' | 'training'
  | 'contract' | 'asset' | 'library'
  | 'salary'  // 财务 + admin
  | 'contract_terminate'  // 仅 admin
  | 'user';   // 仅 admin

export const useAuthStore = create<AuthState>((set, get) => ({
  token: getStoredToken(),
  user: readStoredUser(),
  loading: false,
  error: null,

  login: async (username, password) => {
    set({ loading: true, error: null });
    try {
      const res = await authApi.login({ username, password });
      setStoredToken(res.access_token);
      writeStoredUser(res.user);
      set({ token: res.access_token, user: res.user, loading: false });
      return res.user;
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
      throw e;
    }
  },

  logout: async () => {
    try { await authApi.logout(); } catch { /* ignore */ }
    setStoredToken(null);
    writeStoredUser(null);
    set({ token: null, user: null });
  },

  refreshMe: async () => {
    if (!get().token) return null;
    try {
      const me = await authApi.me();
      writeStoredUser(me);
      set({ user: me });
      return me;
    } catch {
      // token 失效或过期：清空
      setStoredToken(null);
      writeStoredUser(null);
      set({ token: null, user: null });
      return null;
    }
  },

  changePassword: async (oldPwd, newPwd) => {
    await authApi.changePassword(oldPwd, newPwd);
  },

  hasRole: (...roles) => {
    const r = get().user?.role;
    if (!r) return false;
    return roles.includes(r);
  },

  isAdmin: () => get().user?.role === 'admin',

  canWrite: (mod) => {
    const role = get().user?.role;
    if (!role) return false;
    if (role === 'admin') return true;
    if (mod === 'user') return false;
    if (mod === 'contract_terminate') return false;
    if (mod === 'salary') return role === 'finance';
    // 其他业务模块 operator 可写；finance 仅可读
    return role === 'operator';
  },
}));

// 注册 401 全局回调：清空 store 并跳转 /login
setUnauthorizedHandler(() => {
  setStoredToken(null);
  writeStoredUser(null);
  useAuthStore.setState({ token: null, user: null });
  // 用 location 直接跳转，避免依赖 router 实例
  if (window.location.pathname !== '/login') {
    window.location.replace('/login');
  }
});
