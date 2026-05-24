import { useEffect, useState } from 'react';
import {
  Drawer, Descriptions, Tag, Button, Space, Table, Select, message, Popconfirm,
  Empty, Modal, Statistic, Row, Col, Spin, InputNumber, Input,
} from 'antd';
import {
  UserAddOutlined, DeleteOutlined, ReloadOutlined, LineChartOutlined, EditOutlined,
} from '@ant-design/icons';
import { trainingsApi, anchorsApi } from '../api';
import {
  type TrainingDetail, type TrainingAttendance, type TrainingEffectResponse, type Anchor,
  TRAINING_TYPE_LABELS, TRAINING_TYPE_COLORS,
  TRAINING_MODE_LABELS, TRAINING_STATUS_LABELS, TRAINING_STATUS_COLORS,
  ATTENDANCE_STATUS_LABELS, ATTENDANCE_STATUS_COLORS, AttendanceStatus,
} from '../types';

const { TextArea } = Input;

interface Props {
  open: boolean;
  trainingId: string | null;
  onClose: () => void;
  onChanged: () => void;   // 详情有改动时通知列表刷新
}

export default function TrainingDetailDrawer({ open, trainingId, onClose, onChanged }: Props) {
  const [detail, setDetail] = useState<TrainingDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [anchorOptions, setAnchorOptions] = useState<{ label: string; value: string }[]>([]);
  const [pickedAnchorIds, setPickedAnchorIds] = useState<string[]>([]);

  const [effect, setEffect] = useState<TrainingEffectResponse | null>(null);
  const [effectLoading, setEffectLoading] = useState(false);
  const [effectWindow, setEffectWindow] = useState(7);
  const [effectAttendanceId, setEffectAttendanceId] = useState<string | null>(null);

  const [noteEditing, setNoteEditing] = useState<TrainingAttendance | null>(null);
  const [preNote, setPreNote] = useState('');
  const [postNote, setPostNote] = useState('');
  const [scoreVal, setScoreVal] = useState<number | null>(null);

  const fetchDetail = async () => {
    if (!trainingId) return;
    setLoading(true);
    try {
      const d = await trainingsApi.get(trainingId);
      setDetail(d);
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && trainingId) {
      setDetail(null);
      setEffect(null);
      setEffectAttendanceId(null);
      fetchDetail();
    }
  }, [open, trainingId]);

  const reloadAndNotify = async () => {
    await fetchDetail();
    onChanged();
  };

  const fetchAnchors = async (keyword?: string) => {
    const list = await anchorsApi.list({ search: keyword, limit: 50 });
    const existing = new Set((detail?.attendances || []).map(a => a.anchor_id));
    const opts = list.items
      .filter((a: Anchor) => !existing.has(a.id))
      .map((a: Anchor) => ({ label: `${a.stage_name}（${a.name}）`, value: a.id }));
    setAnchorOptions(opts);
  };

  const handleAddAttendances = async () => {
    if (!trainingId || pickedAnchorIds.length === 0) {
      setAddOpen(false);
      return;
    }
    try {
      await trainingsApi.addAttendances(trainingId, pickedAnchorIds);
      message.success(`已添加 ${pickedAnchorIds.length} 名主播`);
      setAddOpen(false);
      setPickedAnchorIds([]);
      await reloadAndNotify();
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const handleAttendanceStatus = async (attendanceId: string, status: AttendanceStatus) => {
    try {
      await trainingsApi.updateAttendance(attendanceId, { status });
      message.success('已更新签到状态');
      await reloadAndNotify();
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const handleDeleteAttendance = async (attendanceId: string) => {
    try {
      await trainingsApi.deleteAttendance(attendanceId);
      message.success('已移除');
      await reloadAndNotify();
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const handleViewEffect = async (attendance: TrainingAttendance, days = effectWindow) => {
    setEffectLoading(true);
    setEffectAttendanceId(attendance.id);
    try {
      const r = await trainingsApi.effect(attendance.id, days);
      setEffect(r);
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setEffectLoading(false);
    }
  };

  const handleSaveNote = async () => {
    if (!noteEditing) return;
    try {
      await trainingsApi.updateAttendance(noteEditing.id, {
        pre_training_note: preNote || null,
        post_training_note: postNote || null,
        score: scoreVal,
      });
      message.success('已保存');
      setNoteEditing(null);
      await reloadAndNotify();
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const openNoteEditor = (a: TrainingAttendance) => {
    setNoteEditing(a);
    setPreNote(a.pre_training_note || '');
    setPostNote(a.post_training_note || '');
    setScoreVal(a.score ?? null);
  };

  const attendanceColumns = [
    {
      title: '主播',
      key: 'anchor',
      render: (_: any, r: TrainingAttendance) => (
        <span>{r.anchor_stage_name || r.anchor_name || r.anchor_id.slice(0, 8)}</span>
      ),
    },
    {
      title: '签到状态',
      dataIndex: 'status',
      width: 130,
      render: (s: AttendanceStatus, r: TrainingAttendance) => (
        <Select
          size="small"
          value={s}
          style={{ width: 110 }}
          onChange={(v) => handleAttendanceStatus(r.id, v)}
        >
          {Object.entries(ATTENDANCE_STATUS_LABELS).map(([k, v]) => (
            <Select.Option key={k} value={k}>
              <Tag color={ATTENDANCE_STATUS_COLORS[k as AttendanceStatus]} style={{ marginRight: 0 }}>
                {v}
              </Tag>
            </Select.Option>
          ))}
        </Select>
      ),
    },
    {
      title: '签到时间',
      dataIndex: 'check_in_time',
      width: 160,
      render: (t: string | null) => t ? new Date(t).toLocaleString('zh-CN') : '-',
    },
    {
      title: '成绩',
      dataIndex: 'score',
      width: 70,
      render: (v: number | null) => v ?? '-',
    },
    {
      title: '操作',
      key: 'actions',
      width: 220,
      render: (_: any, r: TrainingAttendance) => (
        <Space size={4}>
          <Button size="small" icon={<EditOutlined />} onClick={() => openNoteEditor(r)}>反馈</Button>
          <Button size="small" icon={<LineChartOutlined />} onClick={() => handleViewEffect(r)}>效果</Button>
          <Popconfirm title="确定移除该主播？" onConfirm={() => handleDeleteAttendance(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={detail ? `培训详情 · ${detail.title}` : '培训详情'}
      width={880}
      destroyOnHidden
    >
      {loading || !detail ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spin /></div>
      ) : (
        <>
          <Descriptions size="small" bordered column={2} style={{ marginBottom: 16 }}>
            <Descriptions.Item label="主题" span={2}>{detail.title}</Descriptions.Item>
            <Descriptions.Item label="类型">
              <Tag color={TRAINING_TYPE_COLORS[detail.training_type]}>{TRAINING_TYPE_LABELS[detail.training_type]}</Tag>
              {detail.is_compliance ? <Tag color="red">合规</Tag> : null}
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={TRAINING_STATUS_COLORS[detail.status]}>{TRAINING_STATUS_LABELS[detail.status]}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="模式">{TRAINING_MODE_LABELS[detail.mode]}</Descriptions.Item>
            <Descriptions.Item label="培训师">{detail.trainer || '-'}</Descriptions.Item>
            <Descriptions.Item label="开始时间">{new Date(detail.start_time).toLocaleString('zh-CN')}</Descriptions.Item>
            <Descriptions.Item label="结束时间">{detail.end_time ? new Date(detail.end_time).toLocaleString('zh-CN') : '-'}</Descriptions.Item>
            <Descriptions.Item label="地点">{detail.location || '-'}</Descriptions.Item>
            <Descriptions.Item label="时长">{detail.duration_minutes ? `${detail.duration_minutes} 分钟` : '-'}</Descriptions.Item>
            <Descriptions.Item label="培训内容" span={2}>{detail.description || '-'}</Descriptions.Item>
            <Descriptions.Item label="资料" span={2}>{detail.materials || '-'}</Descriptions.Item>
            <Descriptions.Item label="备注" span={2}>{detail.remark || '-'}</Descriptions.Item>
          </Descriptions>

          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={6}><Statistic title="参训人数" value={detail.attendance_count} /></Col>
            <Col span={6}><Statistic title="已签到" value={detail.checked_in_count} /></Col>
            <Col span={6}><Statistic title="出勤率" value={detail.attendance_count ? Math.round(detail.checked_in_count * 100 / detail.attendance_count) : 0} suffix="%" /></Col>
          </Row>

          <Space style={{ marginBottom: 12 }}>
            <Button type="primary" icon={<UserAddOutlined />} onClick={async () => { setAddOpen(true); await fetchAnchors(); }}>
              添加参训主播
            </Button>
            <Button icon={<ReloadOutlined />} onClick={fetchDetail}>刷新</Button>
          </Space>

          {detail.attendances.length === 0 ? (
            <Empty description="暂无参训主播" />
          ) : (
            <Table
              size="small"
              rowKey="id"
              dataSource={detail.attendances}
              columns={attendanceColumns}
              pagination={false}
            />
          )}

          {effectAttendanceId && (
            <div style={{ marginTop: 24, padding: 16, background: '#FAFAFA', borderRadius: 8 }}>
              <Space style={{ marginBottom: 12 }} align="center">
                <strong>培训前后直播数据对比</strong>
                <span style={{ color: '#86868B', fontSize: 12 }}>窗口（天）</span>
                <InputNumber
                  size="small"
                  min={1}
                  max={60}
                  value={effectWindow}
                  onChange={(v) => setEffectWindow(v || 7)}
                  style={{ width: 80 }}
                />
                <Button
                  size="small"
                  onClick={() => {
                    const a = detail.attendances.find(x => x.id === effectAttendanceId);
                    if (a) handleViewEffect(a, effectWindow);
                  }}
                >重新计算</Button>
              </Space>
              {effectLoading || !effect ? (
                <Spin />
              ) : (
                <>
                  <div style={{ marginBottom: 8, color: '#86868B', fontSize: 13 }}>
                    {effect.anchor_name} · 培训前 {effect.sessions_before} 场 / 培训后 {effect.sessions_after} 场
                  </div>
                  <Table
                    size="small"
                    rowKey="label"
                    pagination={false}
                    dataSource={effect.metrics}
                    columns={[
                      { title: '指标', dataIndex: 'label' },
                      { title: '培训前', dataIndex: 'before', render: (v) => v ?? '-' },
                      { title: '培训后', dataIndex: 'after', render: (v) => v ?? '-' },
                      {
                        title: '变化',
                        dataIndex: 'delta',
                        render: (d: number | null, r: any) => {
                          if (d === null || d === undefined) return '-';
                          const color = d > 0 ? '#34C759' : d < 0 ? '#FF3B30' : '#86868B';
                          const pct = r.delta_pct != null ? ` (${r.delta_pct > 0 ? '+' : ''}${r.delta_pct}%)` : '';
                          return <span style={{ color }}>{d > 0 ? '+' : ''}{d}{pct}</span>;
                        },
                      },
                    ]}
                  />
                </>
              )}
            </div>
          )}
        </>
      )}

      {/* 添加参训主播 */}
      <Modal
        title="添加参训主播"
        open={addOpen}
        onCancel={() => { setAddOpen(false); setPickedAnchorIds([]); }}
        onOk={handleAddAttendances}
        okButtonProps={{ disabled: pickedAnchorIds.length === 0 }}
      >
        <Select
          mode="multiple"
          showSearch
          filterOption={false}
          placeholder="搜索主播"
          style={{ width: '100%' }}
          options={anchorOptions}
          value={pickedAnchorIds}
          onChange={setPickedAnchorIds}
          onSearch={(kw) => fetchAnchors(kw)}
        />
      </Modal>

      {/* 培训前后笔记 + 成绩 */}
      <Modal
        title={`培训反馈 · ${noteEditing?.anchor_stage_name || ''}`}
        open={!!noteEditing}
        onCancel={() => setNoteEditing(null)}
        onOk={handleSaveNote}
        width={620}
      >
        <div style={{ display: 'grid', gap: 12 }}>
          <div>
            <div style={{ marginBottom: 4, color: '#1D1D1F' }}>培训前记录</div>
            <TextArea rows={3} value={preNote} onChange={(e) => setPreNote(e.target.value)} placeholder="入学水平 / 待解决问题" />
          </div>
          <div>
            <div style={{ marginBottom: 4, color: '#1D1D1F' }}>培训后跟踪</div>
            <TextArea rows={3} value={postNote} onChange={(e) => setPostNote(e.target.value)} placeholder="掌握程度 / 后续需要强化的点" />
          </div>
          <div>
            <div style={{ marginBottom: 4, color: '#1D1D1F' }}>培训成绩（可选）</div>
            <InputNumber min={0} max={100} value={scoreVal ?? undefined} onChange={(v) => setScoreVal(v ?? null)} style={{ width: 120 }} />
          </div>
        </div>
      </Modal>
    </Drawer>
  );
}
