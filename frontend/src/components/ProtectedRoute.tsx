import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuthStore } from '../stores/authStore';
import type { UserRole } from '../types';

interface Props {
  children: React.ReactNode;
  /** 限定必须包含其中之一的角色才能访问；不传则只要求登录 */
  roles?: UserRole[];
}

export default function ProtectedRoute({ children, roles }: Props) {
  const location = useLocation();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const refreshMe = useAuthStore((s) => s.refreshMe);
  const [checking, setChecking] = useState(!!token && !user);

  useEffect(() => {
    let mounted = true;
    if (token && !user) {
      setChecking(true);
      refreshMe().finally(() => {
        if (mounted) setChecking(false);
      });
    }
    return () => { mounted = false; };
  }, [token, user, refreshMe]);

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  if (checking) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (roles && roles.length > 0 && (!user || !roles.includes(user.role))) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
