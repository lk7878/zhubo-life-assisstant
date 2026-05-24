import { useEffect, useMemo, useState } from 'react';
import {
  Card, Tabs, Table, Tag, Button, Space, Select, DatePicker, Statistic, Row, Col,
  Popconfirm, message, Tooltip, InputNumber, Drawer, Descriptions,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, DeleteOutlined, EditOutlined, ExportOutlined,
  DollarCircleOutlined, ProfileOutlined, SettingOutlined, EyeOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { salaryApi, anchorsApi } from '../api';
import {
  type SalaryRecord, type SalaryConfig, type Anchor,
  SalaryStatus, SALARY_STATUS_LABELS, SALARY_STATUS_COLORS,
  SalaryPeriodType, SALARY_PERIOD_TYPE_LABELS,
  PaymentMethod, PAYMENT_METHOD_LABELS,
} from '../types';
import SalaryConfigModal from '../components/SalaryConfigModal';
import SalaryGenerateModal from '../components/SalaryGenerateModal';
import SalaryPayModal from '../components/SalaryPayModal';
import { useAuthStore } from '../stores/authStore';

export default function SalariesPage() {
  const canWriteSalary = useAuthStore((s) => s.canWrite('salary'));
  const [tab, setTab] = useState<'records' | 'configs'>('records');

  // ===== 结算单 =====
  const [records, setRecords] = useState<SalaryRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [filterAnchor, setFilterAnchor] = useState<string | undefined>();
  const [filterStatus, setFilterStatus] = useState<string | undefined>();
  const [filterMonth, setFilterMonth] = useState<dayjs.Dayjs | null>(dayjs());
  const [anchorOpts, setAnchorOpts] = useState<{ label: string; value: string }[]>([]);

  const [generateOpen, setGenerateOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<SalaryRecord | null>(null);
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [adjustBonus, setAdjustBonus] = useState<number>(0);
  const [adjustDeduction, setAdjustDeduction] = useState<number>(0);
  const [detailRecord, setDetailRecord] = useState<SalaryRecord | null>(null);

  // ===== 配置 =====
  const [defaultCfg, setDefaultCfg] = useState<SalaryConfig | null>(null);
  const [anchorCfgs, setAnchorCfgs] = useState<SalaryConfig[]>([]);
  const [cfgLoading, setCfgLoading] = useState(false);
  const [cfgModalOpen, setCfgModalOpen] = useState(false);
  const [cfgEditingAnchorId, setCfgEditingAnchorId] = useState<string | null | undefined>(undefined); // undefined=未打开, null=默认, string=主播
  const [cfgEditingAnchorLabel, setCfgEditingAnchorLabel] = useState<string>('');
  const [cfgEditingInitial, setCfgEditingInitial] = useState<SalaryConfig | null>(null);
  const [pickAnchorId, setPickAnchorId] = useState<string | null>(null);

  const fetchAnchors = async (kw?: string) => {
    const list = await anchorsApi.list({ search: kw, limit: 100 });
    setAnchorOpts(list.items.map((a: Anchor) => ({ label: `${a.stage_name}（${a.name}）`, value: a.id })));
  };

  const fetchRecords = async () => {
    setRecordsLoading(true);
    try {
      const data = await salaryApi.listRecords({
        anchor_id: filterAnchor,
        status: filterStatus,
        month: filterMonth ? filterMonth.format('YYYY-MM') : undefined,
        limit: 200,
      });
      setRecords(data.items);
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setRecordsLoading(false);
    }
  };

  const fetchConfigs = async () => {
    setCfgLoading(true);
    try {
      const [d, list] = await Promise.all([
        salaryApi.getDefaultConfig(),
        salaryApi.listConfigs(),
      ]);
      setDefaultCfg(d);
      setAnchorCfgs(list.items.filter(c => c.anchor_id));
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setCfgLoading(false);
    }
  };

  useEffect(() => {
    fetchAnchors();
  }, []);

  useEffect(() => {
    if (tab === 'records') fetchRecords();
    else fetchConfigs();
  }, [tab, filterAnchor, filterStatus, filterMonth]);

  // ===== 顶部统计 =====
  const stats = useMemo(() => {
    const monthRecords = records;
    const total = monthRecords.reduce((s, r) => s + r.total_payable, 0);
    const paid = monthRecords.filter(r => r.status === SalaryStatus.PAID)
      .reduce((s, r) => s + r.total_payable, 0);
    const pending = monthRecords.filter(r => r.status === SalaryStatus.DRAFT)
      .reduce((s, r) => s + r.total_payable, 0);
    return {
      count: monthRecords.length,
      paid: Math.round(paid * 100) / 100,
      pending: Math.round(pending * 100) / 100,
      total: Math.round(total * 100) / 100,
    };
  }, [records]);

  // ===== Records actions =====
  const handleAdjustSave = async (id: string) => {
    try {
      await salaryApi.updateRecord(id, { bonus: adjustBonus, deduction: adjustDeduction });
      message.success('已更新');
      setAdjustingId(null);
      fetchRecords();
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const handleDeleteRecord = async (id: string) => {
    try {
      await salaryApi.deleteRecord(id);
      message.success('已删除');
      fetchRecords();
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const exportRecords = () => {
    if (records.length === 0) return;
    const rows = records.map(r => ({
      '主播': r.anchor_stage_name || r.anchor_name || '',
      '周期类型': SALARY_PERIOD_TYPE_LABELS[r.period_type],
      '期间': `${r.period_start} ~ ${r.period_end}`,
      '场次': r.session_count,
      'GMV': r.total_gmv,
      '底薪': r.base_salary,
      '提成': r.commission,
      '加项': r.bonus,
      '减项': r.deduction,
      '应发': r.total_payable,
      '状态': SALARY_STATUS_LABELS[r.status],
      '发放方式': r.payment_method ? PAYMENT_METHOD_LABELS[r.payment_method] : '',
      '发放时间': r.paid_at ? new Date(r.paid_at).toLocaleString('zh-CN') : '',
      '凭证': r.voucher || '',
      '备注': r.remark || '',
    }));
    const headers = Object.keys(rows[0]).join(',');
    const body = rows.map(r => Object.values(r).map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + headers + '\n' + body], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `salary_${filterMonth ? filterMonth.format('YYYY-MM') : 'all'}_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    message.success('已导出');
  };

  // ===== Records columns =====
  const recordColumns = [
    {
      title: '主播', key: 'anchor', width: 120,
      render: (_: any, r: SalaryRecord) => r.anchor_stage_name || r.anchor_name || r.anchor_id.slice(0, 8),
    },
    {
      title: '周期', dataIndex: 'period_type', width: 65,
      render: (v: SalaryPeriodType) => SALARY_PERIOD_TYPE_LABELS[v],
    },
    {
      title: '期间', key: 'period', width: 200,
      render: (_: any, r: SalaryRecord) => `${r.period_start} ~ ${r.period_end}`,
    },
    {
      title: '场次', dataIndex: 'session_count', width: 60,
    },
    {
      title: 'GMV', dataIndex: 'total_gmv', width: 100,
      render: (v: number) => `¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    },
    {
      title: '底薪', dataIndex: 'base_salary', width: 80,
      render: (v: number) => `¥${v}`,
    },
    {
      title: '提成', dataIndex: 'commission', width: 90,
      render: (v: number) => <span style={{ color: '#34C759' }}>¥{v}</span>,
    },
    {
      title: '加/减', key: 'adjust', width: 180,
      render: (_: any, r: SalaryRecord) => {
        if (adjustingId === r.id) {
          return (
            <Space size={4}>
              <InputNumber size="small" min={0} value={adjustBonus} onChange={(v) => setAdjustBonus(Number(v || 0))} style={{ width: 70 }} placeholder="加" />
              <InputNumber size="small" min={0} value={adjustDeduction} onChange={(v) => setAdjustDeduction(Number(v || 0))} style={{ width: 70 }} placeholder="减" />
              <Button size="small" type="primary" onClick={() => handleAdjustSave(r.id)}>保存</Button>
              <Button size="small" onClick={() => setAdjustingId(null)}>取消</Button>
            </Space>
          );
        }
        return (
          <Space size={4}>
            <span>+{r.bonus} / -{r.deduction}</span>
            {canWriteSalary && r.status === SalaryStatus.DRAFT && (
              <Tooltip title="调整加减项">
                <Button size="small" icon={<EditOutlined />} onClick={() => {
                  setAdjustingId(r.id); setAdjustBonus(r.bonus); setAdjustDeduction(r.deduction);
                }} />
              </Tooltip>
            )}
          </Space>
        );
      },
    },
    {
      title: '应发', dataIndex: 'total_payable', width: 110, fixed: 'right' as const,
      render: (v: number) => <strong style={{ color: '#1D1D1F' }}>¥{v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>,
    },
    {
      title: '状态', dataIndex: 'status', width: 80, fixed: 'right' as const,
      render: (v: SalaryStatus) => <Tag color={SALARY_STATUS_COLORS[v]}>{SALARY_STATUS_LABELS[v]}</Tag>,
    },
    {
      title: '操作', key: 'actions', width: 200, fixed: 'right' as const,
      render: (_: any, r: SalaryRecord) => (
        <Space size={4}>
          <Button size="small" icon={<EyeOutlined />} onClick={() => setDetailRecord(r)} />
          {canWriteSalary && r.status === SalaryStatus.DRAFT && (
            <>
              <Button size="small" type="primary" icon={<DollarCircleOutlined />} onClick={() => { setPayTarget(r); setPayOpen(true); }}>
                发放
              </Button>
              <Popconfirm title="确定删除该结算单？" onConfirm={() => handleDeleteRecord(r.id)}>
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];

  // ===== Config columns =====
  const cfgColumns = [
    { title: '主播', key: 'anchor', render: (_: any, c: SalaryConfig) => c.anchor_stage_name || c.anchor_name || c.anchor_id || '默认' },
    { title: '月底薪', dataIndex: 'base_salary', width: 100, render: (v: number) => `¥${v}` },
    { title: '日基数', dataIndex: 'daily_base', width: 100, render: (v: number) => `¥${v}` },
    {
      title: '阶梯', key: 'tiers', render: (_: any, c: SalaryConfig) => (
        <Space size={4} wrap>
          {c.commission_tiers.map((t, i) => (
            <Tag key={i}>{t.min}~{t.max ?? '∞'} : {t.rate}%</Tag>
          ))}
        </Space>
      ),
    },
    { title: '生效日期', dataIndex: 'effective_from', width: 110, render: (v: string | null) => v || '-' },
    {
      title: '操作', key: 'actions', width: 160,
      render: (_: any, c: SalaryConfig) => (
        <Space size={4}>
          {canWriteSalary && (
            <Button size="small" icon={<EditOutlined />} onClick={() => {
              setCfgEditingAnchorId(c.anchor_id);
              setCfgEditingAnchorLabel(c.anchor_stage_name || c.anchor_name || '');
              setCfgEditingInitial(c);
              setCfgModalOpen(true);
            }}>编辑</Button>
          )}
          {canWriteSalary && (
            <Popconfirm
              title="删除该主播专属配置？删除后将继承默认配置"
              onConfirm={async () => {
                if (!c.anchor_id) return;
                await salaryApi.deleteAnchorConfig(c.anchor_id);
                message.success('已删除');
                fetchConfigs();
              }}
            >
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
        title="薪资结算"
        extra={
          tab === 'records' ? (
            <Space wrap>
              <Button icon={<ReloadOutlined />} size="small" onClick={fetchRecords}>刷新</Button>
              <Button icon={<ExportOutlined />} size="small" onClick={exportRecords} disabled={!records.length}>导出</Button>
              {canWriteSalary && (
                <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => setGenerateOpen(true)}>生成结算单</Button>
              )}
            </Space>
          ) : (
            <Space wrap>
              <Button icon={<ReloadOutlined />} size="small" onClick={fetchConfigs}>刷新</Button>
              {canWriteSalary && (
                <Select
                  showSearch filterOption={false} placeholder="为指定主播添加配置"
                  style={{ width: 220 }} options={anchorOpts} onSearch={fetchAnchors}
                  value={pickAnchorId || undefined}
                  onChange={(v) => {
                    setPickAnchorId(v);
                    const a = anchorOpts.find(o => o.value === v);
                    setCfgEditingAnchorId(v); setCfgEditingAnchorLabel(a?.label || '');
                    setCfgEditingInitial(null);
                    setCfgModalOpen(true);
                  }}
                />
              )}
            </Space>
          )
        }
      >
        <Tabs
          activeKey={tab}
          onChange={(k) => setTab(k as any)}
          items={[
            { key: 'records', label: <span><ProfileOutlined /> 结算单</span> },
            { key: 'configs', label: <span><SettingOutlined /> 薪资配置</span> },
          ]}
        />

        {tab === 'records' && (
          <>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col xs={12} md={6}><Statistic title="本期结算单" value={stats.count} /></Col>
              <Col xs={12} md={6}><Statistic title="应发合计" value={stats.total} prefix="¥" /></Col>
              <Col xs={12} md={6}><Statistic title="已发放" value={stats.paid} prefix="¥" valueStyle={{ color: '#34C759' }} /></Col>
              <Col xs={12} md={6}><Statistic title="待发放" value={stats.pending} prefix="¥" valueStyle={{ color: '#FF9500' }} /></Col>
            </Row>

            <Space wrap style={{ marginBottom: 12 }}>
              <DatePicker picker="month" value={filterMonth} onChange={setFilterMonth} placeholder="月份" allowClear />
              <Select
                showSearch filterOption={false} placeholder="主播筛选" allowClear
                style={{ width: 200 }} options={anchorOpts}
                onSearch={fetchAnchors}
                value={filterAnchor} onChange={setFilterAnchor}
              />
              <Select placeholder="状态" allowClear style={{ width: 120 }} value={filterStatus} onChange={setFilterStatus}>
                {Object.entries(SALARY_STATUS_LABELS).map(([k, v]) => (
                  <Select.Option key={k} value={k}>{v}</Select.Option>
                ))}
              </Select>
            </Space>

            <Table
              rowKey="id"
              size="small"
              loading={recordsLoading}
              dataSource={records}
              columns={recordColumns}
              pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 条` }}
              scroll={{ x: 1300 }}
            />
          </>
        )}

        {tab === 'configs' && (
          <>
            {defaultCfg && (
              <Card
                size="small"
                style={{ marginBottom: 16, background: '#FAFAFA' }}
                title={<span><Tag color="gold">默认</Tag> 全公司默认薪资配置</span>}
                extra={
                  canWriteSalary ? (
                    <Button size="small" icon={<EditOutlined />} onClick={() => {
                      setCfgEditingAnchorId(null); setCfgEditingAnchorLabel('默认配置');
                      setCfgEditingInitial(defaultCfg);
                      setCfgModalOpen(true);
                    }}>编辑</Button>
                  ) : <Tag>只读</Tag>
                }
              >
                <Descriptions size="small" column={3}>
                  <Descriptions.Item label="月底薪">¥{defaultCfg.base_salary}</Descriptions.Item>
                  <Descriptions.Item label="日基数">¥{defaultCfg.daily_base}</Descriptions.Item>
                  <Descriptions.Item label="生效">{defaultCfg.effective_from || '-'}</Descriptions.Item>
                  <Descriptions.Item label="阶梯" span={3}>
                    <Space size={4} wrap>
                      {defaultCfg.commission_tiers.map((t, i) => (
                        <Tag key={i}>{t.min} ~ {t.max ?? '∞'} : {t.rate}%</Tag>
                      ))}
                    </Space>
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            )}

            <Table
              rowKey="id"
              size="small"
              loading={cfgLoading}
              dataSource={anchorCfgs}
              columns={cfgColumns}
              pagination={false}
              locale={{ emptyText: '暂无主播专属配置（所有主播均使用默认配置）' }}
            />
          </>
        )}
      </Card>

      <SalaryConfigModal
        open={cfgModalOpen}
        anchorId={cfgEditingAnchorId === null ? null : cfgEditingAnchorId || null}
        anchorLabel={cfgEditingAnchorLabel}
        initial={cfgEditingInitial}
        onClose={() => { setCfgModalOpen(false); setPickAnchorId(null); }}
        onSuccess={() => { setCfgModalOpen(false); setPickAnchorId(null); fetchConfigs(); }}
      />

      <SalaryGenerateModal
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        onSuccess={() => { setGenerateOpen(false); fetchRecords(); }}
      />

      <SalaryPayModal
        open={payOpen}
        record={payTarget}
        onClose={() => { setPayOpen(false); setPayTarget(null); }}
        onSuccess={() => { setPayOpen(false); setPayTarget(null); fetchRecords(); }}
      />

      <Drawer
        open={!!detailRecord}
        onClose={() => setDetailRecord(null)}
        title={detailRecord ? `结算单详情 · ${detailRecord.anchor_stage_name}` : '结算单详情'}
        width={520}
      >
        {detailRecord && (
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="主播">{detailRecord.anchor_stage_name}（{detailRecord.anchor_name}）</Descriptions.Item>
            <Descriptions.Item label="周期">{SALARY_PERIOD_TYPE_LABELS[detailRecord.period_type]}</Descriptions.Item>
            <Descriptions.Item label="期间">{detailRecord.period_start} ~ {detailRecord.period_end}</Descriptions.Item>
            <Descriptions.Item label="场次">{detailRecord.session_count}</Descriptions.Item>
            <Descriptions.Item label="GMV">¥{detailRecord.total_gmv}</Descriptions.Item>
            <Descriptions.Item label="底薪">¥{detailRecord.base_salary}</Descriptions.Item>
            <Descriptions.Item label="提成">¥{detailRecord.commission}</Descriptions.Item>
            <Descriptions.Item label="加项">¥{detailRecord.bonus}</Descriptions.Item>
            <Descriptions.Item label="减项">¥{detailRecord.deduction}</Descriptions.Item>
            <Descriptions.Item label="应发">
              <strong style={{ color: '#34C759', fontSize: 18 }}>¥{detailRecord.total_payable}</strong>
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={SALARY_STATUS_COLORS[detailRecord.status]}>{SALARY_STATUS_LABELS[detailRecord.status]}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="发放方式">{detailRecord.payment_method ? PAYMENT_METHOD_LABELS[detailRecord.payment_method as PaymentMethod] : '-'}</Descriptions.Item>
            <Descriptions.Item label="发放时间">{detailRecord.paid_at ? new Date(detailRecord.paid_at).toLocaleString('zh-CN') : '-'}</Descriptions.Item>
            <Descriptions.Item label="凭证">{detailRecord.voucher || '-'}</Descriptions.Item>
            <Descriptions.Item label="备注">{detailRecord.remark || '-'}</Descriptions.Item>
            <Descriptions.Item label="阶梯快照">
              <pre style={{ fontSize: 11, background: '#FAFAFA', padding: 6, margin: 0 }}>
                {detailRecord.formula_snapshot || '-'}
              </pre>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </div>
  );
}
