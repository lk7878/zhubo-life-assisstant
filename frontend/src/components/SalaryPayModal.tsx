import { useEffect } from 'react';
import { Modal, Form, Select, DatePicker, Input, message } from 'antd';
import dayjs from 'dayjs';
import { salaryApi } from '../api';
import { type SalaryRecord, PaymentMethod, PAYMENT_METHOD_LABELS } from '../types';

interface Props {
  open: boolean;
  record: SalaryRecord | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function SalaryPayModal({ open, record, onClose, onSuccess }: Props) {
  const [form] = Form.useForm();

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue({
      paid_at: dayjs(),
      payment_method: PaymentMethod.BANK,
      voucher: '',
    });
  }, [open, form]);

  const handleSubmit = async () => {
    if (!record) return;
    const v = await form.validateFields();
    try {
      await salaryApi.payRecord(record.id, {
        paid_at: v.paid_at ? dayjs(v.paid_at).toISOString() : undefined,
        payment_method: v.payment_method,
        voucher: v.voucher || undefined,
      });
      message.success('已标记发放');
      onSuccess();
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      title={record ? `标记发放 · ${record.anchor_stage_name || ''} · ¥${record.total_payable}` : '标记发放'}
      okText="确认发放"
      destroyOnHidden
    >
      <Form form={form} layout="vertical">
        <Form.Item name="paid_at" label="发放时间" rules={[{ required: true }]}>
          <DatePicker showTime style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="payment_method" label="发放方式" rules={[{ required: true }]}>
          <Select>
            {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => (
              <Select.Option key={k} value={k}>{v}</Select.Option>
            ))}
          </Select>
        </Form.Item>
        <Form.Item name="voucher" label="发放凭证（流水号 / 截图路径 / 备注）">
          <Input.TextArea rows={3} placeholder="例如：银行流水号 / 微信转账记录截图 / 现金发放说明" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
