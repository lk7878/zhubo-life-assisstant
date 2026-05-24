import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input, Button, Row, Col, Tag, Spin, Empty, Dropdown, message, Avatar } from 'antd';
import { PlusOutlined, SearchOutlined, ExportOutlined, UserOutlined } from '@ant-design/icons';
import { useAnchorStore } from '../stores/anchorStore';
import { AnchorStatus, STATUS_LABELS, STAGE_LABELS, STAGE_COLORS, computeStage } from '../types';

const { Search } = Input;

export default function AnchorListPage() {
  const navigate = useNavigate();
  const { anchors, total, loading, search, status, setSearch, setStatus, fetchAnchors } = useAnchorStore();

  useEffect(() => {
    fetchAnchors();
  }, []);

  const handleExport = (type: 'csv' | 'json') => {
    const dataToExport = anchors.map(a => ({
      '真实姓名': a.name,
      '艺名': a.stage_name,
      '平台': '快手',
      '状态': STATUS_LABELS[a.status],
      '主播评级': a.grade || '',
      '联系电话': a.phone || '',
      '微信号': a.wechat || '',
      '身份证号': a.id_card || '',
      '性别': a.gender || '',
      '年龄': a.age ?? '',
      '所在城市': a.city || '',
      '通勤情况': a.commute_distance || '',
      '婚姻状况': a.marital_status || '',
      '子女情况': a.has_children || '',
      '快手账号': a.kuaishou_account || '',
      '粉丝数': a.followers_count ?? '',
      '场均观看': a.average_viewers ?? '',
      '场均GMV': a.average_gmv ?? '',
      '转化率': a.conversion_rate ?? '',
      '粉丝增长': a.fan_growth ?? '',
      '开户行': a.bank_name || '',
      '银行卡号': a.bank_card_number || '',
      '账户姓名': a.bank_account_name || '',
      '紧急联系人': a.emergency_contact_name || '',
      '联系人关系': a.emergency_contact_relation || '',
      '联系人电话': a.emergency_contact_phone || '',
      '层级标签': a.level_tags || '',
      '评级说明': a.grade_note || '',
      '入职日期': a.hire_date || '',
      '离职日期': a.leave_date || '',
      '备注': a.remark || '',
    }));

    let content: string;
    let filename: string;
    let mimeType: string;

    if (type === 'csv') {
      const headers = Object.keys(dataToExport[0] || {}).join(',');
      const rows = dataToExport.map(row => Object.values(row).map(v => `"${v}"`).join(','));
      content = [headers, ...rows].join('\n');
      filename = `anchors_${Date.now()}.csv`;
      mimeType = 'text/csv;charset=utf-8;';
    } else {
      content = JSON.stringify(dataToExport, null, 2);
      filename = `anchors_${Date.now()}.json`;
      mimeType = 'application/json;charset=utf-8;';
    }

    const blob = new Blob(['\ufeff' + content], { type: mimeType });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
    message.success(`已导出 ${type.toUpperCase()} 文件`);
  };

  const exportItems = [
    { key: 'csv', label: '导出 CSV', icon: <ExportOutlined /> },
    { key: 'json', label: '导出 JSON', icon: <ExportOutlined /> },
  ];

  // Apple 风格状态颜色映射
  const getStatusStyle = (status: AnchorStatus) => {
    switch (status) {
      case AnchorStatus.ACTIVE:
        return { background: 'rgba(52, 199, 89, 0.15)', color: '#34C759' };
      case AnchorStatus.ONBOARDING:
        return { background: 'rgba(255, 149, 0, 0.15)', color: '#FF9500' };
      case AnchorStatus.INACTIVE:
        return { background: 'rgba(142, 142, 147, 0.15)', color: '#8E8E93' };
      default:
        return { background: '#F2F2F7', color: '#1D1D1F' };
    }
  };

  return (
    <div>
      {/* 页面标题区 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 24
      }}>
        <h1 style={{
          fontSize: 28,
          fontWeight: 700,
          color: '#1D1D1F',
          margin: 0
        }}>
          主播列表
        </h1>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate('/anchor/new')}
          style={{
            height: 36,
            borderRadius: 10,
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: 4
          }}
        >
          新增主播
        </Button>
      </div>

      {/* Apple 风格筛选栏 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        marginBottom: 24,
        flexWrap: 'wrap'
      }}>
        {/* 搜索框 */}
        <Search
          placeholder="搜索主播..."
          prefix={<SearchOutlined style={{ color: '#86868B' }} />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
          style={{ width: 260, height: 40 }}
        />

        {/* 状态筛选器 */}
        <div className="apple-filter">
          <div
            className={`apple-filter__item ${!status ? 'apple-filter__item--active' : ''}`}
            onClick={() => setStatus(undefined)}
          >
            全部
          </div>
          <div
            className={`apple-filter__item ${status === AnchorStatus.ACTIVE ? 'apple-filter__item--active' : ''}`}
            onClick={() => setStatus(AnchorStatus.ACTIVE)}
          >
            活跃
          </div>
          <div
            className={`apple-filter__item ${status === AnchorStatus.ONBOARDING ? 'apple-filter__item--active' : ''}`}
            onClick={() => setStatus(AnchorStatus.ONBOARDING)}
          >
            待培养
          </div>
          <div
            className={`apple-filter__item ${status === AnchorStatus.INACTIVE ? 'apple-filter__item--active' : ''}`}
            onClick={() => setStatus(AnchorStatus.INACTIVE)}
          >
            已流失
          </div>
        </div>

        {/* 导出按钮 */}
        {anchors.length > 0 && (
          <Dropdown menu={{ items: exportItems, onClick: ({ key }) => handleExport(key as 'csv' | 'json') }}>
            <Button style={{ height: 36, borderRadius: 10 }}>
              <ExportOutlined /> 导出
            </Button>
          </Dropdown>
        )}
      </div>

      {/* 主播列表 */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 80 }}>
          <Spin size="large" />
        </div>
      ) : anchors.length === 0 ? (
        <Empty
          description="暂无主播数据"
          style={{ padding: 80 }}
        />
      ) : (
        <>
          <Row gutter={[16, 16]}>
            {anchors.map((anchor) => (
              <Col key={anchor.id} xs={24} sm={12} md={8} lg={6}>
                <div
                  onClick={() => navigate(`/anchor/${anchor.id}`)}
                  style={{
                    background: '#FFFFFF',
                    borderRadius: 12,
                    border: '1px solid #E5E5EA',
                    padding: 20,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  {/* 头像 */}
                  <Avatar
                    size={60}
                    src={anchor.avatar}
                    icon={<UserOutlined />}
                    style={{ flexShrink: 0 }}
                  />

                  {/* 信息 */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      marginBottom: 4
                    }}>
                      <span style={{
                        fontSize: 17,
                        fontWeight: 600,
                        color: '#1D1D1F'
                      }}>
                        {anchor.stage_name}
                      </span>
                      <Tag
                        style={{
                          ...getStatusStyle(anchor.status),
                          borderRadius: 13,
                          padding: '2px 10px',
                          fontSize: 11,
                          fontWeight: 600,
                          border: 'none',
                          margin: 0
                        }}
                      >
                        {STATUS_LABELS[anchor.status]}
                      </Tag>
                      {anchor.grade && (
                        <Tag color="gold" style={{ margin: 0 }}>
                          {anchor.grade}级
                        </Tag>
                      )}
                      {(() => {
                        const stage = computeStage(anchor.hire_date, anchor.growth_stage);
                        return stage ? (
                          <Tag color={STAGE_COLORS[stage]} style={{ margin: 0 }}>
                            {STAGE_LABELS[stage]}
                          </Tag>
                        ) : null;
                      })()}
                    </div>
                    <div style={{
                      fontSize: 13,
                      color: '#86868B',
                      marginBottom: 2
                    }}>
                      {anchor.name} · 快手
                    </div>
                    <div style={{
                      fontSize: 12,
                      color: '#AEAEB2',
                      marginBottom: 2
                    }}>
                      {anchor.city || '未设置城市'} · 粉丝 {anchor.followers_count?.toLocaleString('zh-CN') || '未填'}
                    </div>
                    {anchor.hire_date && (
                      <div style={{
                        fontSize: 12,
                        color: '#AEAEB2'
                      }}>
                        入职: {anchor.hire_date}
                      </div>
                    )}
                  </div>
                </div>
              </Col>
            ))}
          </Row>

          {/* 记录统计 */}
          <div style={{
            marginTop: 24,
            textAlign: 'right',
            color: '#86868B',
            fontSize: 13
          }}>
            共 {total} 条记录
          </div>
        </>
      )}
    </div>
  );
}