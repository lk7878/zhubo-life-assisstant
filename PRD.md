# 主播全生命周期管理系统 - 产品需求文档

## 1. 产品概述

### 1.1 产品定位
面向新媒体公司的内部工具，用于管理主播从入职到离职的全生命周期记录，实现主播成长轨迹的数字化管理。

### 1.2 核心价值
- 沉淀主播成长数据，辅助运营决策
- 规范化管理流程，降低人才流失风险
- 材料集中存储，便于追溯和审计

### 1.3 目标用户
- HR 部门：主播入职/离职手续办理
- 运营部门：主播培训、考核、里程碑记录
- 管理层：查看主播成长轨迹和数据分析

---

## 2. 技术架构

### 2.1 技术栈
| 层级 | 技术选型 |
|------|----------|
| 前端 | React 18 + TypeScript + Vite |
| UI 框架 | Ant Design 5 |
| 状态管理 | Zustand |
| 后端 | Python 3.11 + FastAPI |
| 数据库 | SQLite (本地存储) |
| 文件存储 | 本地文件系统 |
| API 风格 | RESTful |

### 2.2 项目结构
```
zhubo_sys/
├── backend/
│   ├── app/
│   │   ├── main.py           # FastAPI 入口
│   │   ├── database.py       # 数据库配置
│   │   ├── models.py         # 数据模型
│   │   ├── schemas.py        # Pydantic 模型
│   │   ├── routers/          # API 路由
│   │   └── services/         # 业务逻辑
│   ├── files/                # 文件存储目录
│   │   ├── contracts/        # 合同文件
│   │   ├── training/         # 培训记录
│   │   ├── photos/           # 照片
│   │   └── documents/        # 其他文档
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/       # 公共组件
│   │   ├── pages/            # 页面
│   │   ├── stores/           # Zustand store
│   │   ├── api/              # API 调用
│   │   └── types/            # TypeScript 类型
│   └── package.json
└── PRD.md
```

---

## 3. 功能模块

### 3.1 主播管理模块

#### 3.1.1 主播列表
- 展示所有主播信息卡片（头像、姓名、艺名、状态、入职时间）
- 支持按姓名/艺名搜索
- 支持按状态筛选（全部/在职/离职/实习）
- 点击卡片进入主播详情

#### 3.1.2 主播信息
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主播唯一标识 |
| name | string | 真实姓名 |
| stage_name | string | 艺名 |
| phone | string | 联系电话 |
| id_card | string | 身份证号 |
| platform | string | 所属平台（抖音/快手/B站等） |
| status | enum | 在职/离职/实习 |
| hire_date | date | 入职日期 |
| leave_date | date | 离职日期（可为空） |
| avatar | file | 头像图片 |
| remark | text | 备注 |

### 3.2 节点管理模块

#### 3.2.1 节点类型
| 节点类型 | 说明 | 典型场景 |
|----------|------|----------|
| 入职 | 主播入职登记 | 入职手续、合同签订 |
| 培训 | 专业技能/平台规则培训 | 新人培训、专业课程 |
| 谈话 | 绩效/职业发展沟通 | 月度面谈、问题沟通 |
| 里程碑 | 重要成就事件 | 粉丝突破、GMV 达标 |
| 考核 | 绩效考核/评级 | 月度考核、等级评定 |
| 离职 | 离职手续办理 | 离职交接、最后面谈 |

#### 3.2.2 节点通用字段
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 节点唯一标识 |
| anchor_id | UUID | 关联的主播ID |
| type | enum | 节点类型 |
| date | datetime | 发生时间 |
| location | string | 地点 |
| title | string | 标题 |
| content | text | 事由/内容详情 |
| files | file[] | 关联文件列表 |

#### 3.2.3 节点文件管理
- 支持上传多个文件
- 文件类型：PDF、图片(DOC/DOCX/XLS/XLSX)
- 单文件大小限制：50MB
- 自动分类到对应目录

### 3.3 材料库模块

#### 3.3.1 目录结构
```
材料库/
├── 合同文件/
│   └── [主播名]/
│       ├── 入职合同.pdf
│       └── 补充协议.pdf
├── 培训记录/
│   └── [主播名]/
│       ├── 新人培训.pdf
│       └── 专业技能培训/
├── 照片/
│   └── [主播名]/
│       ├── 证件照/
│       └── 工作照/
└── 其他文档/
    └── [主播名]/
```

#### 3.3.2 材料浏览
- 树形目录展示
- 支持文件预览（图片、PDF）
- 支持文件下载

### 3.4 成长轨迹模块

#### 3.4.1 时间轴展示
- 横向时间轴展示主播生命周期
- 每个节点为时间轴上的一个里程碑
- 点击节点查看详情
- 支持按节点类型筛选

#### 3.4.2 成长报告
- 统计主播在各节点的参与情况
- 培训时长统计
- 里程碑成就统计

---

## 4. 数据模型

### 4.1 数据库 ER 图

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│   Anchor    │       │    Node     │       │    File     │
├─────────────┤       ├─────────────┤       ├─────────────┤
│ id (PK)     │──┐    │ id (PK)     │    ┌──│ id (PK)     │
│ name        │  │    │ anchor_id(FK)│────┘  │ node_id(FK) │
│ stage_name  │  └───►│ type        │       │ filename    │
│ phone       │       │ date        │       │ file_path   │
│ id_card     │       │ location    │       │ file_type   │
│ platform    │       │ title       │       │ file_size   │
│ status      │       │ content     │       │ uploaded_at │
│ hire_date   │       │ created_at  │       └─────────────┘
│ leave_date  │       │ updated_at  │
│ avatar      │       └─────────────┘
│ remark      │
│ created_at  │
│ updated_at  │
└─────────────┘
```

### 4.2 主要 API 接口

#### 主播管理
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/anchors | 获取主播列表 |
| GET | /api/anchors/{id} | 获取主播详情 |
| POST | /api/anchors | 创建主播 |
| PUT | /api/anchors/{id} | 更新主播信息 |
| DELETE | /api/anchors/{id} | 删除主播 |
| GET | /api/anchors/{id}/timeline | 获取成长时间轴 |

#### 节点管理
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/anchors/{id}/nodes | 获取主播节点列表 |
| GET | /api/nodes/{id} | 获取节点详情 |
| POST | /api/anchors/{id}/nodes | 创建节点 |
| PUT | /api/nodes/{id} | 更新节点 |
| DELETE | /api/nodes/{id} | 删除节点 |

#### 文件管理
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/nodes/{id}/files | 上传文件 |
| GET | /api/files/{id} | 下载文件 |
| DELETE | /api/files/{id} | 删除文件 |
| GET | /api/files/{id}/preview | 预览文件 |

#### 材料库
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/library/tree | 获取目录树 |
| GET | /api/library/files | 获取文件列表 |

---

## 5. 前端页面规划

### 5.1 页面列表
| 页面 | 路由 | 说明 |
|------|------|------|
| 主播列表 | / | 首页，展示所有主播 |
| 主播详情 | /anchor/:id | 主播信息和成长时间轴 |
| 添加主播 | /anchor/new | 新建主播表单 |
| 编辑主播 | /anchor/:id/edit | 编辑主播信息 |
| 节点详情 | /node/:id | 节点详情和文件列表 |
| 材料库 | /library | 文件目录浏览 |

### 5.2 页面布局
```
┌──────────────────────────────────────────────────┐
│  Header: Logo + 导航菜单 + 搜索框              │
├──────────────────────────────────────────────────┤
│                                                  │
│  Content Area                                    │
│  (根据路由动态渲染)                              │
│                                                  │
└──────────────────────────────────────────────────┘
```

---

## 6. 非功能性需求

### 6.1 性能要求
- 页面首屏加载 < 2s
- API 响应时间 < 500ms
- 文件上传进度实时反馈

### 6.2 安全要求
- 文件类型白名单校验
- 文件大小限制
- SQL 注入防护

### 6.3 数据安全
- 定期备份 SQLite 数据库
- 文件存储与数据库分离
- 删除主播时保留关联文件

---

## 7. 里程碑规划

### Phase 1: MVP 版本
- [ ] 项目脚手架搭建（前后端初始化）
- [ ] 主播 CRUD 功能
- [ ] 节点 CRUD 功能
- [ ] 文件上传基础功能
- [ ] 主播列表页和详情页

### Phase 2: 完善功能
- [ ] 成长时间轴组件
- [ ] 材料库目录浏览
- [ ] 文件预览功能
- [ ] 搜索和筛选功能

### Phase 3: 体验优化
- [ ] 响应式布局适配
- [ ] 数据导出功能
- [ ] 操作日志记录

---

## 8. 风险与挑战

| 风险 | 应对策略 |
|------|----------|
| 文件存储膨胀 | 定期清理+大容量存储支持 |
| 数据迁移困难 | 使用标准 SQLite，文档化迁移流程 |
| 多用户并发 | 当前为单用户本地应用，暂不考虑 |

---

## 9. 附录

### 9.1 状态枚举值
```typescript
enum AnchorStatus {
  ONBOARDING = 'onboarding',   // 实习
  ACTIVE = 'active',          // 在职
  INACTIVE = 'inactive',      // 离职
}

enum NodeType {
  ENTRY = 'entry',            // 入职
  TRAINING = 'training',      // 培训
  INTERVIEW = 'interview',    // 谈话
  MILESTONE = 'milestone',    // 里程碑
  ASSESSMENT = 'assessment',  // 考核
  EXIT = 'exit',              // 离职
}
```

### 9.2 文件目录配置
```yaml
# backend/config.py
FILE_STORAGE_PATH = "./files"
FILE_CATEGORIES = {
  "contracts": "合同文件",
  "training": "培训记录",
  "photos": "照片",
  "documents": "其他文档"
}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".doc", ".docx", ".xls", ".xlsx"]
```
