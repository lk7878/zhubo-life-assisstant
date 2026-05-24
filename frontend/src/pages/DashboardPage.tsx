import { useEffect, useState } from 'react';
import { Card, Col, Row, Select, Spin, Statistic, Table, Tag, message } from 'antd';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { dashboardApi } from '../api';
import { STAGE_COLORS, STAGE_LABELS, STATUS_LABELS } from '../types';
import type { AnchorStage, AnchorStatus } from '../types';

interface DashboardOverview {
  period: {
    days: number;
    start_at: string;
    end_at: string;
  };
  anchors: {
    total: number;
    status_counts: Record<string, number>;
    stage_counts: Record<string, number>;
    active_total: number;
    onboarding_total: number;
  };
  live: {
    session_count: number;
    total_duration_minutes: number;
    total_gmv: number;
    total_orders: number;
    total_new_followers: number;
    avg_viewers: number;
    avg_conversion_rate: number;
    top_anchors: Array<{
      anchor_id: string;
      stage_name: string;
      name: string;
      session_count: number;
      total_gmv: number;
      total_orders: number;
    }>;
    recent_records: Array<{
      id: string;
      anchor_id: string;
      stage_name: string;
      platform?: string | null;
      live_room?: string | null;
      live_date?: string | null;
      duration_minutes?: number | null;
      viewers_count?: number | null;
      gmv: number;
      orders_count?: number | null;
    }>;
  };
  salary: {
    month_total_payable: number;
    month_commission: number;
    month_record_count: number;
    pending_total_payable: number;
  };
  contracts: {
    status_counts: Record<string, number>;
    expiring_soon_total: number;
  };
  trainings: {
    status_counts: Record<string, number>;
    upcoming_total: number;
  };
  assets: {
    live_room_status_counts: Record<string, number>;
    equipment_status_counts: Record<string, number>;
    active_loans: number;
    overdue_loans: number;
    active_rooms: number;
  };
}

const STAGE_COLOR_HEX: Record<string, string> = {
  cyan: '#13c2c2',
  blue: '#1677ff',
  geekblue: '#2f54eb',
  gold: '#faad14',
  default: '#d9d9d9',
};

export default function DashboardPage() {
  const [days, setDays] = useState(30);
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchOverview = async () => {
    setLoading(true);
    try {
      const data = await dashboardApi.overview<DashboardOverview>(days);
      setOverview(data);
    } catch (error) {
      message.error((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, [days]);

  const displayNumber = (value?: number | null) => value == null ? '-' : value.toLocaleString('zh-CN');
  const displayMoney = (value?: number | null) => value == null ? '-' : `¥${value.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`;
  const displayDateTime = (value?: string | null) => value ? new Date(value).toLocaleString('zh-CN') : '-';

  if (loading && !overview) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <Spin size="large" />
      </div>
    );
  }

  const stageData = overview ? Object.entries(overview.anchors.stage_counts).map(([key, value]) => ({
    name: STAGE_LABELS[key as AnchorStage] || key,
    value,
    color: STAGE_COLOR_HEX[STAGE_COLORS[key as AnchorStage] || 'default'],
  })) : [];

  const statusData = overview ? Object.entries(overview.anchors.status_counts).map(([key, value]) => ({
    name: STATUS_LABELS[key as AnchorStatus] || key,
    value,
  })) : [];

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0 }}>经营看板</h2>
          <div style={{ color: '#86868B', fontSize: 13 }}>
            {overview ? `${displayDateTime(overview.period.start_at)} 至 ${displayDateTime(overview.period.end_at)}` : '加载中'}
          </div>
        </div>
        <Select
          value={days}
          onChange={setDays}
          options={[
            { label: '近 7 天', value: 7 },
            { label: '近 30 天', value: 30 },
            { label: '近 90 天', value: 90 },
          ]}
          style={{ width: 120 }}
        />
      </div>

      <Spin spinning={loading}>
        <Row gutter={[16, 16]}>
          <Col xs={12} lg={6}>
            <Card>
              <Statistic title="主播总数" value={overview?.anchors.total || 0} suffix="人" />
            </Card>
          </Col>
          <Col xs={12} lg={6}>
            <Card>
              <Statistic title="活跃主播" value={overview?.anchors.active_total || 0} suffix="人" />
            </Card>
          </Col>
          <Col xs={12} lg={6}>
            <Card>
              <Statistic title={`近 ${days} 天 GMV`} value={overview?.live.total_gmv || 0} precision={2} prefix="¥" />
            </Card>
          </Col>
          <Col xs={12} lg={6}>
            <Card>
              <Statistic title="直播场次" value={overview?.live.session_count || 0} suffix="场" />
            </Card>
          </Col>
          <Col xs={12} lg={6}>
            <Card>
              <Statistic title="本月应发薪资" value={overview?.salary.month_total_payable || 0} precision={2} prefix="¥" />
            </Card>
          </Col>
          <Col xs={12} lg={6}>
            <Card>
              <Statistic title="待发薪资" value={overview?.salary.pending_total_payable || 0} precision={2} prefix="¥" />
            </Card>
          </Col>
          <Col xs={12} lg={6}>
            <Card>
              <Statistic title="30天到期合同" value={overview?.contracts.expiring_soon_total || 0} suffix="份" />
            </Card>
          </Col>
          <Col xs={12} lg={6}>
            <Card>
              <Statistic title="逾期资产" value={overview?.assets.overdue_loans || 0} suffix="件" valueStyle={{ color: (overview?.assets.overdue_loans || 0) > 0 ? '#cf1322' : undefined }} />
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} lg={8}>
            <Card title="成长阶段分布">
              <div style={{ height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={stageData} dataKey="value" nameKey="name" outerRadius={88} label>
                      {stageData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </Col>
          <Col xs={24} lg={8}>
            <Card title="主播状态分布">
              <div style={{ height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statusData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#1677ff" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </Col>
          <Col xs={24} lg={8}>
            <Card title="运营概况">
              <Row gutter={[12, 12]}>
                <Col span={12}><Statistic title="新增粉丝" value={overview?.live.total_new_followers || 0} /></Col>
                <Col span={12}><Statistic title="订单数" value={overview?.live.total_orders || 0} /></Col>
                <Col span={12}><Statistic title="场均观看" value={overview?.live.avg_viewers || 0} precision={2} /></Col>
                <Col span={12}><Statistic title="平均转化率" value={overview?.live.avg_conversion_rate || 0} suffix="%" precision={2} /></Col>
                <Col span={12}><Statistic title="待培训" value={overview?.trainings.upcoming_total || 0} /></Col>
                <Col span={12}><Statistic title="借用中资产" value={overview?.assets.active_loans || 0} /></Col>
              </Row>
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} lg={12}>
            <Card title={`近 ${days} 天 GMV Top 主播`}>
              <Table
                rowKey="anchor_id"
                size="small"
                dataSource={overview?.live.top_anchors || []}
                pagination={false}
                columns={[
                  { title: '主播', dataIndex: 'stage_name' },
                  { title: '场次', dataIndex: 'session_count', render: displayNumber },
                  { title: 'GMV', dataIndex: 'total_gmv', render: displayMoney },
                  { title: '订单', dataIndex: 'total_orders', render: displayNumber },
                ]}
              />
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card title="近期直播记录">
              <Table
                rowKey="id"
                size="small"
                dataSource={overview?.live.recent_records || []}
                pagination={false}
                columns={[
                  { title: '时间', dataIndex: 'live_date', render: displayDateTime },
                  { title: '主播', dataIndex: 'stage_name' },
                  { title: '平台', dataIndex: 'platform', render: (value) => value || '-' },
                  { title: 'GMV', dataIndex: 'gmv', render: displayMoney },
                  { title: '订单', dataIndex: 'orders_count', render: displayNumber },
                ]}
              />
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} lg={8}>
            <Card title="合同状态">
              {Object.entries(overview?.contracts.status_counts || {}).map(([key, value]) => (
                <Tag key={key} style={{ marginBottom: 8 }}>{key}: {value}</Tag>
              ))}
            </Card>
          </Col>
          <Col xs={24} lg={8}>
            <Card title="资产状态">
              {Object.entries(overview?.assets.equipment_status_counts || {}).map(([key, value]) => (
                <Tag key={key} style={{ marginBottom: 8 }}>{key}: {value}</Tag>
              ))}
            </Card>
          </Col>
          <Col xs={24} lg={8}>
            <Card title="直播间状态">
              {Object.entries(overview?.assets.live_room_status_counts || {}).map(([key, value]) => (
                <Tag key={key} style={{ marginBottom: 8 }}>{key}: {value}</Tag>
              ))}
            </Card>
          </Col>
        </Row>
      </Spin>
    </div>
  );
}
