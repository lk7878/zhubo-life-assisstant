import { useEffect, useState } from 'react';
import { Modal, Form, Select, DatePicker, InputNumber, Input, message, Statistic, Row, Col, Space, Button } from 'antd';
import { CalculatorOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { salaryApi, anchorsApi } from '../api';
import {
  type Anchor, type SalaryPreviewResponse,
  SalaryPeriodType, SALARY_PERIOD_TYPE_LABELS,
} from '../types';

const { TextArea } = Input;

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function SalaryGenerateModal({ open, onClose, onSuccess }: Props) {
  const [form] = Form.useForm();
  const [anchorOptions, setAnchorOptions] = useState<{ label: string; value: string }[]>([]);
  const [preview, setPreview] = useState<SalaryPreviewResponse | null>(null);
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    setPreview(null);
    const today = dayjs();
    form.setFieldsValue({
      period_type: SalaryPeriodType.MONTH,
      period_start: today.startOf('month'),
      period_end: today.endOf('month'),
      bonus: 0,
      deduction: 0,
    });
    fetchAnchors();
  }, [open, form]);

  const fetchAnchors = async (kw?: string) => {
    const list = await anchorsApi.list({ search: kw, limit: 50 });
    setAnchorOptions(list.items.map((a: Anchor) => ({
      label: `${a.stage_name}（${a.name}）`, value: a.id,
    })));
  };

  const doPreview = async () => {
    const v = await form.validateFields(['anchor_id', 'period_type', 'period_start', 'period_end']);
    setPreviewing(true);
    try {
      const r = await salaryApi.preview({
        anchor_id: v.anchor_id,
        period_type: v.period_type,
        period_start: dayjs(v.period_start).format('YYYY-MM-DD'),
        period_end: dayjs(v.period_end).format('YYYY-MM-DD'),
      });
      setPreview(r);
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setPreviewing(false);
    }
  };

  const handleSubmit = async () => {
    const v = await form.validateFields();
    try {
      await salaryApi.createRecord({
        anchor_id: v.anchor_id,
        period_type: v.period_type,
        period_start: dayjs(v.period_start).format('YYYY-MM-DD'),
        period_end: dayjs(v.period_end).format('YYYY-MM-DD'),
        bonus: Number(v.bonus || 0),
        deduction: Number(v.deduction || 0),
        remark: v.remark || undefined,
      });
      message.success('已生成结算单');
      onSuccess();
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const totalAfterAdjust = preview
    ? Math.round((preview.total_payable + Number(form.getFieldValue('bonus') || 0) - Number(form.getFieldValue('deduction') || 0)) * 100) / 100
    : null;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      width={680}
      title="生成结算单"
      okText="生成"
      destroyOnHidden
    >
      <Form form={form} layout="vertical" onValuesChange={() => {
        // bonus/deduction 改变时刷新合计显示
        if (preview) setPreview({ ...preview });
      }}>
        <Form.Item name="anchor_id" label="主播" rules={[{ required: true, message: '请选择主播' }]}>
          <Select
            showSearch filterOption={false} options={anchorOptions}
            onSearch={fetchAnchors} placeholder="搜索主播"
          />
        </Form.Item>

        <Space size={16} wrap>
          <Form.Item name="period_type" label="结算周期" rules={[{ required: true }]}>
            <Select style={{ width: 130 }}>
              {Object.entries(SALARY_PERIOD_TYPE_LABELS).map(([k, v]) => (
                <Select.Option key={k} value={k}>{v}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="period_start" label="期间起" rules={[{ required: true }]}>
            <DatePicker style={{ width: 160 }} />
          </Form.Item>
          <Form.Item name="period_end" label="期间止" rules={[{ required: true }]}>
            <DatePicker style={{ width: 160 }} />
          </Form.Item>
          <Form.Item label=" ">
            <Button icon={<CalculatorOutlined />} loading={previewing} onClick={doPreview}>
              预览金额
            </Button>
          </Form.Item>
        </Space>

        {preview && (
          <div style={{ background: '#FAFAFA', borderRadius: 8, padding: 16, marginBottom: 16 }}>
            <Row gutter={16}>
              <Col span={6}><Statistic title="底薪" value={preview.base_salary} prefix="¥" /></Col>
              <Col span={6}><Statistic title="期间 GMV" value={preview.total_gmv} prefix="¥" /></Col>
              <Col span={6}><Statistic title="场次" value={preview.session_count} suffix="场" /></Col>
              <Col span={6}><Statistic title="提成" value={preview.commission} prefix="¥" /></Col>
            </Row>
            <Row gutter={16} style={{ marginTop: 12 }}>
              <Col span={12}><Statistic title="本期初算应发" value={preview.total_payable} prefix="¥" valueStyle={{ color: '#86868B' }} /></Col>
              <Col span={12}><Statistic title="加减项后应发" value={totalAfterAdjust ?? preview.total_payable} prefix="¥" valueStyle={{ color: '#34C759', fontWeight: 700 }} /></Col>
            </Row>
            <div style={{ color: '#86868B', fontSize: 12, marginTop: 8 }}>
              使用阶梯：
              {preview.tiers_used.map((t, idx) => (
                <span key={idx} style={{ marginLeft: 8 }}>
                  [{t.min}~{t.max ?? '∞'} : {t.rate}%]
                </span>
              ))}
            </div>
          </div>
        )}

        <Space size={16} wrap>
          <Form.Item name="bonus" label="加项 (奖金/补贴)">
            <InputNumber min={0} step={50} style={{ width: 160 }} />
          </Form.Item>
          <Form.Item name="deduction" label="减项 (扣款)">
            <InputNumber min={0} step={50} style={{ width: 160 }} />
          </Form.Item>
        </Space>

        <Form.Item name="remark" label="备注">
          <TextArea rows={2} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
