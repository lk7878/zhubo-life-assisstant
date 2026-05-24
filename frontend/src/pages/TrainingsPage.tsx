import { useEffect, useMemo, useState } from 'react';
import {
  Card, Table, Tag, Button, Space, Input, Select, Statistic, Row, Col,
  Popconfirm, message, Switch,
} from 'antd';
import { PlusOutlined, ReloadOutlined, DeleteOutlined, EditOutlined, ExportOutlined } from '@ant-design/icons';
import { trainingsApi } from '../api';
import {
  type Training,
  TRAINING_TYPE_LABELS, TRAINING_TYPE_COLORS,
  TRAINING_MODE_LABELS,
  TRAINING_STATUS_LABELS, TRAINING_STATUS_COLORS,
  TrainingType, TrainingStatus,
} from '../types';
import TrainingFormModal from '../components/TrainingFormModal';
import TrainingDetailDrawer from '../components/TrainingDetailDrawer';

const { Search } = Input;

export default function TrainingsPage() {
  const [items, setItems] = useState<Training[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const [keyword, setKeyword] = useState<string>('');
  const [trainingType, setTrainingType] = useState<string | undefined>();
  const [status, setStatus] = useState<string | undefined>();
  const [complianceOnly, setComplianceOnly] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Training | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const fetchList = async () => {
    setLoading(true);
    try {
      const data = await trainingsApi.list({
        keyword: keyword || undefined,
        training_type: trainingType,
        status,
        is_compliance: complianceOnly ? 1 : undefined,
        limit: 200,
      });
      setItems(data.items);
      setTotal(data.total);
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, [trainingType, status, complianceOnly]);

  const stats = useMemo(() => {
    const totalCount = items.length;
    const completed = items.filter(i => i.status === TrainingStatus.COMPLETED).length;
    const compliance = items.filter(i => i.is_compliance).length;
    const totalAttendances = items.reduce((s, i) => s + (i.attendance_count || 0), 0);
    const avgAttendance = totalCount ? Math.round(totalAttendances / totalCount) : 0;
    return { totalCount, completed, compliance, avgAttendance };
  }, [items]);

  const handleDelete = async (id: string) => {
    try {
      await trainingsApi.delete(id);
      message.success('已删除');
      fetchList();
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const handleExport = () => {
    if (items.length === 0) return;
    const rows = items.map(t => ({
      '主题': t.title,
      '类型': TRAINING_TYPE_LABELS[t.training_type],
      '合规': t.is_compliance ? '是' : '否',
      '模式': TRAINING_MODE_LABELS[t.mode],
      '状态': TRAINING_STATUS_LABELS[t.status],
      '培训师': t.trainer || '',
      '开始时间': new Date(t.start_time).toLocaleString('zh-CN'),
      '结束时间': t.end_time ? new Date(t.end_time).toLocaleString('zh-CN') : '',
      '时长(分钟)': t.duration_minutes ?? '',
      '地点': t.location || '',
      '参训人数': t.attendance_count,
      '已签到': t.checked_in_count,
      '备注': t.remark || '',
    }));
    const headers = Object.keys(rows[0]).join(',');
    const body = rows.map(r => Object.values(r).map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + headers + '\n' + body], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `trainings_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    message.success('已导出培训计划');
  };

  const columns = [
    {
      title: '主题',
      dataIndex: 'title',
      ellipsis: true,
      render: (t: string, r: Training) => (
        <a onClick={() => { setActiveId(r.id); setDrawerOpen(true); }}>{t}</a>
      ),
    },
    {
      title: '类型',
      dataIndex: 'training_type',
      width: 110,
      render: (v: TrainingType, r: Training) => (
        <Space size={4}>
          <Tag color={TRAINING_TYPE_COLORS[v]}>{TRAINING_TYPE_LABELS[v]}</Tag>
          {r.is_compliance ? <Tag color="red">合规</Tag> : null}
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (v: TrainingStatus) => <Tag color={TRAINING_STATUS_COLORS[v]}>{TRAINING_STATUS_LABELS[v]}</Tag>,
    },
    {
      title: '模式',
      dataIndex: 'mode',
      width: 70,
      render: (v: keyof typeof TRAINING_MODE_LABELS) => TRAINING_MODE_LABELS[v],
    },
    {
      title: '培训师',
      dataIndex: 'trainer',
      width: 90,
      render: (v: string | null) => v || '-',
    },
    {
      title: '开始时间',
      dataIndex: 'start_time',
      width: 150,
      render: (v: string) => new Date(v).toLocaleString('zh-CN', { hour12: false }),
    },
    {
      title: '时长',
      dataIndex: 'duration_minutes',
      width: 70,
      render: (v: number | null) => v ? `${v}分钟` : '-',
    },
    {
      title: '参训',
      key: 'attendance',
      width: 100,
      render: (_: any, r: Training) => (
        <span>
          <strong>{r.checked_in_count}</strong>
          <span style={{ color: '#86868B' }}> / {r.attendance_count}</span>
        </span>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      render: (_: any, r: Training) => (
        <Space size={4}>
          <Button size="small" icon={<EditOutlined />} onClick={() => { setEditing(r); setFormOpen(true); }} />
          <Popconfirm title="确定删除该培训？" onConfirm={() => handleDelete(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 16 }}>
      <Card
        title="培训管理"
        extra={
          <Space wrap>
            <Button icon={<ReloadOutlined />} size="small" onClick={fetchList}>刷新</Button>
            <Button icon={<ExportOutlined />} size="small" onClick={handleExport} disabled={!items.length}>导出</Button>
            <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => { setEditing(null); setFormOpen(true); }}>
              新增培训
            </Button>
          </Space>
        }
      >
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col xs={12} md={6}><Statistic title="培训场次" value={stats.totalCount} /></Col>
          <Col xs={12} md={6}><Statistic title="已完成" value={stats.completed} /></Col>
          <Col xs={12} md={6}><Statistic title="合规培训" value={stats.compliance} /></Col>
          <Col xs={12} md={6}><Statistic title="场均参训" value={stats.avgAttendance} suffix="人" /></Col>
        </Row>

        <Space wrap style={{ marginBottom: 12 }}>
          <Search
            placeholder="搜索主题/培训师/地点"
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            onSearch={fetchList}
            style={{ width: 240 }}
            allowClear
          />
          <Select
            allowClear
            placeholder="类型"
            value={trainingType}
            onChange={setTrainingType}
            style={{ width: 130 }}
          >
            {Object.entries(TRAINING_TYPE_LABELS).map(([k, v]) => (
              <Select.Option key={k} value={k}>{v}</Select.Option>
            ))}
          </Select>
          <Select
            allowClear
            placeholder="状态"
            value={status}
            onChange={setStatus}
            style={{ width: 110 }}
          >
            {Object.entries(TRAINING_STATUS_LABELS).map(([k, v]) => (
              <Select.Option key={k} value={k}>{v}</Select.Option>
            ))}
          </Select>
          <Space size={4}>
            <span style={{ color: '#86868B' }}>仅看合规</span>
            <Switch checked={complianceOnly} onChange={setComplianceOnly} />
          </Space>
        </Space>

        <Table
          rowKey="id"
          loading={loading}
          dataSource={items}
          columns={columns}
          size="small"
          pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 条` }}
          scroll={{ x: 1000 }}
        />
        <div style={{ textAlign: 'right', color: '#86868B', fontSize: 12, marginTop: 8 }}>
          后端共 {total} 条记录（最多展示 200 条）
        </div>
      </Card>

      <TrainingFormModal
        open={formOpen}
        editing={editing}
        onClose={() => setFormOpen(false)}
        onSuccess={() => {
          setFormOpen(false);
          fetchList();
        }}
      />

      <TrainingDetailDrawer
        open={drawerOpen}
        trainingId={activeId}
        onClose={() => setDrawerOpen(false)}
        onChanged={fetchList}
      />
    </div>
  );
}
