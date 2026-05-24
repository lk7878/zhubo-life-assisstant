import { useState } from 'react';
import { Modal, Form, Input, Select, DatePicker, message, Tag } from 'antd';
import { nodesApi } from '../api';
import type { Node, NodeCreate, NodeUpdate } from '../types';
import { NODE_TYPE_LABELS, NODE_TYPE_COLORS } from '../types';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

const nodeTypes = ['entry', 'training', 'interview', 'milestone', 'assessment', 'exit'];

interface Props {
  visible: boolean;
  anchorId: string;
  node?: Node;
  onClose: () => void;
  onSuccess: () => void;
}

export default function NodeFormModal({ visible, anchorId, node, onClose, onSuccess }: Props) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const data = {
        ...values,
        date: values.date.format('YYYY-MM-DDTHH:mm:ss'),
      };

      setLoading(true);
      if (node) {
        await nodesApi.update(node.id, data as NodeUpdate);
        message.success('更新成功');
      } else {
        await nodesApi.create(anchorId, data as NodeCreate);
        message.success('创建成功');
      }
      form.resetFields();
      onSuccess();
    } catch (error) {
      if (error instanceof Error) {
        message.error(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={node ? '编辑节点' : '添加节点'}
      open={visible}
      onOk={handleSubmit}
      onCancel={() => {
        form.resetFields();
        onClose();
      }}
      confirmLoading={loading}
      width={500}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={
          node
            ? {
                ...node,
                date: dayjs(node.date),
              }
            : {}
        }
      >
        <Form.Item
          name="type"
          label="节点类型"
          rules={[{ required: true, message: '请选择节点类型' }]}
        >
          <Select placeholder="请选择节点类型">
            {nodeTypes.map((type) => (
              <Option key={type} value={type}>
                <Tag color={NODE_TYPE_COLORS[type]}>{NODE_TYPE_LABELS[type]}</Tag>
              </Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          name="title"
          label="标题"
          rules={[{ required: true, message: '请输入标题' }]}
        >
          <Input placeholder="请输入标题" />
        </Form.Item>

        <Form.Item
          name="date"
          label="发生时间"
          rules={[{ required: true, message: '请选择时间' }]}
        >
          <DatePicker showTime format="YYYY-MM-DD HH:mm:ss" style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item name="location" label="地点">
          <Input placeholder="请输入地点" />
        </Form.Item>

        <Form.Item name="content" label="内容">
          <TextArea rows={4} placeholder="请输入内容" />
        </Form.Item>
      </Form>
    </Modal>
  );
}