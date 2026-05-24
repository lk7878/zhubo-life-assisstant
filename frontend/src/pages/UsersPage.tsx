import { useEffect, useState } from 'react';
import {
  Table, Button, Card, Tag, Space, Modal, Form, Input, Select, Switch,
  message, Popconfirm, Typography, Row, Col, Statistic, Input as AntInput,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, KeyOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { usersApi } from '../api';
import type { User, UserRole } from '../types';
import { USER_ROLE_LABEL, USER_ROLE_COLOR } from '../types';
import { useAuthStore } from '../stores/authStore';

const { Title, Text } = Typography;

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'admin', label: '管理员' },
  { value: 'operator', label: '运营' },
  { value: 'finance', label: '财务' },
];

export default function UsersPage() {
  const me = useAuthStore((s) => s.user);
  const [items, setItems] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filterRole, setFilterRole] = useState<UserRole | undefined>();
  const [filterActive, setFilterActive] = useState<boolean | undefined>();
  const [search, setSearch] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form] = Form.useForm();

  const [pwdOpen, setPwdOpen] = useState(false);
  const [pwdTarget, setPwdTarget] = useState<User | null>(null);
  const [pwdForm] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const res = await usersApi.list({
        role: filterRole,
        is_active: filterActive,
        search: search || undefined,
        limit: 200,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filterRole, filterActive]);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ role: 'operator', is_active: true });
    setFormOpen(true);
  };

  const openEdit = (u: User) => {
    setEditing(u);
    form.resetFields();
    form.setFieldsValue({
      username: u.username,
      real_name: u.real_name,
      role: u.role,
      is_active: u.is_active,
      remark: u.remark,
    });
    setFormOpen(true);
  };

  const onSubmitForm = async () => {
    try {
      const values = await form.validateFields();
      if (editing) {
        await usersApi.update(editing.id, {
          real_name: values.real_name,
          role: values.role,
          is_active: values.is_active,
          remark: values.remark,
        });
        message.success('已更新');
      } else {
        await usersApi.create({
          username: values.username,
          password: values.password,
          real_name: values.real_name,
          role: values.role,
          is_active: values.is_active,
          remark: values.remark,
        });
        message.success('已创建');
      }
      setFormOpen(false);
      load();
    } catch (e) {
      if ((e as { errorFields?: unknown }).errorFields) return;
      message.error((e as Error).message);
    }
  };

  const onResetPwd = async () => {
    if (!pwdTarget) return;
    try {
      const v = await pwdForm.validateFields();
      await usersApi.resetPassword(pwdTarget.id, v.new_password);
      message.success(`已重置 ${pwdTarget.username} 的密码`);
      setPwdOpen(false);
    } catch (e) {
      if ((e as { errorFields?: unknown }).errorFields) return;
      message.error((e as Error).message);
    }
  };

  const onDelete = async (u: User) => {
    try {
      await usersApi.delete(u.id);
      message.success(`已删除 ${u.username}`);
      load();
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const onToggleActive = async (u: User) => {
    try {
      await usersApi.update(u.id, { is_active: !u.is_active });
      message.success(u.is_active ? '已停用' : '已启用');
      load();
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const onResetBusinessData = async () => {
    setLoading(true);
    try {
      const res = await usersApi.resetBusinessData();
      const count = Object.values(res.deleted).reduce((sum, n) => sum + n, 0);
      message.success(`已清空业务数据，共删除 ${count} 条记录`);
      load();
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const stats = {
    total,
    admins: items.filter((u) => u.role === 'admin').length,
    operators: items.filter((u) => u.role === 'operator').length,
    finance: items.filter((u) => u.role === 'finance').length,
  };

  const columns = [
    {
      title: '账号',
      dataIndex: 'username',
      width: 140,
      render: (v: string, r: User) => (
        <Space direction="vertical" size={0}>
          <Text strong>{v}</Text>
          {r.real_name && <Text type="secondary" style={{ fontSize: 12 }}>{r.real_name}</Text>}
        </Space>
      ),
    },
    {
      title: '角色',
      dataIndex: 'role',
      width: 100,
      render: (r: UserRole) => <Tag color={USER_ROLE_COLOR[r]}>{USER_ROLE_LABEL[r]}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      width: 100,
      render: (v: boolean, r: User) => (
        <Switch
          checked={v}
          checkedChildren="启用"
          unCheckedChildren="停用"
          onChange={() => onToggleActive(r)}
          disabled={r.id === me?.id}
        />
      ),
    },
    {
      title: '最近登录',
      dataIndex: 'last_login_at',
      width: 200,
      render: (v: string | null, r: User) => v ? (
        <Space direction="vertical" size={0}>
          <Text style={{ fontSize: 12 }}>{dayjs(v).format('YYYY-MM-DD HH:mm:ss')}</Text>
          {r.last_login_ip && <Text type="secondary" style={{ fontSize: 11 }}>IP: {r.last_login_ip}</Text>}
        </Space>
      ) : <Text type="secondary">从未登录</Text>,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 160,
      render: (v: string) => <Text style={{ fontSize: 12 }}>{dayjs(v).format('YYYY-MM-DD HH:mm')}</Text>,
    },
    {
      title: '备注',
      dataIndex: 'remark',
      ellipsis: true,
      render: (v?: string | null) => v || <Text type="secondary">-</Text>,
    },
    {
      title: '操作',
      key: 'action',
      width: 220,
      fixed: 'right' as const,
      render: (_: unknown, r: User) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>编辑</Button>
          <Button size="small" icon={<KeyOutlined />} onClick={() => { setPwdTarget(r); pwdForm.resetFields(); setPwdOpen(true); }}>重置密码</Button>
          {r.id !== me?.id && (
            <Popconfirm title={`确认删除用户 ${r.username}？`} onConfirm={() => onDelete(r)}>
              <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>用户与权限</Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>
          <Popconfirm
            title="确定清空所有业务数据？"
            description="将清空主播、薪资、合同、直播、培训、资产、材料库文件和操作日志，仅保留系统账号。"
            okText="清空"
            cancelText="取消"
            okButtonProps={{ danger: true }}
            onConfirm={onResetBusinessData}
          >
            <Button danger icon={<DeleteOutlined />}>一键清空数据</Button>
          </Popconfirm>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建用户</Button>
        </Space>
      </div>

      <Row gutter={12} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}><Card><Statistic title="账号总数" value={stats.total} /></Card></Col>
        <Col xs={12} sm={6}><Card><Statistic title="管理员" value={stats.admins} valueStyle={{ color: '#FF3B30' }} /></Card></Col>
        <Col xs={12} sm={6}><Card><Statistic title="运营" value={stats.operators} valueStyle={{ color: '#007AFF' }} /></Card></Col>
        <Col xs={12} sm={6}><Card><Statistic title="财务" value={stats.finance} valueStyle={{ color: '#FF9500' }} /></Card></Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <AntInput.Search
            placeholder="账号 / 姓名"
            allowClear
            style={{ width: 220 }}
            onSearch={(v) => { setSearch(v); load(); }}
            prefix={<SearchOutlined />}
          />
          <Select
            placeholder="角色"
            allowClear
            value={filterRole}
            onChange={(v) => setFilterRole(v)}
            options={ROLE_OPTIONS}
            style={{ width: 140 }}
          />
          <Select
            placeholder="状态"
            allowClear
            value={filterActive}
            onChange={(v) => setFilterActive(v)}
            options={[{ value: true, label: '启用' }, { value: false, label: '停用' }]}
            style={{ width: 120 }}
          />
        </Space>
      </Card>

      <Table
        rowKey="id"
        loading={loading}
        dataSource={items}
        columns={columns}
        pagination={false}
        scroll={{ x: 1100 }}
      />

      <Modal
        open={formOpen}
        title={editing ? `编辑用户：${editing.username}` : '新建用户'}
        onCancel={() => setFormOpen(false)}
        onOk={onSubmitForm}
        okText={editing ? '保存' : '创建'}
        destroyOnClose
        width={520}
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item
            label="账号 (登录用户名)"
            name="username"
            rules={[
              { required: true, message: '请输入用户名' },
              { pattern: /^[a-zA-Z0-9_]{3,32}$/, message: '3-32 位英文/数字/下划线' },
            ]}
          >
            <Input placeholder="例如 zhang_san" disabled={!!editing} />
          </Form.Item>
          {!editing && (
            <Form.Item
              label="初始密码"
              name="password"
              rules={[
                { required: true, message: '请输入密码' },
                { min: 6, message: '至少 6 位' },
              ]}
            >
              <Input.Password placeholder="至少 6 位" />
            </Form.Item>
          )}
          <Form.Item label="真实姓名" name="real_name">
            <Input placeholder="例如 张三" />
          </Form.Item>
          <Form.Item label="角色" name="role" rules={[{ required: true }]}>
            <Select options={ROLE_OPTIONS} />
          </Form.Item>
          <Form.Item label="启用" name="is_active" valuePropName="checked" initialValue>
            <Switch checkedChildren="启用" unCheckedChildren="停用" />
          </Form.Item>
          <Form.Item label="备注" name="remark">
            <Input.TextArea rows={2} placeholder="可选" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={pwdOpen}
        title={pwdTarget ? `重置 ${pwdTarget.username} 的密码` : '重置密码'}
        onCancel={() => setPwdOpen(false)}
        onOk={onResetPwd}
        okText="重置"
        destroyOnClose
        width={420}
      >
        <Form form={pwdForm} layout="vertical" preserve={false}>
          <Form.Item
            label="新密码"
            name="new_password"
            rules={[{ required: true, message: '请输入新密码' }, { min: 6, message: '至少 6 位' }]}
          >
            <Input.Password placeholder="至少 6 位" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
