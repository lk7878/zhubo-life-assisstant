import { useState } from 'react';
import { Layout as AntLayout, Input, Drawer, Button, Dropdown, Avatar, Tag, Modal, Form, message } from 'antd';
import {
  HomeOutlined, FolderOutlined, MenuOutlined, FileTextOutlined, BarChartOutlined,
  ReadOutlined, DollarOutlined, LogoutOutlined, ProfileOutlined, AppstoreOutlined,
  TeamOutlined, UserOutlined, KeyOutlined, DownOutlined, DashboardOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAnchorStore } from '../stores/anchorStore';
import { useAuthStore } from '../stores/authStore';
import { USER_ROLE_LABEL, USER_ROLE_COLOR } from '../types';
import type { UserRole } from '../types';
import '../styles/apple-design.css';

const { Header, Content } = AntLayout;
const { Search } = Input;

interface NavItem {
  key: string;
  icon: React.ReactNode;
  label: string;
  /** 仅这些角色可见；不填则所有登录用户可见 */
  roles?: UserRole[];
}

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setSearch } = useAnchorStore();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const changePassword = useAuthStore((s) => s.changePassword);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [pwdForm] = Form.useForm();

  const selectedKey = location.pathname === '/' ? 'home' : location.pathname.split('/')[1] || 'home';

  // 菜单按角色可见性配置
  const allNavItems: NavItem[] = [
    { key: 'home',         icon: <HomeOutlined />,      label: '主播列表' },
    { key: 'dashboard',    icon: <DashboardOutlined />, label: '经营看板' },
    { key: 'live-records', icon: <BarChartOutlined />,  label: '直播记录' },
    { key: 'trainings',    icon: <ReadOutlined />,      label: '培训管理' },
    { key: 'salaries',     icon: <DollarOutlined />,    label: '薪资结算' },
    { key: 'contracts',    icon: <ProfileOutlined />,   label: '合同管理' },
    { key: 'assets',       icon: <AppstoreOutlined />,  label: '资产管理' },
    { key: 'library',      icon: <FolderOutlined />,    label: '材料库' },
    { key: 'logs',         icon: <FileTextOutlined />,  label: '操作日志' },
    { key: 'users',        icon: <TeamOutlined />,      label: '用户管理', roles: ['admin'] },
  ];

  const navItems = allNavItems.filter((it) => !it.roles || (user && it.roles.includes(user.role)));

  const handleSearch = (value: string) => {
    if (value.trim()) {
      setSearch(value);
      navigate('/');
    }
  };

  const handleNavClick = (key: string) => {
    if (key === 'home') navigate('/');
    else navigate(`/${key}`);
  };

  return (
    <AntLayout style={{ minHeight: '100vh', background: '#F2F2F7' }}>
      {/* Apple 风格顶部导航 */}
      <Header style={{
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        gap: 16,
        background: '#FFFFFF',
        borderBottom: '1px solid #E5E5EA',
        height: 52,
        lineHeight: '52px'
      }}>
        <Button
          className="mobile-menu-btn"
          type="text"
          icon={<MenuOutlined />}
          onClick={() => setDrawerVisible(true)}
          style={{ display: 'none', color: '#1D1D1F' }}
        />
        {/* Logo */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          whiteSpace: 'nowrap'
        }}>
          <div style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: '#007AFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: 14,
            fontWeight: 600
          }}>
            君
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: '#1D1D1F' }}>
              弹幕游戏主播管理系统
            </span>
            <span style={{ fontSize: 11, color: '#86868B' }}>
              重庆君燚无双文化传媒有限公司
            </span>
          </div>
        </div>

        {/* 桌面端导航 */}
        <div className="desktop-menu" style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          flex: 1,
          marginLeft: 24,
          padding: '0 8px',
          background: '#F2F2F7',
          borderRadius: 10,
          height: 36
        }}>
          {navItems.map(item => (
            <div
              key={item.key}
              onClick={() => handleNavClick(item.key)}
              className={`apple-filter__item ${selectedKey === item.key ? 'apple-filter__item--active' : ''}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                borderRadius: 8,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                fontSize: 13,
                fontWeight: selectedKey === item.key ? 600 : 400
              }}
            >
              {item.icon}
              <span>{item.label}</span>
            </div>
          ))}
        </div>

        {/* 搜索框 */}
        <Search
          placeholder="搜索主播..."
          onSearch={handleSearch}
          className="desktop-search"
          style={{ width: 200 }}
        />

        {/* 右上角用户区 */}
        {user && (
          <Dropdown
            menu={{
              items: [
                {
                  key: 'whoami',
                  disabled: true,
                  label: (
                    <div style={{ minWidth: 180, padding: '4px 0' }}>
                      <div style={{ fontWeight: 600, color: '#1D1D1F' }}>
                        {user.real_name || user.username}
                      </div>
                      <div style={{ fontSize: 12, color: '#86868B' }}>
                        @{user.username} · <Tag color={USER_ROLE_COLOR[user.role]} style={{ marginInlineEnd: 0 }}>{USER_ROLE_LABEL[user.role]}</Tag>
                      </div>
                    </div>
                  ),
                },
                { type: 'divider' },
                {
                  key: 'changepwd',
                  icon: <KeyOutlined />,
                  label: '修改密码',
                  onClick: () => { pwdForm.resetFields(); setPwdOpen(true); },
                },
                {
                  key: 'logout',
                  icon: <LogoutOutlined />,
                  label: '退出登录',
                  danger: true,
                  onClick: async () => { await logout(); navigate('/login', { replace: true }); },
                },
              ],
            }}
            placement="bottomRight"
          >
            <div
              className="user-chip"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '4px 10px',
                borderRadius: 18,
                background: '#F2F2F7',
                cursor: 'pointer',
                height: 36,
              }}
            >
              <Avatar size={26} icon={<UserOutlined />} style={{ background: USER_ROLE_COLOR[user.role] }} />
              <span style={{ fontSize: 13, color: '#1D1D1F', fontWeight: 500 }} className="desktop-username">
                {user.real_name || user.username}
              </span>
              <DownOutlined style={{ fontSize: 10, color: '#86868B' }} />
            </div>
          </Dropdown>
        )}

        {/* 移动端抽屉 */}
        <Drawer
          title={
            <span style={{ fontSize: 17, fontWeight: 600 }}>
              菜单
            </span>
          }
          placement="left"
          onClose={() => setDrawerVisible(false)}
          open={drawerVisible}
          width={280}
          styles={{ body: { padding: 0 } }}
        >
          <div style={{ padding: '12px' }}>
            {navItems.map(item => (
              <div
                key={item.key}
                onClick={() => {
                  setDrawerVisible(false);
                  handleNavClick(item.key);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 12px',
                  borderRadius: 8,
                  background: selectedKey === item.key ? '#007AFF' : 'transparent',
                  color: selectedKey === item.key ? '#fff' : '#1D1D1F',
                  cursor: 'pointer',
                  fontWeight: selectedKey === item.key ? 600 : 400,
                  marginBottom: 4
                }}
              >
                {item.icon}
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </Drawer>
      </Header>

      {/* 主内容区 */}
      <AntLayout style={{ background: '#F2F2F7' }}>
        <Content style={{ padding: 24 }}>
          <Outlet />
        </Content>
      </AntLayout>

      {/* 修改密码 Modal */}
      <Modal
        open={pwdOpen}
        title="修改我的密码"
        onCancel={() => setPwdOpen(false)}
        onOk={async () => {
          try {
            const v = await pwdForm.validateFields();
            await changePassword(v.old_password, v.new_password);
            message.success('密码已修改，下次请使用新密码登录');
            setPwdOpen(false);
          } catch (e) {
            if ((e as { errorFields?: unknown }).errorFields) return;
            message.error((e as Error).message);
          }
        }}
        okText="保存"
        destroyOnClose
        width={420}
      >
        <Form form={pwdForm} layout="vertical" preserve={false}>
          <Form.Item label="原密码" name="old_password" rules={[{ required: true, message: '请输入原密码' }]}>
            <Input.Password placeholder="原密码" />
          </Form.Item>
          <Form.Item label="新密码" name="new_password" rules={[{ required: true, message: '请输入新密码' }, { min: 6, message: '至少 6 位' }]}>
            <Input.Password placeholder="至少 6 位" />
          </Form.Item>
          <Form.Item
            label="确认新密码"
            name="confirm_password"
            dependencies={["new_password"]}
            rules={[
              { required: true, message: '请确认新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('new_password') === value) return Promise.resolve();
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password placeholder="再次输入新密码" />
          </Form.Item>
        </Form>
      </Modal>

      <style>{`
        @media (max-width: 768px) {
          .desktop-menu { display: none !important; }
          .desktop-search { display: none !important; }
          .desktop-username { display: none !important; }
          .mobile-menu-btn { display: block !important; }
        }
        @media (min-width: 769px) {
          .mobile-menu-btn { display: none !important; }
        }
      `}</style>
    </AntLayout>
  );
}
