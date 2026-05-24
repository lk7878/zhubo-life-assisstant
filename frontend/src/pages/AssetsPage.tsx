import { useEffect, useMemo, useState } from 'react';
import {
  Card, Tabs, Table, Tag, Button, Space, Select, Input, Statistic, Row, Col,
  Popconfirm, message, Modal, Form, DatePicker, InputNumber, Drawer, Descriptions, Tooltip,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, DeleteOutlined, EyeOutlined, ExportOutlined,
  EditOutlined, AppstoreOutlined, SwapOutlined, RollbackOutlined, VideoCameraOutlined, ToolOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { liveRoomsApi, equipmentApi, equipmentLoansApi, anchorsApi } from '../api';
import {
  type LiveRoom, type Equipment, type EquipmentLoan, type Anchor,
  LivePlatform,
  DecorationLevel, DECORATION_LEVEL_LABELS,
  LiveRoomStatus, LIVE_ROOM_STATUS_LABELS, LIVE_ROOM_STATUS_COLORS,
  EquipmentCategory, EQUIPMENT_CATEGORY_LABELS,
  EquipmentStatus, EQUIPMENT_STATUS_LABELS, EQUIPMENT_STATUS_COLORS,
  LoanStatus, LOAN_STATUS_LABELS, LOAN_STATUS_COLORS,
} from '../types';

const { TextArea } = Input;

export default function AssetsPage() {
  const [tab, setTab] = useState<'rooms' | 'equipment' | 'loans'>('rooms');

  // 公共
  const [anchorOpts, setAnchorOpts] = useState<{ label: string; value: string }[]>([]);
  const [roomOpts, setRoomOpts] = useState<{ label: string; value: string }[]>([]);

  // 直播间
  const [rooms, setRooms] = useState<LiveRoom[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [roomFilter, setRoomFilter] = useState<{ platform?: string; status?: string; search?: string }>({});
  const [roomFormOpen, setRoomFormOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<LiveRoom | null>(null);
  const [roomForm] = Form.useForm();
  const [detailRoom, setDetailRoom] = useState<LiveRoom | null>(null);

  // 设备
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [eqLoading, setEqLoading] = useState(false);
  const [eqFilter, setEqFilter] = useState<{ category?: string; status?: string; live_room_id?: string; search?: string }>({});
  const [eqFormOpen, setEqFormOpen] = useState(false);
  const [editingEq, setEditingEq] = useState<Equipment | null>(null);
  const [eqForm] = Form.useForm();
  const [borrowTarget, setBorrowTarget] = useState<Equipment | null>(null);
  const [borrowForm] = Form.useForm();

  // 借用
  const [loans, setLoans] = useState<EquipmentLoan[]>([]);
  const [loansLoading, setLoansLoading] = useState(false);
  const [loanFilter, setLoanFilter] = useState<{ anchor_id?: string; status?: string }>({});
  const [returnTarget, setReturnTarget] = useState<EquipmentLoan | null>(null);
  const [returnForm] = Form.useForm();

  const fetchAnchors = async (kw?: string) => {
    const list = await anchorsApi.list({ search: kw, limit: 80 });
    setAnchorOpts(list.items.map((a: Anchor) => ({ label: `${a.stage_name}（${a.name}）`, value: a.id })));
  };

  const fetchRoomOpts = async () => {
    const r = await liveRoomsApi.list({ limit: 200 });
    setRoomOpts(r.items.map(r => ({ label: `${r.name}（快手）`, value: r.id })));
  };

  const fetchRooms = async () => {
    setRoomsLoading(true);
    try {
      const r = await liveRoomsApi.list({ ...roomFilter, limit: 200 });
      setRooms(r.items);
    } catch (e) { message.error((e as Error).message); }
    finally { setRoomsLoading(false); }
  };

  const fetchEquipment = async () => {
    setEqLoading(true);
    try {
      const r = await equipmentApi.list({ ...eqFilter, limit: 300 });
      setEquipment(r.items);
    } catch (e) { message.error((e as Error).message); }
    finally { setEqLoading(false); }
  };

  const fetchLoans = async () => {
    setLoansLoading(true);
    try {
      const r = await equipmentLoansApi.list({ ...loanFilter, limit: 200 });
      setLoans(r.items);
    } catch (e) { message.error((e as Error).message); }
    finally { setLoansLoading(false); }
  };

  useEffect(() => {
    fetchAnchors();
    fetchRoomOpts();
  }, []);

  useEffect(() => {
    if (tab === 'rooms') fetchRooms();
    else if (tab === 'equipment') fetchEquipment();
    else fetchLoans();
  }, [tab, JSON.stringify(roomFilter), JSON.stringify(eqFilter), JSON.stringify(loanFilter)]);

  // ===== 顶部统计 =====
  const stats = useMemo(() => ({
    roomsTotal: rooms.length,
    roomsActive: rooms.filter(r => r.status === LiveRoomStatus.ACTIVE).length,
    eqTotal: equipment.length,
    eqBorrowed: equipment.filter(e => e.status === EquipmentStatus.BORROWED).length,
    eqMaintenance: equipment.filter(e => e.status === EquipmentStatus.MAINTENANCE).length,
    eqLost: equipment.filter(e => e.status === EquipmentStatus.LOST).length,
    loansActive: loans.filter(l => l.status === LoanStatus.BORROWED).length,
    loansOverdue: loans.filter(l => l.status === LoanStatus.OVERDUE).length,
  }), [rooms, equipment, loans]);

  // ============================================================
  // Rooms 操作
  // ============================================================
  const openRoomForm = (r?: LiveRoom) => {
    setEditingRoom(r || null);
    roomForm.resetFields();
    if (r) {
      roomForm.setFieldsValue({ ...r });
    } else {
      roomForm.setFieldsValue({
        platform: LivePlatform.KUAISHOU,
        decoration_level: DecorationLevel.STANDARD,
        status: LiveRoomStatus.ACTIVE,
      });
    }
    setRoomFormOpen(true);
  };

  const handleRoomSave = async () => {
    const v = await roomForm.validateFields();
    const payload = { ...v, platform: LivePlatform.KUAISHOU };
    try {
      if (editingRoom) await liveRoomsApi.update(editingRoom.id, payload);
      else await liveRoomsApi.create(payload);
      message.success('已保存');
      setRoomFormOpen(false);
      fetchRooms();
      fetchRoomOpts();
    } catch (e) { message.error((e as Error).message); }
  };

  const handleRoomDelete = async (id: string) => {
    try {
      await liveRoomsApi.delete(id);
      message.success('已删除');
      fetchRooms();
      fetchRoomOpts();
    } catch (e) { message.error((e as Error).message); }
  };

  // ============================================================
  // Equipment 操作
  // ============================================================
  const openEqForm = (e?: Equipment) => {
    setEditingEq(e || null);
    eqForm.resetFields();
    if (e) {
      eqForm.setFieldsValue({
        ...e,
        purchase_date: e.purchase_date ? dayjs(e.purchase_date) : null,
        warranty_until: e.warranty_until ? dayjs(e.warranty_until) : null,
      });
    } else {
      eqForm.setFieldsValue({
        category: EquipmentCategory.OTHER,
        status: EquipmentStatus.IN_STOCK,
        purchase_price: 0,
      });
    }
    setEqFormOpen(true);
  };

  const handleEqSave = async () => {
    const v = await eqForm.validateFields();
    const payload: any = {
      ...v,
      purchase_date: v.purchase_date ? dayjs(v.purchase_date).format('YYYY-MM-DD') : undefined,
      warranty_until: v.warranty_until ? dayjs(v.warranty_until).format('YYYY-MM-DD') : undefined,
      purchase_price: Number(v.purchase_price || 0),
    };
    try {
      if (editingEq) await equipmentApi.update(editingEq.id, payload);
      else await equipmentApi.create(payload);
      message.success('已保存');
      setEqFormOpen(false);
      fetchEquipment();
    } catch (e) { message.error((e as Error).message); }
  };

  const handleEqDelete = async (id: string) => {
    try {
      await equipmentApi.delete(id);
      message.success('已删除');
      fetchEquipment();
    } catch (e) { message.error((e as Error).message); }
  };

  // 借出
  const openBorrow = (e: Equipment) => {
    setBorrowTarget(e);
    borrowForm.resetFields();
    borrowForm.setFieldsValue({
      borrowed_at: dayjs(),
      expected_return_at: dayjs().add(7, 'day'),
      condition_on_borrow: '完好',
    });
  };
  const handleBorrow = async () => {
    if (!borrowTarget) return;
    const v = await borrowForm.validateFields();
    try {
      await equipmentLoansApi.create({
        equipment_id: borrowTarget.id,
        anchor_id: v.anchor_id,
        borrowed_at: dayjs(v.borrowed_at).toISOString(),
        expected_return_at: v.expected_return_at ? dayjs(v.expected_return_at).format('YYYY-MM-DD') : undefined,
        condition_on_borrow: v.condition_on_borrow,
        borrow_note: v.borrow_note,
      });
      message.success('已借出');
      setBorrowTarget(null);
      fetchEquipment();
      if (tab === 'loans') fetchLoans();
    } catch (e) { message.error((e as Error).message); }
  };

  // ============================================================
  // Loan 归还
  // ============================================================
  const openReturn = (l: EquipmentLoan) => {
    setReturnTarget(l);
    returnForm.resetFields();
    returnForm.setFieldsValue({
      returned_at: dayjs(),
      status: LoanStatus.RETURNED,
      condition_on_return: '完好',
    });
  };
  const handleReturn = async () => {
    if (!returnTarget) return;
    const v = await returnForm.validateFields();
    try {
      await equipmentLoansApi.returnLoan(returnTarget.id, {
        returned_at: dayjs(v.returned_at).toISOString(),
        status: v.status,
        condition_on_return: v.condition_on_return,
        return_note: v.return_note,
      });
      message.success('已归还');
      setReturnTarget(null);
      fetchLoans();
      if (tab === 'equipment') fetchEquipment();
    } catch (e) { message.error((e as Error).message); }
  };

  const handleLoanDelete = async (id: string) => {
    try {
      await equipmentLoansApi.delete(id);
      message.success('已删除');
      fetchLoans();
    } catch (e) { message.error((e as Error).message); }
  };

  // ===== 导出 =====
  const exportEquipmentCsv = () => {
    if (!equipment.length) return;
    const rows = equipment.map(e => ({
      '名称': e.name,
      '类别': EQUIPMENT_CATEGORY_LABELS[e.category],
      '品牌': e.brand || '', '型号': e.model || '', 'SN': e.sn || '',
      '采购日期': e.purchase_date || '', '采购价': e.purchase_price,
      '保修至': e.warranty_until || '',
      '状态': EQUIPMENT_STATUS_LABELS[e.status],
      '所在直播间': e.live_room_name || '', '当前持有人': e.current_holder_name || '',
      '存放位置': e.location || '', '备注': (e.remark || '').replace(/\n/g, ' '),
    }));
    const headers = Object.keys(rows[0]).join(',');
    const body = rows.map(r => Object.values(r).map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + headers + '\n' + body], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `equipment_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    message.success('已导出');
  };

  // ============================================================
  // Columns
  // ============================================================
  const roomColumns = [
    { title: '名称', dataIndex: 'name', width: 120, fixed: 'left' as const, render: (v: string, r: LiveRoom) => <a onClick={() => setDetailRoom(r)}>{v}</a> },
    { title: '平台', dataIndex: 'platform', width: 80, render: () => <Tag>快手</Tag> },
    { title: '平台账号', dataIndex: 'platform_account', width: 130, render: (v: string) => v || '-' },
    { title: '房间号', dataIndex: 'room_id', width: 110, render: (v: string) => v || '-' },
    { title: '装修', dataIndex: 'decoration_level', width: 70, render: (v: DecorationLevel) => DECORATION_LEVEL_LABELS[v] },
    { title: '占用主播', dataIndex: 'assigned_anchor_stage_name', width: 100, render: (v: string) => v || '-' },
    { title: '设备数', dataIndex: 'equipment_count', width: 70 },
    { title: '物理位置', dataIndex: 'location', width: 110, render: (v: string) => v || '-' },
    { title: '状态', dataIndex: 'status', width: 90, render: (v: LiveRoomStatus) => <Tag color={LIVE_ROOM_STATUS_COLORS[v]}>{LIVE_ROOM_STATUS_LABELS[v]}</Tag> },
    {
      title: '操作', key: 'actions', width: 160, fixed: 'right' as const,
      render: (_: any, r: LiveRoom) => (
        <Space size={4}>
          <Button size="small" icon={<EyeOutlined />} onClick={() => setDetailRoom(r)} />
          <Button size="small" icon={<EditOutlined />} onClick={() => openRoomForm(r)} />
          <Popconfirm title="确定删除该直播间？" onConfirm={() => handleRoomDelete(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const equipmentColumns = [
    { title: '名称', dataIndex: 'name', width: 140, fixed: 'left' as const },
    { title: '类别', dataIndex: 'category', width: 80, render: (v: EquipmentCategory) => <Tag>{EQUIPMENT_CATEGORY_LABELS[v]}</Tag> },
    { title: '品牌型号', key: 'brand_model', width: 140, render: (_: any, e: Equipment) => `${e.brand || '-'} ${e.model || ''}`.trim() },
    { title: 'SN', dataIndex: 'sn', width: 130, render: (v: string) => v ? <code style={{ fontSize: 11 }}>{v}</code> : '-' },
    { title: '采购日期', dataIndex: 'purchase_date', width: 100, render: (v: string) => v || '-' },
    { title: '采购价', dataIndex: 'purchase_price', width: 80, render: (v: number) => v ? `¥${v}` : '-' },
    { title: '直播间', dataIndex: 'live_room_name', width: 110, render: (v: string) => v || '-' },
    { title: '持有人', dataIndex: 'current_holder_name', width: 90, render: (v: string) => v || '-' },
    { title: '状态', dataIndex: 'status', width: 90, render: (v: EquipmentStatus) => <Tag color={EQUIPMENT_STATUS_COLORS[v]}>{EQUIPMENT_STATUS_LABELS[v]}</Tag> },
    {
      title: '操作', key: 'actions', width: 220, fixed: 'right' as const,
      render: (_: any, e: Equipment) => (
        <Space size={4} wrap>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEqForm(e)} />
          {e.status === EquipmentStatus.IN_STOCK && (
            <Tooltip title="借出"><Button size="small" type="primary" icon={<SwapOutlined />} onClick={() => openBorrow(e)}>借出</Button></Tooltip>
          )}
          {e.status !== EquipmentStatus.BORROWED && (
            <Popconfirm title="确定删除该设备？" onConfirm={() => handleEqDelete(e.id)}>
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const loanColumns = [
    { title: '设备', dataIndex: 'equipment_name', width: 160, fixed: 'left' as const, render: (v: string) => v || '-' },
    { title: '借用人', dataIndex: 'anchor_stage_name', width: 110, render: (v: string) => v || '-' },
    {
      title: '借出时间', dataIndex: 'borrowed_at', width: 150,
      render: (v: string) => new Date(v).toLocaleString('zh-CN'),
    },
    {
      title: '预计归还', dataIndex: 'expected_return_at', width: 110,
      render: (v: string, l: EquipmentLoan) => {
        if (!v) return '-';
        if (l.days_overdue && l.days_overdue > 0) {
          return <span style={{ color: '#FF3B30' }}>{v} (逾期{l.days_overdue}天)</span>;
        }
        return v;
      },
    },
    {
      title: '实际归还', dataIndex: 'returned_at', width: 150,
      render: (v: string) => v ? new Date(v).toLocaleString('zh-CN') : '-',
    },
    { title: '借出状况', dataIndex: 'condition_on_borrow', width: 110, render: (v: string) => v || '-' },
    { title: '归还状况', dataIndex: 'condition_on_return', width: 110, render: (v: string) => v || '-' },
    { title: '状态', dataIndex: 'status', width: 90, render: (v: LoanStatus) => <Tag color={LOAN_STATUS_COLORS[v]}>{LOAN_STATUS_LABELS[v]}</Tag> },
    {
      title: '操作', key: 'actions', width: 160, fixed: 'right' as const,
      render: (_: any, l: EquipmentLoan) => (
        <Space size={4}>
          {(l.status === LoanStatus.BORROWED || l.status === LoanStatus.OVERDUE) && (
            <Button size="small" type="primary" icon={<RollbackOutlined />} onClick={() => openReturn(l)}>归还</Button>
          )}
          {l.status !== LoanStatus.BORROWED && l.status !== LoanStatus.OVERDUE && (
            <Popconfirm title="确定删除该记录？" onConfirm={() => handleLoanDelete(l.id)}>
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
        title={<span><AppstoreOutlined /> 资产管理</span>}
        extra={
          <Space wrap>
            <Button icon={<ReloadOutlined />} size="small" onClick={() => { fetchRooms(); fetchEquipment(); fetchLoans(); }}>刷新</Button>
            {tab === 'equipment' && (
              <Button icon={<ExportOutlined />} size="small" onClick={exportEquipmentCsv} disabled={!equipment.length}>导出</Button>
            )}
            {tab === 'rooms' && <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => openRoomForm()}>新建直播间</Button>}
            {tab === 'equipment' && <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => openEqForm()}>新增设备</Button>}
          </Space>
        }
      >
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col xs={12} md={4}><Statistic title="直播间(启用)" value={stats.roomsActive} suffix={`/${stats.roomsTotal}`} valueStyle={{ color: '#34C759' }} /></Col>
          <Col xs={12} md={4}><Statistic title="设备总数" value={stats.eqTotal} prefix={<ToolOutlined />} /></Col>
          <Col xs={12} md={4}><Statistic title="已借出" value={stats.eqBorrowed} valueStyle={{ color: '#FF9500' }} /></Col>
          <Col xs={12} md={4}><Statistic title="维护中" value={stats.eqMaintenance} valueStyle={{ color: '#FFCC00' }} /></Col>
          <Col xs={12} md={4}><Statistic title="丢失" value={stats.eqLost} valueStyle={{ color: stats.eqLost > 0 ? '#FA541C' : undefined }} /></Col>
          <Col xs={12} md={4}>
            <Statistic title="逾期未还" value={stats.loansOverdue} valueStyle={{ color: stats.loansOverdue > 0 ? '#FF3B30' : undefined }} />
          </Col>
        </Row>

        <Tabs
          activeKey={tab}
          onChange={(k) => setTab(k as any)}
          items={[
            { key: 'rooms', label: <span><VideoCameraOutlined /> 直播间档案</span> },
            { key: 'equipment', label: <span><ToolOutlined /> 设备清单</span> },
            { key: 'loans', label: <span><SwapOutlined /> 借用记录</span> },
          ]}
        />

        {tab === 'rooms' && (
          <>
            <Space wrap style={{ marginBottom: 12 }}>
              <Input.Search placeholder="名称/账号/房间号" allowClear style={{ width: 220 }}
                onSearch={(v) => setRoomFilter({ ...roomFilter, search: v || undefined })}
              />
              <Select placeholder="状态" allowClear style={{ width: 120 }}
                value={roomFilter.status}
                onChange={(v) => setRoomFilter({ ...roomFilter, status: v })}>
                {Object.entries(LIVE_ROOM_STATUS_LABELS).map(([k, v]) => <Select.Option key={k} value={k}>{v}</Select.Option>)}
              </Select>
            </Space>
            <Table rowKey="id" size="small" loading={roomsLoading} dataSource={rooms} columns={roomColumns}
              pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 条` }} scroll={{ x: 1300 }} />
          </>
        )}

        {tab === 'equipment' && (
          <>
            <Space wrap style={{ marginBottom: 12 }}>
              <Input.Search placeholder="名称/品牌/SN" allowClear style={{ width: 220 }}
                onSearch={(v) => setEqFilter({ ...eqFilter, search: v || undefined })}
              />
              <Select placeholder="类别" allowClear style={{ width: 130 }}
                value={eqFilter.category}
                onChange={(v) => setEqFilter({ ...eqFilter, category: v })}>
                {Object.entries(EQUIPMENT_CATEGORY_LABELS).map(([k, v]) => <Select.Option key={k} value={k}>{v}</Select.Option>)}
              </Select>
              <Select placeholder="状态" allowClear style={{ width: 130 }}
                value={eqFilter.status}
                onChange={(v) => setEqFilter({ ...eqFilter, status: v })}>
                {Object.entries(EQUIPMENT_STATUS_LABELS).map(([k, v]) => <Select.Option key={k} value={k}>{v}</Select.Option>)}
              </Select>
              <Select placeholder="所属直播间" allowClear style={{ width: 200 }}
                value={eqFilter.live_room_id}
                onChange={(v) => setEqFilter({ ...eqFilter, live_room_id: v })}
                options={roomOpts}
              />
            </Space>
            <Table rowKey="id" size="small" loading={eqLoading} dataSource={equipment} columns={equipmentColumns}
              pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 条` }} scroll={{ x: 1400 }} />
          </>
        )}

        {tab === 'loans' && (
          <>
            <Space wrap style={{ marginBottom: 12 }}>
              <Select placeholder="借用人" allowClear style={{ width: 200 }}
                showSearch filterOption={false}
                options={anchorOpts} onSearch={fetchAnchors}
                value={loanFilter.anchor_id}
                onChange={(v) => setLoanFilter({ ...loanFilter, anchor_id: v })}
              />
              <Select placeholder="状态" allowClear style={{ width: 130 }}
                value={loanFilter.status}
                onChange={(v) => setLoanFilter({ ...loanFilter, status: v })}>
                {Object.entries(LOAN_STATUS_LABELS).map(([k, v]) => <Select.Option key={k} value={k}>{v}</Select.Option>)}
              </Select>
            </Space>
            <Table rowKey="id" size="small" loading={loansLoading} dataSource={loans} columns={loanColumns}
              pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 条` }} scroll={{ x: 1400 }} />
          </>
        )}
      </Card>

      {/* 直播间表单 */}
      <Modal
        open={roomFormOpen}
        title={editingRoom ? '编辑直播间' : '新建直播间'}
        onCancel={() => setRoomFormOpen(false)}
        onOk={handleRoomSave}
        width={680}
        destroyOnHidden
      >
        <Form form={roomForm} layout="vertical">
          <Space size={16} wrap>
            <Form.Item name="name" label="名称" rules={[{ required: true }]}>
              <Input placeholder="如 1号直播间" style={{ width: 200 }} />
            </Form.Item>
            <Form.Item label="平台">
              <Input value="快手" disabled style={{ width: 140 }} />
            </Form.Item>
            <Form.Item name="status" label="状态">
              <Select style={{ width: 130 }}>
                {Object.entries(LIVE_ROOM_STATUS_LABELS).map(([k, v]) => <Select.Option key={k} value={k}>{v}</Select.Option>)}
              </Select>
            </Form.Item>
          </Space>
          <Space size={16} wrap>
            <Form.Item name="platform_account" label="平台账号">
              <Input style={{ width: 200 }} />
            </Form.Item>
            <Form.Item name="room_id" label="房间号">
              <Input style={{ width: 160 }} />
            </Form.Item>
            <Form.Item name="decoration_level" label="装修等级">
              <Select style={{ width: 130 }}>
                {Object.entries(DECORATION_LEVEL_LABELS).map(([k, v]) => <Select.Option key={k} value={k}>{v}</Select.Option>)}
              </Select>
            </Form.Item>
          </Space>
          <Form.Item name="room_url" label="直播间链接">
            <Input placeholder="https://..." />
          </Form.Item>
          <Space size={16} wrap>
            <Form.Item name="assigned_anchor_id" label="占用主播">
              <Select allowClear showSearch filterOption={false}
                options={anchorOpts} onSearch={fetchAnchors}
                style={{ width: 260 }} placeholder="可空（公共直播间）"
              />
            </Form.Item>
            <Form.Item name="location" label="物理位置">
              <Input placeholder="如 A栋 3层 301" style={{ width: 220 }} />
            </Form.Item>
          </Space>
          <Form.Item name="decoration_note" label="装修说明">
            <TextArea rows={2} />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 直播间详情 */}
      <Drawer open={!!detailRoom} onClose={() => setDetailRoom(null)} title={detailRoom?.name} width={520}>
        {detailRoom && (
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="平台">快手</Descriptions.Item>
            <Descriptions.Item label="平台账号">{detailRoom.platform_account || '-'}</Descriptions.Item>
            <Descriptions.Item label="房间号">{detailRoom.room_id || '-'}</Descriptions.Item>
            <Descriptions.Item label="链接">{detailRoom.room_url ? <a href={detailRoom.room_url} target="_blank" rel="noreferrer">{detailRoom.room_url}</a> : '-'}</Descriptions.Item>
            <Descriptions.Item label="装修">{DECORATION_LEVEL_LABELS[detailRoom.decoration_level]}</Descriptions.Item>
            <Descriptions.Item label="占用主播">{detailRoom.assigned_anchor_stage_name || '-'}</Descriptions.Item>
            <Descriptions.Item label="物理位置">{detailRoom.location || '-'}</Descriptions.Item>
            <Descriptions.Item label="状态"><Tag color={LIVE_ROOM_STATUS_COLORS[detailRoom.status]}>{LIVE_ROOM_STATUS_LABELS[detailRoom.status]}</Tag></Descriptions.Item>
            <Descriptions.Item label="设备数">{detailRoom.equipment_count} 件</Descriptions.Item>
            <Descriptions.Item label="装修说明">{detailRoom.decoration_note || '-'}</Descriptions.Item>
            <Descriptions.Item label="备注">{detailRoom.remark || '-'}</Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>

      {/* 设备表单 */}
      <Modal
        open={eqFormOpen}
        title={editingEq ? '编辑设备' : '新增设备'}
        onCancel={() => setEqFormOpen(false)}
        onOk={handleEqSave}
        width={760}
        destroyOnHidden
      >
        <Form form={eqForm} layout="vertical">
          <Space size={16} wrap>
            <Form.Item name="name" label="名称" rules={[{ required: true }]}>
              <Input placeholder="如 iPhone 15 Pro Max" style={{ width: 220 }} />
            </Form.Item>
            <Form.Item name="category" label="类别" rules={[{ required: true }]}>
              <Select style={{ width: 140 }}>
                {Object.entries(EQUIPMENT_CATEGORY_LABELS).map(([k, v]) => <Select.Option key={k} value={k}>{v}</Select.Option>)}
              </Select>
            </Form.Item>
            <Form.Item name="status" label="状态">
              <Select style={{ width: 130 }}>
                {Object.entries(EQUIPMENT_STATUS_LABELS).map(([k, v]) => <Select.Option key={k} value={k}>{v}</Select.Option>)}
              </Select>
            </Form.Item>
          </Space>
          <Space size={16} wrap>
            <Form.Item name="brand" label="品牌"><Input style={{ width: 160 }} /></Form.Item>
            <Form.Item name="model" label="型号"><Input style={{ width: 200 }} /></Form.Item>
            <Form.Item name="sn" label="序列号"><Input style={{ width: 200 }} /></Form.Item>
          </Space>
          <Space size={16} wrap>
            <Form.Item name="purchase_date" label="采购日期"><DatePicker style={{ width: 160 }} /></Form.Item>
            <Form.Item name="purchase_price" label="采购价格">
              <InputNumber min={0} step={100} style={{ width: 160 }} addonBefore="¥" />
            </Form.Item>
            <Form.Item name="warranty_until" label="保修至"><DatePicker style={{ width: 160 }} /></Form.Item>
          </Space>
          <Space size={16} wrap>
            <Form.Item name="live_room_id" label="所属直播间">
              <Select allowClear options={roomOpts} style={{ width: 260 }} placeholder="可空（库房）" />
            </Form.Item>
            <Form.Item name="location" label="存放位置">
              <Input placeholder="如 仓库A1货架" style={{ width: 220 }} />
            </Form.Item>
          </Space>
          <Form.Item name="remark" label="备注"><TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>

      {/* 借出 */}
      <Modal
        open={!!borrowTarget}
        title={borrowTarget ? `借出 · ${borrowTarget.name}` : ''}
        onCancel={() => setBorrowTarget(null)}
        onOk={handleBorrow}
        okText="确认借出"
        destroyOnHidden
      >
        <Form form={borrowForm} layout="vertical">
          <Form.Item name="anchor_id" label="借用人" rules={[{ required: true }]}>
            <Select showSearch filterOption={false} options={anchorOpts} onSearch={fetchAnchors} placeholder="搜索主播" />
          </Form.Item>
          <Space size={16} wrap>
            <Form.Item name="borrowed_at" label="借出时间" rules={[{ required: true }]}>
              <DatePicker showTime style={{ width: 220 }} />
            </Form.Item>
            <Form.Item name="expected_return_at" label="预计归还" rules={[{ required: true }]}>
              <DatePicker style={{ width: 200 }} />
            </Form.Item>
          </Space>
          <Form.Item name="condition_on_borrow" label="借出时设备状况">
            <Input placeholder="完好 / 屏幕轻微划痕 等" />
          </Form.Item>
          <Form.Item name="borrow_note" label="备注"><TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>

      {/* 归还 */}
      <Modal
        open={!!returnTarget}
        title={returnTarget ? `归还 · ${returnTarget.equipment_name}` : ''}
        onCancel={() => setReturnTarget(null)}
        onOk={handleReturn}
        okText="确认归还"
        destroyOnHidden
      >
        <Form form={returnForm} layout="vertical">
          <Space size={16} wrap>
            <Form.Item name="returned_at" label="归还时间" rules={[{ required: true }]}>
              <DatePicker showTime style={{ width: 220 }} />
            </Form.Item>
            <Form.Item name="status" label="归还结果" rules={[{ required: true }]}>
              <Select style={{ width: 180 }}>
                <Select.Option value={LoanStatus.RETURNED}>正常归还</Select.Option>
                <Select.Option value={LoanStatus.DAMAGED}>损坏</Select.Option>
                <Select.Option value={LoanStatus.LOST}>丢失</Select.Option>
              </Select>
            </Form.Item>
          </Space>
          <Form.Item name="condition_on_return" label="归还时状况">
            <Input placeholder="完好 / 划痕 / 部件缺失" />
          </Form.Item>
          <Form.Item name="return_note" label="备注"><TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
