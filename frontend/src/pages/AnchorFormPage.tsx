import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Form, Input, Select, DatePicker, Button, Card, message, Row, Col, InputNumber, Divider } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { anchorsApi } from '../api';

const { Option } = Select;
const { TextArea } = Input;

export default function AnchorFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isEdit && id) {
      anchorsApi.get(id).then((anchor) => {
        form.setFieldsValue({
          ...anchor,
          hire_date: anchor.hire_date ? dayjs(anchor.hire_date) : undefined,
          leave_date: anchor.leave_date ? dayjs(anchor.leave_date) : undefined,
        });
      });
    }
  }, [id, isEdit, form]);

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      const data = {
        ...values,
        platform: '快手',
        douyin_account: null,
        xiaohongshu_account: null,
        weibo_account: null,
        bilibili_account: null,
        video_account: null,
        fan_profile: null,
        category_tags: null,
        style_tags: null,
        hire_date: values.hire_date ? dayjs(values.hire_date).format('YYYY-MM-DD') : undefined,
        leave_date: values.leave_date ? dayjs(values.leave_date).format('YYYY-MM-DD') : undefined,
      };
      if (isEdit && id) {
        await anchorsApi.update(id, data);
        message.success('更新成功');
      } else {
        await anchorsApi.create(data);
        message.success('创建成功');
      }
      navigate('/');
    } catch (error) {
      message.error((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 16, maxWidth: 1080, margin: '0 auto' }}>
      <Button
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate(-1)}
        style={{ marginBottom: 16 }}
      >
        返回
      </Button>
      <Card title={isEdit ? '编辑主播' : '添加主播'}>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            status: 'onboarding',
            platform: '快手',
          }}
        >
          <Divider>基础身份信息</Divider>
          <Row gutter={[16, 0]}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="name"
                label="真实姓名"
                rules={[{ required: true, message: '请输入真实姓名' }]}
              >
                <Input placeholder="请输入真实姓名" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="stage_name"
                label="艺名"
                rules={[{ required: true, message: '请输入艺名' }]}
              >
                <Input placeholder="请输入艺名" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={[16, 0]}>
            <Col xs={24} sm={12}>
              <Form.Item name="phone" label="联系电话">
                <Input placeholder="请输入联系电话" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="wechat" label="微信号">
                <Input placeholder="请输入微信号" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={[16, 0]}>
            <Col xs={24} sm={12}>
              <Form.Item name="id_card" label="身份证号">
                <Input placeholder="请输入身份证号" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={6}>
              <Form.Item name="gender" label="性别">
                <Select placeholder="请选择性别" allowClear>
                  <Option value="男">男</Option>
                  <Option value="女">女</Option>
                  <Option value="其他">其他</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={6}>
              <Form.Item name="age" label="年龄">
                <InputNumber min={0} max={120} placeholder="请输入年龄" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={[16, 0]}>
            <Col xs={24} sm={12}>
              <Form.Item name="city" label="所在城市">
                <Input placeholder="请输入所在城市" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="commute_distance" label="通勤情况">
                <Input placeholder="例如：地铁 40 分钟 / 距公司 8 公里" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={[16, 0]}>
            <Col xs={24} sm={12}>
              <Form.Item label="所属平台">
                <Input value="快手" disabled />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="status" label="状态">
                <Select placeholder="请选择状态">
                  <Option value="onboarding">实习</Option>
                  <Option value="active">在职</Option>
                  <Option value="inactive">离职</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={[16, 0]}>
            <Col xs={24} sm={12}>
              <Form.Item name="marital_status" label="婚姻状况">
                <Select placeholder="请选择婚姻状况" allowClear>
                  <Option value="未婚">未婚</Option>
                  <Option value="已婚">已婚</Option>
                  <Option value="离异">离异</Option>
                  <Option value="其他">其他</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="has_children" label="子女情况">
                <Select placeholder="请选择子女情况" allowClear>
                  <Option value="无">无</Option>
                  <Option value="有">有</Option>
                  <Option value="未填写">未填写</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Divider>社交账号信息</Divider>
          <Row gutter={[16, 0]}>
            <Col xs={24}>
              <Form.Item name="kuaishou_account" label="快手账号">
                <Input placeholder="请输入快手账号" />
              </Form.Item>
            </Col>
          </Row>

          <Divider>直播数据</Divider>
          <Row gutter={[16, 0]}>
            <Col xs={24} sm={8}>
              <Form.Item name="followers_count" label="粉丝数">
                <InputNumber min={0} placeholder="请输入粉丝数" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={16}>
              <Form.Item label=" ">
                <div style={{ color: '#86868B', fontSize: 12, lineHeight: '32px' }}>
                  场均观看、场均 GMV、转化率、平均时长等指标，将根据"直播记录"自动统计，无需手动填写
                </div>
              </Form.Item>
            </Col>
          </Row>

          <Divider>财务与紧急联系人</Divider>
          <Row gutter={[16, 0]}>
            <Col xs={24} sm={8}>
              <Form.Item name="bank_name" label="开户行">
                <Input placeholder="请输入开户行" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="bank_card_number" label="银行卡号">
                <Input placeholder="请输入银行卡号" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="bank_account_name" label="账户姓名">
                <Input placeholder="请输入账户姓名" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={[16, 0]}>
            <Col xs={24} sm={8}>
              <Form.Item name="emergency_contact_name" label="紧急联系人">
                <Input placeholder="请输入紧急联系人" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="emergency_contact_relation" label="联系人关系">
                <Input placeholder="请输入联系人关系" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={8}>
              <Form.Item name="emergency_contact_phone" label="联系人电话">
                <Input placeholder="请输入联系人电话" />
              </Form.Item>
            </Col>
          </Row>

          <Divider>评级信息</Divider>
          <Row gutter={[16, 0]}>
            <Col xs={24}>
              <Form.Item name="level_tags" label="层级标签">
                <Input placeholder="例如：新人,成长期,成熟期" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={[16, 0]}>
            <Col xs={24} sm={8}>
              <Form.Item name="grade" label="主播评级">
                <Select placeholder="请选择主播评级" allowClear>
                  <Option value="S">S级</Option>
                  <Option value="A">A级</Option>
                  <Option value="B">B级</Option>
                  <Option value="C">C级</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={16}>
              <Form.Item name="grade_note" label="评级说明">
                <Input placeholder="请输入评级原因，例如GMV、态度、成长性等" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={[16, 0]}>
            <Col xs={24} sm={12}>
              <Form.Item name="hire_date" label="入职日期">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="leave_date" label="离职日期">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="remark" label="备注">
            <TextArea rows={4} placeholder="请输入备注" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading}>
              {isEdit ? '保存' : '创建'}
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}