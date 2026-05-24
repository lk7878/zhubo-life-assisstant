import { useEffect, useMemo, useState } from 'react';
import {
  Card, Table, Tag, Button, Space, Select, Input, Statistic, Row, Col,
  Popconfirm, message, Drawer, Modal, Form, DatePicker, InputNumber, Switch,
  Upload, Descriptions, Tooltip, Badge,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, DeleteOutlined, EyeOutlined, ExportOutlined,
  EditOutlined, UploadOutlined, DownloadOutlined, StopOutlined, FileSyncOutlined,
  WarningOutlined, FileTextOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { contractsApi, anchorsApi } from '../api';
import {
  type Contract, type Anchor,
  ContractType, CONTRACT_TYPE_LABELS,
  ContractStatus, CONTRACT_STATUS_LABELS, CONTRACT_STATUS_COLORS,
} from '../types';
import { useAuthStore } from '../stores/authStore';

const { TextArea } = Input;

export default function ContractsPage() {
  const canWriteContract = useAuthStore((s) => s.canWrite('contract'));
  const canTerminate = useAuthStore((s) => s.canWrite('contract_terminate'));
  const [items, setItems] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(false);

  const [filterAnchor, setFilterAnchor] = useState<string | undefined>();
  const [filterStatus, setFilterStatus] = useState<string | undefined>();
  const [filterType, setFilterType] = useState<string | undefined>();
  const [search, setSearch] = useState('');
  const [anchorOpts, setAnchorOpts] = useState<{ label: string; value: string }[]>([]);

  // 表单
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Contract | null>(null);
  const [form] = Form.useForm();

  // 详情
  const [detail, setDetail] = useState<Contract | null>(null);

  // 终止
  const [terminateTarget, setTerminateTarget] = useState<Contract | null>(null);
  const [terminateForm] = Form.useForm();

  // 续签
  const [renewTarget, setRenewTarget] = useState<Contract | null>(null);
  const [renewForm] = Form.useForm();

  const fetchAnchors = async (kw?: string) => {
    const list = await anchorsApi.list({ search: kw, limit: 80 });
    setAnchorOpts(list.items.map((a: Anchor) => ({ label: `${a.stage_name}（${a.name}）`, value: a.id })));
  };

  const fetchList = async () => {
    setLoading(true);
    try {
      const data = await contractsApi.list({
        anchor_id: filterAnchor,
        status: filterStatus,
        contract_type: filterType,
        search: search || undefined,
        limit: 200,
      });
      setItems(data.items);
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnchors();
  }, []);

  useEffect(() => {
    fetchList();
  }, [filterAnchor, filterStatus, filterType]);

  const stats = useMemo(() => {
    const active = items.filter(i => i.status === ContractStatus.ACTIVE).length;
    const expiring = items.filter(i => i.status === ContractStatus.EXPIRING_SOON).length;
    const expired = items.filter(i => i.status === ContractStatus.EXPIRED).length;
    const draft = items.filter(i => i.status === ContractStatus.DRAFT).length;
    return { active, expiring, expired, draft };
  }, [items]);

  // ===== 新建 / 编辑 =====
  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      contract_type: ContractType.FORMAL,
      party_a: '重庆君燚无双文化传媒有限公司',
      exclusive: false,
      auto_renew: false,
      base_salary: 3000,
      status: ContractStatus.DRAFT,
    });
    setFormOpen(true);
  };

  const openEdit = (c: Contract) => {
    setEditing(c);
    form.resetFields();
    form.setFieldsValue({
      ...c,
      start_date: c.start_date ? dayjs(c.start_date) : null,
      end_date: c.end_date ? dayjs(c.end_date) : null,
      signed_at: c.signed_at ? dayjs(c.signed_at) : null,
    });
    setFormOpen(true);
  };

  const handleSave = async () => {
    const v = await form.validateFields();
    const payload: any = {
      ...v,
      start_date: v.start_date ? dayjs(v.start_date).format('YYYY-MM-DD') : undefined,
      end_date: v.end_date ? dayjs(v.end_date).format('YYYY-MM-DD') : undefined,
      signed_at: v.signed_at ? dayjs(v.signed_at).format('YYYY-MM-DD') : undefined,
      base_salary: Number(v.base_salary || 0),
    };
    try {
      if (editing) {
        const { anchor_id, ...rest } = payload;
        await contractsApi.update(editing.id, rest);
        message.success('已更新');
      } else {
        await contractsApi.create(payload);
        message.success('已创建');
      }
      setFormOpen(false);
      fetchList();
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  // ===== 终止 =====
  const openTerminate = (c: Contract) => {
    setTerminateTarget(c);
    terminateForm.resetFields();
    terminateForm.setFieldsValue({ terminated_at: dayjs() });
  };
  const handleTerminate = async () => {
    if (!terminateTarget) return;
    const v = await terminateForm.validateFields();
    try {
      await contractsApi.terminate(terminateTarget.id, {
        terminated_at: dayjs(v.terminated_at).format('YYYY-MM-DD'),
        termination_reason: v.termination_reason,
      });
      message.success('已终止');
      setTerminateTarget(null);
      fetchList();
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  // ===== 续签 =====
  const openRenew = (c: Contract) => {
    setRenewTarget(c);
    renewForm.resetFields();
    const start = c.end_date ? dayjs(c.end_date).add(1, 'day') : dayjs();
    renewForm.setFieldsValue({
      new_start_date: start,
      new_end_date: start.add(1, 'year'),
      contract_type: ContractType.RENEWAL,
      base_salary: c.base_salary,
    });
  };
  const handleRenew = async () => {
    if (!renewTarget) return;
    const v = await renewForm.validateFields();
    try {
      await contractsApi.renew(renewTarget.id, {
        new_start_date: dayjs(v.new_start_date).format('YYYY-MM-DD'),
        new_end_date: dayjs(v.new_end_date).format('YYYY-MM-DD'),
        contract_type: v.contract_type,
        contract_no: v.contract_no,
        base_salary: v.base_salary !== undefined ? Number(v.base_salary) : undefined,
        remark: v.remark,
      });
      message.success('已生成续签合同（草稿）');
      setRenewTarget(null);
      fetchList();
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  // ===== 删除 =====
  const handleDelete = async (id: string) => {
    try {
      await contractsApi.delete(id);
      message.success('已删除');
      fetchList();
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  // ===== 附件 =====
  const handleUpload = async (c: Contract, file: File) => {
    try {
      await contractsApi.uploadAttachment(c.id, file);
      message.success('已上传');
      fetchList();
      if (detail && detail.id === c.id) {
        const fresh = await contractsApi.get(c.id);
        setDetail(fresh);
      }
    } catch (e) {
      message.error((e as Error).message);
    }
    return false; // 阻止 antd Upload 自动上传
  };

  const handleDownloadAttachment = async (c: Contract) => {
    try {
      await contractsApi.downloadAttachment(c.id, c.attachment_name || '合同附件');
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  // ===== 导出 =====
  const exportCsv = () => {
    if (items.length === 0) return;
    const rows = items.map(c => ({
      '主播': c.anchor_stage_name || c.anchor_name || '',
      '合同号': c.contract_no || '',
      '类型': CONTRACT_TYPE_LABELS[c.contract_type],
      '甲方': c.party_a || '',
      '乙方': c.party_b || '',
      '开始日期': c.start_date || '',
      '结束日期': c.end_date || '',
      '签订日期': c.signed_at || '',
      '约定底薪': c.base_salary,
      '提成约定': (c.commission_rate || '').replace(/\n/g, ' '),
      '独家': c.exclusive ? '是' : '否',
      '自动续签': c.auto_renew ? '是' : '否',
      '状态': CONTRACT_STATUS_LABELS[c.status],
      '剩余天数': c.days_to_expire ?? '',
      '终止日期': c.terminated_at || '',
      '终止原因': (c.termination_reason || '').replace(/\n/g, ' '),
    }));
    const headers = Object.keys(rows[0]).join(',');
    const body = rows.map(r => Object.values(r).map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + headers + '\n' + body], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `contracts_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    message.success('已导出');
  };

  const columns = [
    {
      title: '主播', key: 'anchor', width: 130, fixed: 'left' as const,
      render: (_: any, c: Contract) => (
        <a onClick={() => setDetail(c)}>{c.anchor_stage_name || c.anchor_name || c.anchor_id.slice(0, 8)}</a>
      ),
    },
    { title: '合同号', dataIndex: 'contract_no', width: 130, render: (v: string) => v || '-' },
    {
      title: '类型', dataIndex: 'contract_type', width: 90,
      render: (v: ContractType) => <Tag>{CONTRACT_TYPE_LABELS[v]}</Tag>,
    },
    {
      title: '期限', key: 'period', width: 200,
      render: (_: any, c: Contract) => `${c.start_date || '-'} ~ ${c.end_date || '-'}`,
    },
    {
      title: '剩余', key: 'days', width: 90,
      render: (_: any, c: Contract) => {
        if (c.days_to_expire == null) return '-';
        if (c.days_to_expire < 0) return <span style={{ color: '#FF3B30' }}>已逾期 {-c.days_to_expire}天</span>;
        if (c.days_to_expire <= 30) return <span style={{ color: '#FF9500', fontWeight: 600 }}>{c.days_to_expire} 天</span>;
        return `${c.days_to_expire} 天`;
      },
    },
    {
      title: '底薪', dataIndex: 'base_salary', width: 80,
      render: (v: number) => `¥${v}`,
    },
    {
      title: '独家', dataIndex: 'exclusive', width: 60,
      render: (v: boolean) => v ? <Badge status="processing" /> : '-',
    },
    {
      title: '状态', dataIndex: 'status', width: 100,
      render: (v: ContractStatus, c: Contract) => (
        <Space size={4}>
          <Tag color={CONTRACT_STATUS_COLORS[v]}>{CONTRACT_STATUS_LABELS[v]}</Tag>
          {c.previous_contract_id && <Tooltip title="续签自上一份合同"><FileSyncOutlined style={{ color: '#1677FF' }} /></Tooltip>}
        </Space>
      ),
    },
    {
      title: '操作', key: 'actions', width: 280, fixed: 'right' as const,
      render: (_: any, c: Contract) => (
        <Space size={4} wrap>
          <Tooltip title="详情"><Button size="small" icon={<EyeOutlined />} onClick={() => setDetail(c)} /></Tooltip>
          {canWriteContract && (
            <Tooltip title="编辑"><Button size="small" icon={<EditOutlined />} onClick={() => openEdit(c)} /></Tooltip>
          )}
          {canWriteContract && (
            <Upload showUploadList={false} beforeUpload={(f) => handleUpload(c, f as any)}>
              <Tooltip title="上传附件"><Button size="small" icon={<UploadOutlined />} /></Tooltip>
            </Upload>
          )}
          {c.attachment_url && (
            <Tooltip title={`下载 ${c.attachment_name}`}>
              <Button size="small" icon={<DownloadOutlined />} onClick={() => handleDownloadAttachment(c)} />
            </Tooltip>
          )}
          {canTerminate && (c.status === ContractStatus.ACTIVE || c.status === ContractStatus.EXPIRING_SOON) && (
            <Tooltip title="终止合同（仅管理员）"><Button size="small" danger icon={<StopOutlined />} onClick={() => openTerminate(c)} /></Tooltip>
          )}
          {canWriteContract && (c.status === ContractStatus.EXPIRING_SOON || c.status === ContractStatus.EXPIRED || c.status === ContractStatus.ACTIVE) && (
            <Tooltip title="续签"><Button size="small" type="primary" icon={<FileSyncOutlined />} onClick={() => openRenew(c)}>续签</Button></Tooltip>
          )}
          {canWriteContract && (
            <Popconfirm title="确定删除该合同？附件也会一并删除，生效中的合同也会被永久删除" onConfirm={() => handleDelete(c.id)}>
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 16 }}>
      <Card
        title={<span><FileTextOutlined /> 合同管理</span>}
        extra={
          <Space wrap>
            <Button icon={<ReloadOutlined />} size="small" onClick={fetchList}>刷新</Button>
            <Button icon={<ExportOutlined />} size="small" onClick={exportCsv} disabled={!items.length}>导出</Button>
            {canWriteContract && (
              <Button type="primary" size="small" icon={<PlusOutlined />} onClick={openCreate}>新建合同</Button>
            )}
          </Space>
        }
      >
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col xs={12} md={6}><Statistic title="生效中" value={stats.active} valueStyle={{ color: '#34C759' }} /></Col>
          <Col xs={12} md={6}>
            <Statistic
              title={<Space size={4}><span>即将到期</span>{stats.expiring > 0 && <WarningOutlined style={{ color: '#FF9500' }} />}</Space>}
              value={stats.expiring}
              valueStyle={{ color: '#FF9500' }}
            />
          </Col>
          <Col xs={12} md={6}><Statistic title="已到期" value={stats.expired} valueStyle={{ color: '#FF3B30' }} /></Col>
          <Col xs={12} md={6}><Statistic title="草稿" value={stats.draft} /></Col>
        </Row>

        <Space wrap style={{ marginBottom: 12 }}>
          <Input.Search
            placeholder="合同号 / 乙方姓名"
            allowClear
            style={{ width: 220 }}
            onSearch={(v) => { setSearch(v); fetchList(); }}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select
            showSearch filterOption={false} placeholder="主播" allowClear
            style={{ width: 200 }} options={anchorOpts}
            onSearch={fetchAnchors}
            value={filterAnchor} onChange={setFilterAnchor}
          />
          <Select placeholder="状态" allowClear style={{ width: 130 }} value={filterStatus} onChange={setFilterStatus}>
            {Object.entries(CONTRACT_STATUS_LABELS).map(([k, v]) => (
              <Select.Option key={k} value={k}>{v}</Select.Option>
            ))}
          </Select>
          <Select placeholder="类型" allowClear style={{ width: 130 }} value={filterType} onChange={setFilterType}>
            {Object.entries(CONTRACT_TYPE_LABELS).map(([k, v]) => (
              <Select.Option key={k} value={k}>{v}</Select.Option>
            ))}
          </Select>
        </Space>

        <Table
          rowKey="id"
          size="small"
          loading={loading}
          dataSource={items}
          columns={columns}
          pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 条` }}
          scroll={{ x: 1400 }}
        />
      </Card>

      {/* 新建 / 编辑 */}
      <Modal
        title={editing ? '编辑合同' : '新建合同'}
        open={formOpen}
        onCancel={() => setFormOpen(false)}
        onOk={handleSave}
        width={760}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          {!editing && (
            <Form.Item name="anchor_id" label="主播" rules={[{ required: true, message: '请选择主播' }]}>
              <Select showSearch filterOption={false} options={anchorOpts} onSearch={fetchAnchors} placeholder="搜索主播" />
            </Form.Item>
          )}
          <Space size={16} wrap>
            <Form.Item name="contract_no" label="合同号">
              <Input placeholder="如 JY-2026-001" style={{ width: 200 }} />
            </Form.Item>
            <Form.Item name="contract_type" label="类型" rules={[{ required: true }]}>
              <Select style={{ width: 150 }}>
                {Object.entries(CONTRACT_TYPE_LABELS).map(([k, v]) => (
                  <Select.Option key={k} value={k}>{v}</Select.Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="status" label="状态">
              <Select style={{ width: 130 }} disabled={!editing}>
                {Object.entries(CONTRACT_STATUS_LABELS).map(([k, v]) => (
                  <Select.Option key={k} value={k}>{v}</Select.Option>
                ))}
              </Select>
            </Form.Item>
          </Space>
          <Space size={16} wrap>
            <Form.Item name="party_a" label="甲方">
              <Input style={{ width: 320 }} />
            </Form.Item>
            <Form.Item name="party_b" label="乙方">
              <Input placeholder="默认主播姓名" style={{ width: 200 }} />
            </Form.Item>
          </Space>
          <Space size={16} wrap>
            <Form.Item name="start_date" label="开始日期">
              <DatePicker style={{ width: 160 }} />
            </Form.Item>
            <Form.Item name="end_date" label="结束日期">
              <DatePicker style={{ width: 160 }} />
            </Form.Item>
            <Form.Item name="signed_at" label="签订日期">
              <DatePicker style={{ width: 160 }} />
            </Form.Item>
          </Space>
          <Space size={16} wrap>
            <Form.Item name="base_salary" label="约定底薪">
              <InputNumber min={0} step={100} style={{ width: 160 }} addonBefore="¥" />
            </Form.Item>
            <Form.Item name="commission_rate" label="提成约定">
              <Input placeholder="如：按公司阶梯执行 / GMV 8%" style={{ width: 280 }} />
            </Form.Item>
          </Space>
          <Space size={16} wrap>
            <Form.Item name="exclusive" label="独家" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="auto_renew" label="自动续签" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Space>
          <Form.Item name="penalty_terms" label="违约金条款">
            <TextArea rows={2} />
          </Form.Item>
          <Form.Item name="non_compete_terms" label="竞业条款">
            <TextArea rows={2} />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 终止 */}
      <Modal
        title={terminateTarget ? `终止合同 · ${terminateTarget.anchor_stage_name}` : ''}
        open={!!terminateTarget}
        onCancel={() => setTerminateTarget(null)}
        onOk={handleTerminate}
        okButtonProps={{ danger: true }}
        okText="确认终止"
        destroyOnHidden
      >
        <Form form={terminateForm} layout="vertical">
          <Form.Item name="terminated_at" label="终止日期" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="termination_reason" label="终止原因">
            <TextArea rows={3} placeholder="例如：协商一致解除 / 违约解除 / 公司原因" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 续签 */}
      <Modal
        title={renewTarget ? `续签合同 · ${renewTarget.anchor_stage_name}` : ''}
        open={!!renewTarget}
        onCancel={() => setRenewTarget(null)}
        onOk={handleRenew}
        okText="生成续签草稿"
        width={620}
        destroyOnHidden
      >
        <div style={{ marginBottom: 12, background: '#FFFBE6', padding: 8, borderRadius: 6, fontSize: 13 }}>
          将基于当前合同复制条款（甲乙方、竞业、独家等），仅期限和底薪可重新填写。生成后状态为「草稿」，编辑确认后再生效。
        </div>
        <Form form={renewForm} layout="vertical">
          <Space size={16} wrap>
            <Form.Item name="new_start_date" label="新开始日期" rules={[{ required: true }]}>
              <DatePicker style={{ width: 180 }} />
            </Form.Item>
            <Form.Item name="new_end_date" label="新结束日期" rules={[{ required: true }]}>
              <DatePicker style={{ width: 180 }} />
            </Form.Item>
          </Space>
          <Space size={16} wrap>
            <Form.Item name="contract_type" label="合同类型">
              <Select style={{ width: 180 }}>
                {Object.entries(CONTRACT_TYPE_LABELS).map(([k, v]) => (
                  <Select.Option key={k} value={k}>{v}</Select.Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="contract_no" label="新合同号">
              <Input placeholder="留空自动派生" style={{ width: 220 }} />
            </Form.Item>
          </Space>
          <Form.Item name="base_salary" label="新底薪">
            <InputNumber min={0} step={100} style={{ width: 200 }} addonBefore="¥" />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 详情 Drawer */}
      <Drawer
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail ? `合同详情 · ${detail.anchor_stage_name || ''}` : ''}
        width={680}
      >
        {detail && (
          <>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="主播">{detail.anchor_stage_name}（{detail.anchor_name}）</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={CONTRACT_STATUS_COLORS[detail.status]}>{CONTRACT_STATUS_LABELS[detail.status]}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="合同号">{detail.contract_no || '-'}</Descriptions.Item>
              <Descriptions.Item label="类型">{CONTRACT_TYPE_LABELS[detail.contract_type]}</Descriptions.Item>
              <Descriptions.Item label="甲方" span={2}>{detail.party_a || '-'}</Descriptions.Item>
              <Descriptions.Item label="乙方" span={2}>{detail.party_b || '-'}</Descriptions.Item>
              <Descriptions.Item label="期限" span={2}>
                {detail.start_date || '-'} ~ {detail.end_date || '-'}
                {detail.days_to_expire != null && (
                  <Tag color={detail.days_to_expire < 0 ? 'red' : detail.days_to_expire <= 30 ? 'orange' : 'green'} style={{ marginLeft: 8 }}>
                    {detail.days_to_expire < 0 ? `已逾期 ${-detail.days_to_expire}天` : `剩余 ${detail.days_to_expire} 天`}
                  </Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="签订日">{detail.signed_at || '-'}</Descriptions.Item>
              <Descriptions.Item label="约定底薪">¥{detail.base_salary}</Descriptions.Item>
              <Descriptions.Item label="提成约定" span={2}>{detail.commission_rate || '-'}</Descriptions.Item>
              <Descriptions.Item label="独家">{detail.exclusive ? '是' : '否'}</Descriptions.Item>
              <Descriptions.Item label="自动续签">{detail.auto_renew ? '是' : '否'}</Descriptions.Item>
              <Descriptions.Item label="违约金" span={2}>{detail.penalty_terms || '-'}</Descriptions.Item>
              <Descriptions.Item label="竞业条款" span={2}>{detail.non_compete_terms || '-'}</Descriptions.Item>
              {detail.terminated_at && (
                <>
                  <Descriptions.Item label="终止日">{detail.terminated_at}</Descriptions.Item>
                  <Descriptions.Item label="终止原因">{detail.termination_reason || '-'}</Descriptions.Item>
                </>
              )}
              {detail.previous_contract_id && (
                <Descriptions.Item label="续签自" span={2}>
                  <code style={{ fontSize: 11 }}>{detail.previous_contract_id}</code>
                </Descriptions.Item>
              )}
              <Descriptions.Item label="附件" span={2}>
                {detail.attachment_url ? (
                  <Space>
                    <Button type="link" icon={<DownloadOutlined />} onClick={() => handleDownloadAttachment(detail)} style={{ padding: 0 }}>
                      {detail.attachment_name}
                    </Button>
                    <Upload showUploadList={false} beforeUpload={(f) => handleUpload(detail, f as any)}>
                      <Button size="small" icon={<UploadOutlined />}>替换</Button>
                    </Upload>
                  </Space>
                ) : (
                  <Upload showUploadList={false} beforeUpload={(f) => handleUpload(detail, f as any)}>
                    <Button size="small" icon={<UploadOutlined />}>上传附件</Button>
                  </Upload>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="备注" span={2}>{detail.remark || '-'}</Descriptions.Item>
            </Descriptions>

            <Space style={{ marginTop: 16 }} wrap>
              <Button icon={<EditOutlined />} onClick={() => { setDetail(null); openEdit(detail); }}>编辑</Button>
              {(detail.status === ContractStatus.ACTIVE || detail.status === ContractStatus.EXPIRING_SOON) && (
                <Button danger icon={<StopOutlined />} onClick={() => { setDetail(null); openTerminate(detail); }}>终止</Button>
              )}
              {(detail.status === ContractStatus.EXPIRING_SOON || detail.status === ContractStatus.EXPIRED || detail.status === ContractStatus.ACTIVE) && (
                <Button type="primary" icon={<FileSyncOutlined />} onClick={() => { setDetail(null); openRenew(detail); }}>续签</Button>
              )}
            </Space>
          </>
        )}
      </Drawer>
    </div>
  );
}
