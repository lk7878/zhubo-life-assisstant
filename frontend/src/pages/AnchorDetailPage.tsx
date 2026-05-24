import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Tag, Button, Descriptions, Spin, message, Popconfirm, Space, Timeline, Select, Row, Col, Dropdown, Tabs, Table } from 'antd';
import { ArrowLeftOutlined, EditOutlined, DeleteOutlined, PlusOutlined, PaperClipOutlined, ExportOutlined, DownOutlined } from '@ant-design/icons';
import { anchorsApi, nodesApi, contractsApi, salaryApi, trainingsApi, liveRecordsApi, liveRoomsApi, equipmentLoansApi } from '../api';
import type { Anchor, TimelineNode, Node, Contract, SalaryRecord, Training, LiveRecord, LiveRoom, EquipmentLoan } from '../types';
import {
  STATUS_LABELS,
  STATUS_COLORS,
  NODE_TYPE_LABELS,
  NODE_TYPE_COLORS,
  NODE_TYPE_LIST,
  STAGE_LABELS,
  STAGE_COLORS,
  CONTRACT_TYPE_LABELS,
  CONTRACT_STATUS_LABELS,
  CONTRACT_STATUS_COLORS,
  SALARY_STATUS_LABELS,
  SALARY_STATUS_COLORS,
  TRAINING_TYPE_LABELS,
  TRAINING_STATUS_LABELS,
  TRAINING_STATUS_COLORS,
  LIVE_ROOM_STATUS_LABELS,
  LIVE_ROOM_STATUS_COLORS,
  LOAN_STATUS_LABELS,
  LOAN_STATUS_COLORS,
  computeStage,
} from '../types';
import NodeFormModal from '../components/NodeFormModal';

const { Option } = Select;

export default function AnchorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [timeline, setTimeline] = useState<TimelineNode[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [salaryRecords, setSalaryRecords] = useState<SalaryRecord[]>([]);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [liveRecords, setLiveRecords] = useState<LiveRecord[]>([]);
  const [liveRooms, setLiveRooms] = useState<LiveRoom[]>([]);
  const [equipmentLoans, setEquipmentLoans] = useState<EquipmentLoan[]>([]);
  const [loading, setLoading] = useState(true);
  const [nodeModalVisible, setNodeModalVisible] = useState(false);
  const [filterType, setFilterType] = useState<string | undefined>();

  const fetchData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [anchorData, timelineData, nodesData, contractsData, salaryData, trainingsData, liveData, roomsData, loansData] = await Promise.all([
        anchorsApi.get(id),
        anchorsApi.timeline(id),
        nodesApi.list(id, { node_type: filterType }),
        contractsApi.list({ anchor_id: id, limit: 100 }),
        salaryApi.listRecords({ anchor_id: id, limit: 100 }),
        trainingsApi.list({ anchor_id: id, limit: 100 }),
        liveRecordsApi.list({ anchor_id: id, limit: 100 }),
        liveRoomsApi.list({ assigned_anchor_id: id, limit: 100 }),
        equipmentLoansApi.list({ anchor_id: id, limit: 100 }),
      ]);
      setAnchor(anchorData);
      setTimeline(timelineData);
      setNodes(nodesData.items);
      setContracts(contractsData.items);
      setSalaryRecords(salaryData.items);
      setTrainings(trainingsData.items);
      setLiveRecords(liveData.items);
      setLiveRooms(roomsData.items);
      setEquipmentLoans(loansData.items);
    } catch (error) {
      message.error((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id, filterType]);

  const handleDelete = async () => {
    if (!id) return;
    try {
      await anchorsApi.delete(id);
      message.success('删除成功');
      navigate('/');
    } catch (error) {
      message.error((error as Error).message);
    }
  };

  const handleDeleteNode = async (nodeId: string) => {
    try {
      await nodesApi.delete(nodeId);
      message.success('删除成功');
      fetchData();
    } catch (error) {
      message.error((error as Error).message);
    }
  };

  const handleExportTimeline = () => {
    const dataToExport = timeline.map(node => ({
      '类型': NODE_TYPE_LABELS[node.type],
      '标题': node.title,
      '时间': new Date(node.date).toLocaleString('zh-CN'),
      '地点': node.location || '',
    }));

    const headers = Object.keys(dataToExport[0] || {}).join(',');
    const rows = dataToExport.map(row => Object.values(row).map(v => `"${v}"`).join(','));
    const content = [headers, ...rows].join('\n');

    const blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `timeline_${anchor?.stage_name || 'anchor'}_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    message.success('已导出时间轴数据');
  };

  const exportItems = [
    { key: 'timeline', label: '导出时间轴', icon: <ExportOutlined />, onClick: handleExportTimeline },
  ];

  const displayNumber = (value?: number | null) => value === undefined || value === null ? '-' : value.toLocaleString('zh-CN');
  const displayMoney = (value?: number | null) => value === undefined || value === null ? '-' : `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const displayPercent = (value?: number | null) => value === undefined || value === null ? '-' : `${value}%`;
  const displayDate = (value?: string | null) => value ? new Date(value).toLocaleDateString('zh-CN') : '-';
  const displayDateTime = (value?: string | null) => value ? new Date(value).toLocaleString('zh-CN') : '-';

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!anchor) {
    return <div>主播不存在</div>;
  }

  const relatedTabItems = [
    {
      key: 'contracts',
      label: `合同 (${contracts.length})`,
      children: (
        <Table<Contract>
          rowKey="id"
          size="small"
          dataSource={contracts}
          pagination={false}
          scroll={{ x: 760 }}
          columns={[
            { title: '合同编号', dataIndex: 'contract_no', render: (value) => value || '-' },
            { title: '类型', dataIndex: 'contract_type', render: (_, record) => <Tag>{CONTRACT_TYPE_LABELS[record.contract_type]}</Tag> },
            { title: '状态', dataIndex: 'status', render: (_, record) => <Tag color={CONTRACT_STATUS_COLORS[record.status]}>{CONTRACT_STATUS_LABELS[record.status]}</Tag> },
            { title: '开始日期', dataIndex: 'start_date', render: displayDate },
            { title: '结束日期', dataIndex: 'end_date', render: displayDate },
            { title: '底薪', dataIndex: 'base_salary', render: displayMoney },
            { title: '操作', render: () => <Button type="link" size="small" onClick={() => navigate('/contracts')}>查看合同</Button> },
          ]}
        />
      ),
    },
    {
      key: 'salaries',
      label: `薪资 (${salaryRecords.length})`,
      children: (
        <Table<SalaryRecord>
          rowKey="id"
          size="small"
          dataSource={salaryRecords}
          pagination={false}
          scroll={{ x: 760 }}
          columns={[
            { title: '周期', render: (_, record) => `${displayDate(record.period_start)} ~ ${displayDate(record.period_end)}` },
            { title: '直播场次', dataIndex: 'session_count', render: displayNumber },
            { title: 'GMV', dataIndex: 'total_gmv', render: displayMoney },
            { title: '提成', dataIndex: 'commission', render: displayMoney },
            { title: '应发', dataIndex: 'total_payable', render: displayMoney },
            { title: '状态', dataIndex: 'status', render: (_, record) => <Tag color={SALARY_STATUS_COLORS[record.status]}>{SALARY_STATUS_LABELS[record.status]}</Tag> },
            { title: '发放时间', dataIndex: 'paid_at', render: displayDateTime },
          ]}
        />
      ),
    },
    {
      key: 'trainings',
      label: `培训 (${trainings.length})`,
      children: (
        <Table<Training>
          rowKey="id"
          size="small"
          dataSource={trainings}
          pagination={false}
          scroll={{ x: 760 }}
          columns={[
            { title: '培训主题', dataIndex: 'title' },
            { title: '类型', dataIndex: 'training_type', render: (_, record) => <Tag>{TRAINING_TYPE_LABELS[record.training_type]}</Tag> },
            { title: '状态', dataIndex: 'status', render: (_, record) => <Tag color={TRAINING_STATUS_COLORS[record.status]}>{TRAINING_STATUS_LABELS[record.status]}</Tag> },
            { title: '讲师', dataIndex: 'trainer', render: (value) => value || '-' },
            { title: '开始时间', dataIndex: 'start_time', render: displayDateTime },
            { title: '签到', render: (_, record) => `${record.checked_in_count}/${record.attendance_count}` },
          ]}
        />
      ),
    },
    {
      key: 'assets',
      label: `资产 (${equipmentLoans.length})`,
      children: (
        <Table<EquipmentLoan>
          rowKey="id"
          size="small"
          dataSource={equipmentLoans}
          pagination={false}
          scroll={{ x: 760 }}
          columns={[
            { title: '设备', dataIndex: 'equipment_name', render: (value) => value || '-' },
            { title: '状态', dataIndex: 'status', render: (_, record) => <Tag color={LOAN_STATUS_COLORS[record.status]}>{LOAN_STATUS_LABELS[record.status]}</Tag> },
            { title: '借出时间', dataIndex: 'borrowed_at', render: displayDateTime },
            { title: '预计归还', dataIndex: 'expected_return_at', render: displayDateTime },
            { title: '实际归还', dataIndex: 'returned_at', render: displayDateTime },
            { title: '逾期天数', dataIndex: 'days_overdue', render: displayNumber },
            { title: '备注', dataIndex: 'borrow_note', render: (value) => value || '-' },
          ]}
        />
      ),
    },
    {
      key: 'live',
      label: `直播 (${liveRecords.length})`,
      children: (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Card size="small" type="inner" title={`直播间 (${liveRooms.length})`}>
            <Table<LiveRoom>
              rowKey="id"
              size="small"
              dataSource={liveRooms}
              pagination={false}
              scroll={{ x: 720 }}
              columns={[
                { title: '直播间', dataIndex: 'name' },
                { title: '平台', dataIndex: 'platform', render: () => '快手' },
                { title: '账号', dataIndex: 'platform_account', render: (value) => value || '-' },
                { title: '状态', dataIndex: 'status', render: (_, record) => <Tag color={LIVE_ROOM_STATUS_COLORS[record.status]}>{LIVE_ROOM_STATUS_LABELS[record.status]}</Tag> },
                { title: '位置', dataIndex: 'location', render: (value) => value || '-' },
                { title: '设备数', dataIndex: 'equipment_count', render: displayNumber },
              ]}
            />
          </Card>
          <Card size="small" type="inner" title={`直播记录 (${liveRecords.length})`}>
            <Table<LiveRecord>
              rowKey="id"
              size="small"
              dataSource={liveRecords}
              pagination={false}
              scroll={{ x: 860 }}
              columns={[
                { title: '直播时间', dataIndex: 'live_date', render: displayDateTime },
                { title: '平台', dataIndex: 'platform', render: () => '快手' },
                { title: '直播间', dataIndex: 'live_room', render: (value) => value || '-' },
                { title: '时长', dataIndex: 'duration_minutes', render: (value) => value == null ? '-' : `${value} 分钟` },
                { title: '观看', dataIndex: 'viewers_count', render: displayNumber },
                { title: '新增粉丝', dataIndex: 'new_followers', render: displayNumber },
                { title: 'GMV', dataIndex: 'gmv', render: displayMoney },
                { title: '订单', dataIndex: 'orders_count', render: displayNumber },
                { title: '转化率', dataIndex: 'conversion_rate', render: displayPercent },
              ]}
            />
          </Card>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 16 }}>
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')} style={{ marginBottom: 16 }}>
        返回
      </Button>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card
            title="基本信息"
            extra={
              <Space wrap>
                <Button size="small" icon={<EditOutlined />} onClick={() => navigate(`/anchor/${id}/edit`)}>
                  编辑
                </Button>
                <Popconfirm title="确定删除该主播？" onConfirm={handleDelete}>
                  <Button size="small" danger icon={<DeleteOutlined />}>
                    删除
                  </Button>
                </Popconfirm>
              </Space>
            }
          >
            <Descriptions column={{ xs: 1, sm: 2 }} size="small">
              <Descriptions.Item label="艺名">{anchor.stage_name}</Descriptions.Item>
              <Descriptions.Item label="真实姓名">{anchor.name}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={STATUS_COLORS[anchor.status]}>{STATUS_LABELS[anchor.status]}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="主播评级">
                {anchor.grade ? <Tag color="gold">{anchor.grade}级</Tag> : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="成长阶段">
                {(() => {
                  const stage = computeStage(anchor.hire_date, anchor.growth_stage);
                  return stage ? (
                    <Tag color={STAGE_COLORS[stage]}>{STAGE_LABELS[stage]}</Tag>
                  ) : '-';
                })()}
              </Descriptions.Item>
              <Descriptions.Item label="平台">快手</Descriptions.Item>
              <Descriptions.Item label="快手账号">{anchor.kuaishou_account || '-'}</Descriptions.Item>
              <Descriptions.Item label="性别">{anchor.gender || '-'}</Descriptions.Item>
              <Descriptions.Item label="年龄">{anchor.age ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="联系电话">{anchor.phone || '-'}</Descriptions.Item>
              <Descriptions.Item label="微信号">{anchor.wechat || '-'}</Descriptions.Item>
              <Descriptions.Item label="身份证号">{anchor.id_card || '-'}</Descriptions.Item>
              <Descriptions.Item label="所在城市">{anchor.city || '-'}</Descriptions.Item>
              <Descriptions.Item label="通勤情况">{anchor.commute_distance || '-'}</Descriptions.Item>
              <Descriptions.Item label="婚姻状况">{anchor.marital_status || '-'}</Descriptions.Item>
              <Descriptions.Item label="子女情况">{anchor.has_children || '-'}</Descriptions.Item>
              <Descriptions.Item label="入职日期">{anchor.hire_date || '-'}</Descriptions.Item>
              <Descriptions.Item label="离职日期">{anchor.leave_date || '-'}</Descriptions.Item>
              <Descriptions.Item label="评级说明" span={2}>{anchor.grade_note || '-'}</Descriptions.Item>
              <Descriptions.Item label="备注" span={2}>{anchor.remark || '-'}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            title="成长轨迹"
            extra={
              timeline.length > 0 && (
                <Dropdown menu={{ items: exportItems }}>
                  <Button size="small" icon={<ExportOutlined />}>
                    导出 <DownOutlined />
                  </Button>
                </Dropdown>
              )
            }
          >
            <Select
              placeholder="筛选节点类型"
              allowClear
              value={filterType}
              onChange={setFilterType}
              style={{ width: '100%', marginBottom: 16 }}
              size="small"
            >
              {NODE_TYPE_LIST.map((type) => (
                <Option key={type} value={type}>{NODE_TYPE_LABELS[type]}</Option>
              ))}
            </Select>
            <Timeline
              items={timeline.map((node) => ({
                color: NODE_TYPE_COLORS[node.type],
                children: (
                  <div
                    onClick={() => navigate(`/node/${node.id}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div style={{ fontWeight: 500, fontSize: 14 }}>{node.title}</div>
                    <div style={{ color: '#999', fontSize: 12 }}>
                      {new Date(node.date).toLocaleString('zh-CN')} {node.location && `@ ${node.location}`}
                    </div>
                    <Tag color={NODE_TYPE_COLORS[node.type]} style={{ marginTop: 4, fontSize: 10 }}>
                      {NODE_TYPE_LABELS[node.type]}
                    </Tag>
                  </div>
                ),
              }))}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card
            title="直播数据"
            extra={
              <span style={{ color: '#86868B', fontSize: 12 }}>
                {anchor.live_stats?.session_count ? `${anchor.live_stats.session_count} 场自动统计` : '暂无直播记录'}
              </span>
            }
          >
            <Descriptions column={1} size="small">
              <Descriptions.Item label="粉丝数">{displayNumber(anchor.followers_count)}</Descriptions.Item>
              <Descriptions.Item label="平均直播时长">
                {anchor.live_stats?.avg_duration_minutes != null ? `${anchor.live_stats.avg_duration_minutes} 分钟` : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="场均观看">{displayNumber(anchor.live_stats?.avg_viewers ?? undefined)}</Descriptions.Item>
              <Descriptions.Item label="场均GMV">{displayMoney(anchor.live_stats?.avg_gmv ?? undefined)}</Descriptions.Item>
              <Descriptions.Item label="平均转化率">{displayPercent(anchor.live_stats?.avg_conversion_rate ?? undefined)}</Descriptions.Item>
              <Descriptions.Item label="累计 GMV">{displayMoney(anchor.live_stats?.total_gmv)}</Descriptions.Item>
              <Descriptions.Item label="累计订单">{displayNumber(anchor.live_stats?.total_orders_count)}</Descriptions.Item>
              <Descriptions.Item label="直播带来粉丝">{displayNumber(anchor.live_stats?.total_new_followers)}</Descriptions.Item>
              <Descriptions.Item label="最近直播">
                {anchor.live_stats?.last_live_date ? new Date(anchor.live_stats.last_live_date).toLocaleString('zh-CN') : '-'}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="财务与标签">
            <Descriptions column={1} size="small">
              <Descriptions.Item label="开户行">{anchor.bank_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="银行卡号">{anchor.bank_card_number || '-'}</Descriptions.Item>
              <Descriptions.Item label="账户姓名">{anchor.bank_account_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="紧急联系人">
                {anchor.emergency_contact_name || '-'} {anchor.emergency_contact_relation ? `(${anchor.emergency_contact_relation})` : ''}
              </Descriptions.Item>
              <Descriptions.Item label="联系人电话">{anchor.emergency_contact_phone || '-'}</Descriptions.Item>
              <Descriptions.Item label="层级标签">{anchor.level_tags || '-'}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
      </Row>

      <Card title="关联业务" style={{ marginTop: 16 }}>
        <Tabs items={relatedTabItems} />
      </Card>

      <Card
        title="节点列表"
        style={{ marginTop: 16 }}
        extra={
          <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => setNodeModalVisible(true)}>
            添加节点
          </Button>
        }
      >
        {nodes.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#999', padding: 24 }}>暂无节点数据</div>
        ) : (
          <Row gutter={[12, 12]}>
            {nodes.map((node) => (
              <Col key={node.id} xs={24} sm={12} md={8}>
                <Card
                  size="small"
                  hoverable
                  onClick={() => navigate(`/node/${node.id}`)}
                  extra={
                    <Popconfirm title="确定删除该节点？" onConfirm={(e) => { e?.stopPropagation(); handleDeleteNode(node.id); }}>
                      <DeleteOutlined onClick={(e) => e.stopPropagation()} />
                    </Popconfirm>
                  }
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <Tag color={NODE_TYPE_COLORS[node.type]} style={{ fontSize: 10 }}>{NODE_TYPE_LABELS[node.type]}</Tag>
                      <div style={{ fontWeight: 500, marginTop: 4, fontSize: 14 }}>{node.title}</div>
                      <div style={{ color: '#999', fontSize: 12 }}>
                        {new Date(node.date).toLocaleString('zh-CN')}
                      </div>
                    </div>
                    {node.files.length > 0 && (
                      <PaperClipOutlined style={{ fontSize: 16, color: '#999' }} />
                    )}
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </Card>

      <NodeFormModal
        visible={nodeModalVisible}
        anchorId={id!}
        onClose={() => setNodeModalVisible(false)}
        onSuccess={() => {
          setNodeModalVisible(false);
          fetchData();
        }}
      />
    </div>
  );
}
