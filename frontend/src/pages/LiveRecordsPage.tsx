import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Col, DatePicker, Empty, Form, Input, InputNumber, message, Modal, Popconfirm, Row, Select, Space, Spin, Table, Tag } from 'antd';
import type { Dayjs } from 'dayjs';
import { DeleteOutlined, EditOutlined, ExportOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { anchorsApi, liveRecordsApi } from '../api';
import type { Anchor, LiveRecord } from '../types';

const { Option } = Select;
const { TextArea } = Input;

export default function LiveRecordsPage() {
  const [records, setRecords] = useState<LiveRecord[]>([]);
  const [anchors, setAnchors] = useState<Anchor[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<LiveRecord | null>(null);
  const [anchorFilter, setAnchorFilter] = useState<string | undefined>();
  const [submitLoading, setSubmitLoading] = useState(false);
  const [form] = Form.useForm();
  const liveStart = Form.useWatch('live_date', form) as Dayjs | undefined;
  const liveEnd = Form.useWatch('live_end_time', form) as Dayjs | undefined;

  const computedDuration = useMemo(() => {
    if (!liveStart || !liveEnd) return undefined;
    const diff = liveEnd.diff(liveStart, 'minute');
    return diff > 0 ? diff : undefined;
  }, [liveStart, liveEnd]);

  const fetchAnchors = async () => {
    try {
      const data = await anchorsApi.list({ limit: 1000 });
      setAnchors(data.items);
    } catch (error) {
      message.error((error as Error).message);
    }
  };

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const data = await liveRecordsApi.list({ anchor_id: anchorFilter, limit: 1000 });
      setRecords(data.items);
      setTotal(data.total);
    } catch (error) {
      message.error((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnchors();
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [anchorFilter]);

  const stats = useMemo(() => {
    return records.reduce(
      (result, record) => ({
        duration: result.duration + (record.duration_minutes || 0),
        viewers: result.viewers + (record.viewers_count || 0),
        followers: result.followers + (record.new_followers || 0),
        gmv: result.gmv + (record.gmv || 0),
        orders: result.orders + (record.orders_count || 0),
      }),
      { duration: 0, viewers: 0, followers: 0, gmv: 0, orders: 0 }
    );
  }, [records]);

  const openCreateModal = () => {
    setEditingRecord(null);
    form.resetFields();
    const now = dayjs();
    form.setFieldsValue({ platform: '快手', live_date: now, live_end_time: now.add(2, 'hour') });
    setModalVisible(true);
  };

  const openEditModal = (record: LiveRecord) => {
    setEditingRecord(record);
    form.setFieldsValue({
      ...record,
      live_date: record.live_date ? dayjs(record.live_date) : undefined,
      live_end_time: record.live_end_time ? dayjs(record.live_end_time) : undefined,
    });
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    const start = values.live_date ? dayjs(values.live_date) : undefined;
    const end = values.live_end_time ? dayjs(values.live_end_time) : undefined;
    if (start && end && end.isBefore(start)) {
      message.error('结束时间必须晚于开始时间');
      return;
    }
    const duration = start && end ? Math.max(0, end.diff(start, 'minute')) : values.duration_minutes;

    setSubmitLoading(true);
    try {
      const data = {
        ...values,
        platform: '快手',
        live_date: start ? start.toISOString() : undefined,
        live_end_time: end ? end.toISOString() : undefined,
        duration_minutes: duration,
      };

      if (editingRecord) {
        await liveRecordsApi.update(editingRecord.id, data);
        message.success('更新直播记录成功');
      } else {
        await liveRecordsApi.create(data);
        message.success('新增直播记录成功');
      }

      setModalVisible(false);
      setEditingRecord(null);
      form.resetFields();
      fetchRecords();
    } catch (error) {
      message.error((error as Error).message);
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDelete = async (recordId: string) => {
    try {
      await liveRecordsApi.delete(recordId);
      message.success('删除直播记录成功');
      fetchRecords();
    } catch (error) {
      message.error((error as Error).message);
    }
  };

  const handleExport = () => {
    const dataToExport = records.map(record => ({
      '主播': record.anchor_stage_name || record.anchor_name || '',
      '平台': '快手',
      '直播间': record.live_room || '',
      '直播开始时间': new Date(record.live_date).toLocaleString('zh-CN'),
      '直播结束时间': record.live_end_time ? new Date(record.live_end_time).toLocaleString('zh-CN') : '',
      '直播时长分钟': record.duration_minutes ?? '',
      '观看人数': record.viewers_count ?? '',
      '新增粉丝': record.new_followers ?? '',
      'GMV': record.gmv ?? '',
      '订单数': record.orders_count ?? '',
      '转化率': record.conversion_rate ?? '',
      '复盘': record.review || '',
      '问题': record.problems || '',
      '改进建议': record.improvements || '',
    }));

    const headers = Object.keys(dataToExport[0] || {}).join(',');
    const rows = dataToExport.map(row => Object.values(row).map(v => `"${v}"`).join(','));
    const content = [headers, ...rows].join('\n');
    const blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `live_records_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    message.success('已导出直播记录');
  };

  const formatNumber = (value?: number) => value === undefined || value === null ? '-' : value.toLocaleString('zh-CN');
  const formatMoney = (value?: number) => value === undefined || value === null ? '-' : `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const columns = [
    {
      title: '主播',
      key: 'anchor',
      render: (_: unknown, record: LiveRecord) => (
        <Space direction="vertical" size={0}>
          <span style={{ fontWeight: 600 }}>{record.anchor_stage_name || '-'}</span>
          <span style={{ color: '#86868B', fontSize: 12 }}>{record.anchor_name || ''}</span>
        </Space>
      ),
    },
    {
      title: '平台/直播间',
      key: 'platform',
      render: (_: unknown, record: LiveRecord) => (
        <Space direction="vertical" size={0}>
          <Tag color="blue">快手</Tag>
          <span style={{ color: '#86868B', fontSize: 12 }}>{record.live_room || '未设置直播间'}</span>
        </Space>
      ),
    },
    {
      title: '直播时间',
      key: 'live_time',
      render: (_: unknown, record: LiveRecord) => (
        <Space direction="vertical" size={0}>
          <span>{new Date(record.live_date).toLocaleString('zh-CN')}</span>
          {record.live_end_time && (
            <span style={{ color: '#86868B', fontSize: 12 }}>
              至 {new Date(record.live_end_time).toLocaleString('zh-CN')}
            </span>
          )}
        </Space>
      ),
    },
    {
      title: '时长',
      dataIndex: 'duration_minutes',
      render: (value?: number) => value ? `${value} 分钟` : '-',
    },
    {
      title: '观看/涨粉',
      key: 'traffic',
      render: (_: unknown, record: LiveRecord) => `${formatNumber(record.viewers_count)} / ${formatNumber(record.new_followers)}`,
    },
    {
      title: 'GMV/订单',
      key: 'gmv',
      render: (_: unknown, record: LiveRecord) => `${formatMoney(record.gmv)} / ${formatNumber(record.orders_count)}`,
    },
    {
      title: '转化率',
      dataIndex: 'conversion_rate',
      render: (value?: number) => value === undefined || value === null ? '-' : `${value}%`,
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, record: LiveRecord) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEditModal(record)}>编辑</Button>
          <Popconfirm title="确定删除该直播记录？" onConfirm={() => handleDelete(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#1D1D1F', margin: 0 }}>直播记录</h1>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchRecords}>刷新</Button>
          {records.length > 0 && <Button icon={<ExportOutlined />} onClick={handleExport}>导出</Button>}
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>新增直播记录</Button>
        </Space>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small"><div style={{ color: '#86868B' }}>记录数</div><div style={{ fontSize: 24, fontWeight: 700 }}>{total}</div></Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small"><div style={{ color: '#86868B' }}>总直播时长</div><div style={{ fontSize: 24, fontWeight: 700 }}>{stats.duration} 分钟</div></Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small"><div style={{ color: '#86868B' }}>总 GMV</div><div style={{ fontSize: 24, fontWeight: 700 }}>{formatMoney(stats.gmv)}</div></Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small"><div style={{ color: '#86868B' }}>新增粉丝</div><div style={{ fontSize: 24, fontWeight: 700 }}>{formatNumber(stats.followers)}</div></Card>
        </Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select placeholder="筛选主播" allowClear showSearch value={anchorFilter} onChange={setAnchorFilter} style={{ width: 220 }} optionFilterProp="children">
            {anchors.map(anchor => <Option key={anchor.id} value={anchor.id}>{anchor.stage_name}（{anchor.name}）</Option>)}
          </Select>
        </Space>
      </Card>

      <Card>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
        ) : records.length === 0 ? (
          <Empty description="暂无直播记录" style={{ padding: 80 }} />
        ) : (
          <Table rowKey="id" columns={columns} dataSource={records} pagination={{ pageSize: 10 }} scroll={{ x: 1000 }} />
        )}
      </Card>

      <Modal
        title={editingRecord ? '编辑直播记录' : '新增直播记录'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSubmit}
        confirmLoading={submitLoading}
        width={820}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Row gutter={[16, 0]}>
            <Col xs={24} sm={12}>
              <Form.Item name="anchor_id" label="主播" rules={[{ required: true, message: '请选择主播' }]}>
                <Select placeholder="请选择主播" showSearch optionFilterProp="children">
                  {anchors.map(anchor => <Option key={anchor.id} value={anchor.id}>{anchor.stage_name}（{anchor.name}）</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="live_date" label="开始时间" rules={[{ required: true, message: '请选择开始时间' }]}>
                <DatePicker showTime format="YYYY-MM-DD HH:mm" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={[16, 0]}>
            <Col xs={24} sm={12}>
              <Form.Item name="live_end_time" label="结束时间" rules={[{ required: true, message: '请选择结束时间' }]}>
                <DatePicker showTime format="YYYY-MM-DD HH:mm" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item label="直播时长">
                <Input
                  value={computedDuration !== undefined ? `${computedDuration} 分钟` : '请先选择开始和结束时间'}
                  readOnly
                  style={{ background: '#F2F2F7', color: '#1D1D1F' }}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={[16, 0]}>
            <Col xs={24} sm={12}>
              <Form.Item label="平台">
                <Input value="快手" disabled />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="live_room" label="直播间">
                <Input placeholder="请输入直播间名称或编号" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={[16, 0]}>
            <Col xs={24} sm={12}>
              <Form.Item name="viewers_count" label="观看人数">
                <InputNumber min={0} placeholder="观看人数" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="new_followers" label="新增粉丝">
                <InputNumber placeholder="新增粉丝" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={[16, 0]}>
            <Col xs={24} sm={8}>
              <Form.Item name="gmv" label="GMV">
                <InputNumber min={0} precision={2} placeholder="GMV" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="orders_count" label="订单数">
                <InputNumber min={0} placeholder="订单数" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="conversion_rate" label="转化率">
                <InputNumber min={0} max={100} precision={2} addonAfter="%" placeholder="转化率" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="review" label="直播复盘">
            <TextArea rows={3} placeholder="记录本场直播亮点、数据表现、主播状态等" />
          </Form.Item>
          <Form.Item name="problems" label="存在问题">
            <TextArea rows={3} placeholder="记录话术、选品、流量、转化等问题" />
          </Form.Item>
          <Form.Item name="improvements" label="改进建议">
            <TextArea rows={3} placeholder="记录下场直播改进方向和跟进动作" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
