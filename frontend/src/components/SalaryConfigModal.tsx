import { useEffect } from 'react';
import { Modal, Form, InputNumber, Button, Space, DatePicker, Input, Divider, message, Alert } from 'antd';
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { salaryApi } from '../api';
import type { SalaryConfig } from '../types';

const { TextArea } = Input;

interface Props {
  open: boolean;
  /** 没有 anchorId 表示编辑默认配置 */
  anchorId?: string | null;
  anchorLabel?: string;
  initial?: SalaryConfig | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function SalaryConfigModal({ open, anchorId, anchorLabel, initial, onClose, onSuccess }: Props) {
  const [form] = Form.useForm();
  const isDefault = !anchorId;

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    if (initial) {
      form.setFieldsValue({
        base_salary: initial.base_salary,
        daily_base: initial.daily_base,
        effective_from: initial.effective_from ? dayjs(initial.effective_from) : null,
        commission_tiers: initial.commission_tiers?.length
          ? initial.commission_tiers
          : [{ min: 0, max: 10000, rate: 5 }],
        remark: initial.remark || '',
      });
    } else {
      form.setFieldsValue({
        base_salary: 3000,
        daily_base: 100,
        effective_from: null,
        commission_tiers: [
          { min: 0, max: 10000, rate: 5 },
          { min: 10000, max: 50000, rate: 8 },
          { min: 50000, max: null, rate: 12 },
        ],
        remark: '',
      });
    }
  }, [open, initial, form]);

  const handleSave = async () => {
    const values = await form.validateFields();
    const payload = {
      base_salary: Number(values.base_salary || 0),
      daily_base: Number(values.daily_base || 0),
      commission_tiers: (values.commission_tiers || []).map((t: any) => ({
        min: Number(t.min || 0),
        max: t.max == null || t.max === '' ? null : Number(t.max),
        rate: Number(t.rate || 0),
      })),
      effective_from: values.effective_from ? dayjs(values.effective_from).format('YYYY-MM-DD') : null,
      remark: values.remark || null,
    };
    try {
      if (isDefault) {
        await salaryApi.updateDefaultConfig(payload);
      } else {
        await salaryApi.updateAnchorConfig(anchorId!, payload);
      }
      message.success('已保存');
      onSuccess();
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      onOk={handleSave}
      width={760}
      title={isDefault ? '编辑默认薪资配置' : `编辑薪资配置 · ${anchorLabel || ''}`}
      destroyOnHidden
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="阶梯提成按「分段累计」方式计算"
        description={
          <span>
            例如阶梯设置：[0~1万 5%] / [1万~5万 8%] / [5万以上 12%]，GMV 8 万时：
            <br />
            1万×5% + 4万×8% + 3万×12% = 500 + 3200 + 3600 = <b>7300</b>
          </span>
        }
      />

      <Form form={form} layout="vertical">
        <Space size={24} wrap>
          <Form.Item name="base_salary" label="月底薪 (元)" rules={[{ required: true }]}>
            <InputNumber min={0} step={100} style={{ width: 160 }} />
          </Form.Item>
          <Form.Item name="daily_base" label="日基数 (元/天)">
            <InputNumber min={0} step={10} style={{ width: 160 }} />
          </Form.Item>
          <Form.Item name="effective_from" label="生效日期">
            <DatePicker style={{ width: 160 }} />
          </Form.Item>
        </Space>

        <Divider style={{ marginTop: 0 }}>GMV 阶梯提成</Divider>

        <Form.List name="commission_tiers">
          {(fields, { add, remove }) => (
            <>
              {fields.map(({ key, name }) => (
                <Space key={key} align="baseline" style={{ display: 'flex', marginBottom: 8 }}>
                  <Form.Item name={[name, 'min']} label="区间起" rules={[{ required: true }]}>
                    <InputNumber min={0} step={1000} style={{ width: 130 }} />
                  </Form.Item>
                  <Form.Item name={[name, 'max']} label="区间止 (空=无上限)">
                    <InputNumber min={0} step={1000} style={{ width: 150 }} placeholder="可空" />
                  </Form.Item>
                  <Form.Item name={[name, 'rate']} label="比例 (%)" rules={[{ required: true }]}>
                    <InputNumber min={0} max={100} step={0.5} style={{ width: 110 }} addonAfter="%" />
                  </Form.Item>
                  <MinusCircleOutlined onClick={() => remove(name)} style={{ color: '#ff4d4f' }} />
                </Space>
              ))}
              <Button type="dashed" onClick={() => add({ min: 0, max: null, rate: 0 })} icon={<PlusOutlined />} block>
                添加阶梯
              </Button>
            </>
          )}
        </Form.List>

        <Form.Item name="remark" label="备注" style={{ marginTop: 16 }}>
          <TextArea rows={2} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
