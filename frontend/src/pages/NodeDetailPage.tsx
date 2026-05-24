import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, Descriptions, Tag, Spin, message, Popconfirm, Space, Upload, Modal, Row, Col } from 'antd';
import { ArrowLeftOutlined, EditOutlined, DeleteOutlined, UploadOutlined, DownloadOutlined, EyeOutlined } from '@ant-design/icons';
import { nodesApi, filesApi } from '../api';
import type { Node, FileRecord } from '../types';
import { NODE_TYPE_LABELS, NODE_TYPE_COLORS } from '../types';
import NodeFormModal from '../components/NodeFormModal';

export default function NodeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [node, setNode] = useState<Node | null>(null);
  const [loading, setLoading] = useState(true);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewFileType, setPreviewFileType] = useState('');

  const fetchNode = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await nodesApi.get(id);
      setNode(data);
    } catch (error) {
      message.error((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNode();
  }, [id]);

  const handleDelete = async () => {
    if (!id) return;
    try {
      await nodesApi.delete(id);
      message.success('删除成功');
      navigate(-1);
    } catch (error) {
      message.error((error as Error).message);
    }
  };

  const handleUpload = async (file: File) => {
    if (!id) return false;
    try {
      await filesApi.upload(id, 'documents', file);
      message.success('上传成功');
      fetchNode();
    } catch (error) {
      message.error((error as Error).message);
    }
    return false;
  };

  const handleDeleteFile = async (fileId: string) => {
    try {
      await filesApi.delete(fileId);
      message.success('删除成功');
      fetchNode();
    } catch (error) {
      message.error((error as Error).message);
    }
  };

  const closePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl('');
    setPreviewFileType('');
    setPreviewVisible(false);
  };

  const handlePreview = async (file: FileRecord) => {
    try {
      const fileType = file.file_type?.toLowerCase() || '';
      if (['.jpg', '.jpeg', '.png', '.pdf'].includes(fileType)) {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        const url = await filesApi.preview(file.id);
        setPreviewUrl(url);
        setPreviewFileType(fileType);
        setPreviewVisible(true);
      } else {
        await filesApi.download(file.id, file.original_name);
      }
    } catch (error) {
      message.error((error as Error).message);
    }
  };

  const handleDownloadFile = async (file: FileRecord) => {
    try {
      await filesApi.download(file.id, file.original_name);
    } catch (error) {
      message.error((error as Error).message);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!node) {
    return <div>节点不存在</div>;
  }

  return (
    <div style={{ padding: 16 }}>
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} style={{ marginBottom: 16 }}>
        返回
      </Button>

      <Card
        title={
          <Space size={4}>
            <Tag color={NODE_TYPE_COLORS[node.type]}>{NODE_TYPE_LABELS[node.type]}</Tag>
            <span style={{ fontSize: 14 }}>{node.title}</span>
          </Space>
        }
        extra={
          <Space wrap>
            <Button size="small" icon={<EditOutlined />} onClick={() => setEditModalVisible(true)}>
              编辑
            </Button>
            <Popconfirm title="确定删除该节点？" onConfirm={handleDelete}>
              <Button size="small" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          </Space>
        }
      >
        <Descriptions column={{ xs: 1, sm: 2 }} size="small">
          <Descriptions.Item label="发生时间">
            {new Date(node.date).toLocaleString('zh-CN')}
          </Descriptions.Item>
          <Descriptions.Item label="地点">{node.location || '-'}</Descriptions.Item>
          <Descriptions.Item label="内容" span={2}>
            {node.content || '-'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card
        title="关联文件"
        style={{ marginTop: 16 }}
        extra={
          <Upload showUploadList={false} beforeUpload={handleUpload}>
            <Button size="small" icon={<UploadOutlined />}>上传文件</Button>
          </Upload>
        }
      >
        {node.files.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#999', padding: 24 }}>暂无文件</div>
        ) : (
          <Row gutter={[12, 12]}>
            {node.files.map((file) => (
              <Col key={file.id} xs={24} sm={12} md={8}>
                <Card size="small">
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>
                      {['.jpg', '.jpeg', '.png'].includes(file.file_type?.toLowerCase() || '') ? '🖼️' : '📄'}
                    </div>
                    <div style={{ fontSize: 12, wordBreak: 'break-all', marginBottom: 8 }}>
                      {file.original_name}
                    </div>
                    <div style={{ color: '#999', fontSize: 10 }}>
                      {(file.file_size || 0) > 1024 * 1024
                        ? `${((file.file_size || 0) / 1024 / 1024).toFixed(2)} MB`
                        : `${Math.round((file.file_size || 0) / 1024)} KB`}
                    </div>
                    <Space style={{ marginTop: 8 }} size={4}>
                      <Button size="small" icon={<EyeOutlined />} onClick={() => handlePreview(file)}>
                        预览
                      </Button>
                      <Button size="small" icon={<DownloadOutlined />} onClick={() => handleDownloadFile(file)}>
                        下载
                      </Button>
                      <Popconfirm title="确定删除？" onConfirm={() => handleDeleteFile(file.id)}>
                        <Button size="small" danger icon={<DeleteOutlined />}>
                          删除
                        </Button>
                      </Popconfirm>
                    </Space>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </Card>

      <Modal
        title="文件预览"
        open={previewVisible}
        footer={null}
        onCancel={closePreview}
        width={800}
      >
        {previewUrl && (
          previewFileType === '.pdf' ? (
            <iframe src={previewUrl} style={{ width: '100%', height: '600px' }} />
          ) : (
            <img src={previewUrl} alt="preview" style={{ maxWidth: '100%' }} />
          )
        )}
      </Modal>

      <NodeFormModal
        visible={editModalVisible}
        anchorId={node.anchor_id}
        node={node}
        onClose={() => setEditModalVisible(false)}
        onSuccess={() => {
          setEditModalVisible(false);
          fetchNode();
        }}
      />
    </div>
  );
}