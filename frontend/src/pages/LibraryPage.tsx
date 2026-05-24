import { useEffect, useState } from 'react';
import { Tree, Card, Spin, Empty, Button, Popconfirm, Space, Tag, message } from 'antd';
import { DeleteOutlined, ReloadOutlined, ClearOutlined } from '@ant-design/icons';
import type { DataNode } from 'antd/es/tree';
import { libraryApi } from '../api';
import type { LibraryTreeNode } from '../types';

const { DirectoryTree } = Tree;

export default function LibraryPage() {
  const [rawTree, setRawTree] = useState<LibraryTreeNode[]>([]);
  const [treeData, setTreeData] = useState<DataNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [cleaning, setCleaning] = useState(false);

  const findNode = (nodes: LibraryTreeNode[], path: string): LibraryTreeNode | null => {
    for (const node of nodes) {
      if (node.path === path) return node;
      if (node.children?.length) {
        const found = findNode(node.children, path);
        if (found) return found;
      }
    }
    return null;
  };

  const renderTitle = (node: LibraryTreeNode): React.ReactNode => {
    const isCategoryRoot = node.type === 'folder' && node.path.split('/').filter(Boolean).length === 1;
    const canDelete = !isCategoryRoot; // 分类根目录不允许删除

    return (
      <Space size={6}>
        <span>{node.name}</span>
        {node.orphan ? <Tag color="red">孤儿</Tag> : null}
        {canDelete ? (
          <Popconfirm
            title={node.type === 'folder' ? '确认删除该目录及其下所有文件？' : '确认删除该文件？'}
            okText="删除"
            okButtonProps={{ danger: true }}
            cancelText="取消"
            onConfirm={async (e) => {
              e?.stopPropagation();
              try {
                if (node.type === 'folder') {
                  await libraryApi.deleteFolder(node.path);
                } else {
                  await libraryApi.deleteFile(node.path);
                }
                message.success('已删除');
                fetchTree();
              } catch (err) {
                message.error((err as Error).message || '删除失败');
              }
            }}
            onCancel={(e) => e?.stopPropagation()}
          >
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={(e) => e.stopPropagation()}
            />
          </Popconfirm>
        ) : null}
      </Space>
    );
  };

  const transformTreeData = (nodes: LibraryTreeNode[]): DataNode[] => {
    return nodes.map((node) => ({
      key: node.path,
      title: renderTitle(node),
      isLeaf: node.type === 'file',
      children: node.children?.length ? transformTreeData(node.children) : undefined,
    }));
  };

  const fetchTree = async () => {
    setLoading(true);
    try {
      const data = await libraryApi.tree();
      setRawTree(data);
      setTreeData(transformTreeData(data));
    } catch (error) {
      message.error((error as Error).message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTree();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCleanupOrphans = async () => {
    setCleaning(true);
    try {
      const res = await libraryApi.cleanupOrphans();
      if (res.removed_folders.length === 0) {
        message.info('没有发现孤儿目录');
      } else {
        message.success(`已清理 ${res.removed_folders.length} 个孤儿目录，移除 ${res.removed_records} 条文件记录`);
      }
      fetchTree();
    } catch (err) {
      message.error((err as Error).message || '清理失败');
    } finally {
      setCleaning(false);
    }
  };

  const handleSelect = async (keys: React.Key[]) => {
    if (keys.length === 0) return;
    const selectedKey = keys[0] as string;
    const node = findNode(rawTree, selectedKey);
    if (node?.type === 'file' && node.file_id) {
      try {
        await libraryApi.openPreview(node.file_id);
      } catch (err) {
        message.error((err as Error).message || '打开文件失败');
      }
    }
  };

  const hasOrphan = (() => {
    let found = false;
    const walk = (nodes: LibraryTreeNode[]) => {
      for (const n of nodes) {
        if (n.orphan) { found = true; return; }
        if (n.children?.length) walk(n.children);
        if (found) return;
      }
    };
    walk(rawTree);
    return found;
  })();

  return (
    <div style={{ padding: 24 }}>
      <Card
        title="材料库"
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchTree}>刷新</Button>
            <Popconfirm
              title="确认清理所有孤儿目录？"
              description="将永久删除磁盘上没有对应主播的目录及文件。"
              okText="清理"
              okButtonProps={{ danger: true }}
              cancelText="取消"
              onConfirm={handleCleanupOrphans}
            >
              <Button danger icon={<ClearOutlined />} loading={cleaning} disabled={!hasOrphan}>
                清理孤儿目录
              </Button>
            </Popconfirm>
          </Space>
        }
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: 50 }}>
            <Spin size="large" />
          </div>
        ) : treeData.length === 0 ? (
          <Empty description="暂无材料" />
        ) : (
          <DirectoryTree
            treeData={treeData}
            onSelect={handleSelect}
            defaultExpandAll
            blockNode
          />
        )}
      </Card>
    </div>
  );
}
