import { useEffect, useState } from 'react';
import { Card, Table, Tag, Select, Button, Space, Spin, Empty, message } from 'antd';
import { ExportOutlined, ReloadOutlined } from '@ant-design/icons';
import { historyApi } from '../api';

const ACTION_LABELS: Record<string, string> = {
  'create': '创建',
  'update': '更新',
  'delete': '删除',
};

const ACTION_COLORS: Record<string, string> = {
  'create': 'green',
  'update': 'blue',
  'delete': 'red',
};

const TARGET_TYPE_LABELS: Record<string, string> = {
  'anchor': '主播',
  'node': '节点',
  'file': '文件',
  'live_record': '直播记录',
  'training': '培训',
  'attendance': '签到',
  'salary_config': '薪资配置',
  'salary_record': '结算单',
  'contract': '合同',
  'live_room': '直播间',
  'equipment': '设备',
  'equipment_loan': '设备借用',
};

interface LogItem {
  id: string;
  operator: string;
  action: string;
  target_type: string;
  target_id: string | null;
  target_name: string | null;
  details: string | null;
  ip_address?: string | null;
  created_at: string;
}

export default function LogsPage() {
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<string | undefined>();
  const [targetType, setTargetType] = useState<string | undefined>();

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await historyApi.list({ action, target_type: targetType });
      setLogs(data.items);
      setTotal(data.total);
    } catch (error) {
      message.error((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [action, targetType]);

  const handleExport = () => {
    const dataToExport = logs.map(log => ({
      '时间': new Date(log.created_at).toLocaleString('zh-CN'),
      '操作': ACTION_LABELS[log.action] || log.action,
      '对象类型': TARGET_TYPE_LABELS[log.target_type] || log.target_type,
      '对象名称': log.target_name || '',
      '操作人': log.operator,
      'IP': log.ip_address || '',
      '详情': log.details || '',
    }));

    const headers = Object.keys(dataToExport[0] || {}).join(',');
    const rows = dataToExport.map(row => Object.values(row).map(v => `"${v}"`).join(','));
    const content = [headers, ...rows].join('\n');

    const blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `operation_logs_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    message.success('已导出操作日志');
  };

  const columns = [
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (text: string) => new Date(text).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      dataIndex: 'action',
      key: 'action',
      width: 80,
      render: (text: string) => (
        <Tag color={ACTION_COLORS[text]}>{ACTION_LABELS[text] || text}</Tag>
      ),
    },
    {
      title: '对象类型',
      dataIndex: 'target_type',
      key: 'target_type',
      width: 100,
      render: (text: string) => TARGET_TYPE_LABELS[text] || text,
    },
    {
      title: '对象名称',
      dataIndex: 'target_name',
      key: 'target_name',
      ellipsis: true,
    },
    {
      title: '操作人',
      dataIndex: 'operator',
      key: 'operator',
      width: 100,
    },
    {
      title: 'IP 地址',
      dataIndex: 'ip_address',
      key: 'ip_address',
      width: 130,
      render: (text: string | null) => text || '-',
    },
    {
      title: '详情',
      dataIndex: 'details',
      key: 'details',
      ellipsis: true,
    },
  ];

  return (
    <div style={{ padding: 16 }}>
      <Card
        title="操作日志"
        extra={
          <Space wrap>
            <Select
              placeholder="操作类型"
              allowClear
              value={action}
              onChange={setAction}
              style={{ width: 120 }}
              size="small"
            >
              <Select.Option value="create">创建</Select.Option>
              <Select.Option value="update">更新</Select.Option>
              <Select.Option value="delete">删除</Select.Option>
            </Select>
            <Select
              placeholder="对象类型"
              allowClear
              value={targetType}
              onChange={setTargetType}
              style={{ width: 120 }}
              size="small"
            >
              <Select.Option value="anchor">主播</Select.Option>
              <Select.Option value="node">节点</Select.Option>
              <Select.Option value="file">文件</Select.Option>
            </Select>
            <Button icon={<ReloadOutlined />} size="small" onClick={fetchLogs}>
              刷新
            </Button>
            {logs.length > 0 && (
              <Button icon={<ExportOutlined />} size="small" onClick={handleExport}>
                导出
              </Button>
            )}
          </Space>
        }
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: 50 }}>
            <Spin size="large" />
          </div>
        ) : logs.length === 0 ? (
          <Empty description="暂无操作日志" />
        ) : (
          <Table
            dataSource={logs}
            columns={columns}
            rowKey="id"
            pagination={{
              total,
              pageSize: 20,
              showTotal: (t) => `共 ${t} 条`,
              showSizeChanger: false,
            }}
            size="small"
            scroll={{ x: 800 }}
          />
        )}
      </Card>
    </div>
  );
}