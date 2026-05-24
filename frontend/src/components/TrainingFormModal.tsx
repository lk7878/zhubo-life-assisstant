import { useEffect } from 'react';
import { Modal, Form, Input, Select, DatePicker, InputNumber, Switch, message } from 'antd';
import dayjs from 'dayjs';
import { trainingsApi, anchorsApi } from '../api';
import {
  TRAINING_TYPE_LABELS, TRAINING_MODE_LABELS, TRAINING_STATUS_LABELS,
  TrainingType, TrainingMode, TrainingStatus,
  type Training, type Anchor,
} from '../types';

const { TextArea } = Input;
const { Option } = Select;

interface Props {
  open: boolean;
  editing?: Training | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function TrainingFormModal({ open, editing, onClose, onSuccess }: Props) {
  const [form] = Form.useForm();
  const isEdit = Boolean(editing);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      form.setFieldsValue({
        ...editing,
        is_compliance: !!editing.is_compliance,
        start_time: editing.start_time ? dayjs(editing.start_time) : undefined,
        end_time: editing.end_time ? dayjs(editing.end_time) : undefined,
        anchor_ids: [],
      });
    } else {
      form.resetFields();
      form.setFieldsValue({
        training_type: TrainingType.SKILL,
        mode: TrainingMode.OFFLINE,
        status: TrainingStatus.PLANNED,
        is_compliance: false,
      });
    }
  }, [open, editing, form]);

  const fetchAnchors = async (search?: string) => {
    const list = await anchorsApi.list({ search, limit: 50 });
    return list.items.map((a: Anchor) => ({
      label: `${a.stage_name}（${a.name}）`,
      value: a.id,
    }));
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    const payload: any = {
      ...values,
      is_compliance: values.is_compliance ? 1 : 0,
      start_time: values.start_time ? values.start_time.toISOString() : undefined,
      end_time: values.end_time ? values.end_time.toISOString() : undefined,
    };

    // 自动算时长（分钟）
    if (values.start_time && values.end_time) {
      payload.duration_minutes = Math.max(0, values.end_time.diff(values.start_time, 'minute'));
    }

    try {
      if (isEdit && editing) {
        const { anchor_ids, ...rest } = payload;
        await trainingsApi.update(editing.id, rest);
        // 编辑场景下，如果选了新主播，加进去
        if (anchor_ids?.length) {
          await trainingsApi.addAttendances(editing.id, anchor_ids);
        }
        message.success('培训已更新');
      } else {
        await trainingsApi.create(payload);
        message.success('培训已创建');
      }
      onSuccess();
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  return (
    <Modal
      title={isEdit ? '编辑培训' : '新增培训'}
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      width={720}
      destroyOnHidden
    >
      <Form form={form} layout="vertical">
        <Form.Item name="title" label="培训主题" rules={[{ required: true, message: '请填写培训主题' }]}>
          <Input placeholder="例如：直播间话术专项培训" />
        </Form.Item>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <Form.Item name="training_type" label="培训类型" rules={[{ required: true }]}>
            <Select>
              {Object.entries(TRAINING_TYPE_LABELS).map(([k, v]) => (
                <Option key={k} value={k}>{v}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="mode" label="培训模式" rules={[{ required: true }]}>
            <Select>
              {Object.entries(TRAINING_MODE_LABELS).map(([k, v]) => (
                <Option key={k} value={k}>{v}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="status" label="状态" rules={[{ required: true }]}>
            <Select>
              {Object.entries(TRAINING_STATUS_LABELS).map(([k, v]) => (
                <Option key={k} value={k}>{v}</Option>
              ))}
            </Select>
          </Form.Item>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Form.Item name="start_time" label="开始时间" rules={[{ required: true, message: '请选开始时间' }]}>
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="end_time" label="结束时间">
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <Form.Item name="trainer" label="培训师">
            <Input placeholder="讲师姓名" />
          </Form.Item>
          <Form.Item name="location" label="地点">
            <Input placeholder="线下地点 / 线上链接" />
          </Form.Item>
          <Form.Item name="duration_minutes" label="时长(分钟)">
            <InputNumber min={0} style={{ width: '100%' }} placeholder="自动算或手填" />
          </Form.Item>
        </div>

        <Form.Item name="is_compliance" label="是否合规培训" valuePropName="checked">
          <Switch checkedChildren="是" unCheckedChildren="否" />
        </Form.Item>

        <Form.Item
          name="anchor_ids"
          label={isEdit ? '新增参训主播（可选）' : '参训主播'}
          tooltip={isEdit ? '已存在的主播请到详情抽屉里管理' : undefined}
        >
          <Select
            mode="multiple"
            placeholder="搜索主播 by 艺名/姓名"
            showSearch
            filterOption={false}
            onSearch={async (keyword) => {
              const opts = await fetchAnchors(keyword);
              form.setFieldsValue({ _anchorOptions: opts });
            }}
            options={form.getFieldValue('_anchorOptions') || []}
            onFocus={async () => {
              const opts = await fetchAnchors();
              form.setFieldsValue({ _anchorOptions: opts });
            }}
          />
        </Form.Item>

        <Form.Item name="description" label="培训内容">
          <TextArea rows={3} placeholder="本次培训目标、提纲、要点" />
        </Form.Item>

        <Form.Item name="materials" label="培训资料">
          <TextArea rows={2} placeholder="链接 / 文档名 / 关联材料库路径" />
        </Form.Item>

        <Form.Item name="remark" label="备注">
          <TextArea rows={2} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
