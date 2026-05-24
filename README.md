# 君燚无双·主播全生命周期管理系统

自媒体主播全生命周期管理：人事档案、成长节点、合同、薪资、培训、资产、直播记录、运营看板、操作日志一站式收口。

- 后端：FastAPI + SQLAlchemy + SQLite
- 前端：React 18 + TypeScript + Vite + Ant Design + Zustand
- 部署：单机 Windows 友好（自带 venv 一键安装 / 启动脚本）

---

## 一、目录结构

```
zhubo-life-assisstant/
├── backend/                       # FastAPI 后端
│   ├── app/
│   │   ├── routers/               # 业务接口（auth/users/anchors/...）
│   │   ├── services/              # 领域服务（薪资、合同状态判定）
│   │   ├── utils/                 # 鉴权、日志、上下文
│   │   ├── models.py              # SQLAlchemy ORM
│   │   ├── schemas.py             # Pydantic schemas
│   │   ├── database.py            # 引擎 / 会话 / 启动钩子
│   │   ├── main.py                # FastAPI 应用入口
│   │   └── config.py              # 环境变量集中读取
│   ├── tests/                     # pytest 自动化测试
│   ├── files/                     # 节点附件（自动建立）
│   ├── uploads/contracts/         # 合同附件（自动建立）
│   ├── zhubo_sys.db               # 默认 SQLite（首次启动自动生成）
│   ├── requirements.txt
│   └── pytest.ini
├── frontend/                      # React 前端（Vite 构建后由 FastAPI 托管）
├── tools/                         # 测试用例生成、批量构造工具
├── install_dev(安装环境）.bat      # 一键安装：venv + pip + npm install
├── start_easy.bat                 # 一键启动：构建前端 + 起后端 + 打开浏览器
├── PRD.md / TEST_PLAN.md / TEST_CASES.csv
└── README.md
```

---

## 二、快速开始（Windows）

### 1. 安装依赖

双击 `install_dev(安装环境）.bat`，会完成：

- 在 `backend/.venv` 创建虚拟环境
- `pip install -r backend/requirements.txt`
- `frontend/` 下 `npm install`

### 2. 启动

双击 `start_easy.bat`，会自动：

1. 释放 `8000` 端口
2. `npm run build` 构建前端到 `frontend/dist`
3. 启动 FastAPI（uvicorn）在 `0.0.0.0:8000`（**局域网内任意机器都能访问**）
4. 在控制台打印本机所有 IPv4 地址，分享给同事
5. 本机浏览器自动打开 `http://127.0.0.1:8000`

> 同一局域网的同事用 `http://<你的电脑IP>:8000` 访问。如果他们打不开，需要先按 [§五. 局域网部署](#五局域网部署--每日自动备份) 一键放行防火墙。

### 3. 默认账号

| 角色 | 用户名 | 密码 | 权限 |
|------|--------|--------|------|
| 管理员 | `admin` | `admin123` | 全部 |
| 运营 | `operator` | `operator123` | 业务模块读写，不能管理用户 / 终止合同 |
| 财务 | `finance` | `finance123` | 业务模块只读 + 薪资/合同读写 |

> 生产环境请立即修改三个默认密码并更换 `ZHUBO_SECRET_KEY`。

---

## 三、环境变量

所有路径与密钥都集中在 `backend/app/config.py`，可通过环境变量覆盖：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `ZHUBO_DATABASE_URL` | `sqlite:///./zhubo_sys.db` | 数据库连接串，可换 PostgreSQL/MySQL |
| `ZHUBO_FILES_DIR` | `backend/files` | 节点附件目录 |
| `ZHUBO_UPLOAD_DIR` | `backend/uploads/contracts` | 合同附件目录 |
| `ZHUBO_SECRET_KEY` | 内置占位串 | JWT 签名密钥，**部署前必须改** |

部署示例（PowerShell）：

```powershell
$env:ZHUBO_DATABASE_URL = "sqlite:///D:/zhubo/data/prod.db"
$env:ZHUBO_FILES_DIR    = "D:/zhubo/data/files"
$env:ZHUBO_UPLOAD_DIR   = "D:/zhubo/data/uploads/contracts"
$env:ZHUBO_SECRET_KEY   = "<请生成 32 字节随机串>"
backend\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1
```

---

## 四、自动化测试

后端附带完整 pytest 套件，**122 条用例覆盖 13 个模块**，每个用例自动隔离数据库与文件目录，对开发库零污染。

### 运行

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest          # 全跑
.\.venv\Scripts\python.exe -m pytest -v       # 输出每条用例
.\.venv\Scripts\python.exe -m pytest tests\test_contracts.py  # 单文件
.\.venv\Scripts\python.exe -m pytest -k "expiring"            # 按名称过滤
```

### 覆盖范围

| 测试文件 | 用例数 | 重点覆盖 |
|----------|------:|----------|
| `test_auth.py` | 13 | 登录、登出、`/me`、改密、错误密码、token 过期 |
| `test_users.py` | 10 | 用户增删改、重置密码、停用/启用、admin 限定 |
| `test_security.py` | 9 | 匿名 401、跨角色 403、SQL 注入、token 篡改 |
| `test_anchors.py` | 14 | CRUD、搜索、分页、成长阶段算法、时间轴 |
| `test_nodes_files.py` | 12 | 节点 CRUD + 文件上传/下载/删除/级联清理 |
| `test_library.py` | 9 | 材料库目录树、过滤、预览、路径穿越拦截 |
| `test_live_records.py` | 6 | 直播记录 CRUD、过滤、对主播聚合统计的影响 |
| `test_logs.py` | 5 | 日志自动产生、operator 字段、排序、分页、权限 |
| `test_dashboard.py` | 4 | 看板数据聚合、权限 |
| `test_trainings.py` | 9 | 培训计划 + 参训登记 + 签到 + 培训前后效果 |
| `test_salaries.py` | 10 | 阶梯提成算法、配置 CRUD、结算单全流程 |
| `test_contracts.py` | 10 | CRUD、自动入职节点联动、续签 milestone、终止 admin 限定、即将到期 |
| `test_assets.py` | 11 | 直播间 / 设备 / 借用归还全流程、状态联动 |
| **合计** | **122** | |

### 隔离机制

`backend/tests/conftest.py` 的核心策略：

1. **import app 之前**就把 `ZHUBO_DATABASE_URL` / `ZHUBO_FILES_DIR` / `ZHUBO_UPLOAD_DIR` / `ZHUBO_SECRET_KEY` 指向临时目录；
2. 每个测试函数前清空除 `users` 之外的全部业务表，并清掉临时 files / uploads；
3. session 结束时整个临时目录被删除；
4. 提供 `client` / `admin_token` / `operator_token` / `finance_token` 等通用 fixture，再加 `create_anchor()` 等业务 helper。

测试运行**不会**影响 `backend/zhubo_sys.db` 与 `backend/files` 目录。

---

## 五、局域网部署 + 每日自动备份

### 一键完成（推荐）

**右键** `setup_lan.bat` → **以管理员身份运行**，会自动：

1. 在 Windows 防火墙里放行 TCP 8000 端口（入站）
2. 注册名为 `zhubo_sys_daily_backup` 的计划任务，每天 03:00 调 `backup_daily.bat`

之后每次：

- **启动服务** → 双击 `start_easy.bat`
- **手动备份一次** → 双击 `backup_daily.bat`

### 备份目录结构

备份默认输出到项目根目录的 `backups/`：

```
backups/
├── zhubo_sys_20260524_030001.db     # SQLite 数据库
├── files_20260524_030001.zip        # 节点附件
└── uploads_20260524_030001.zip      # 合同附件
```

**自动保留 30 天**，超过的旧备份会被脚本自己清理。

### 容量与性能边界

| 同时**在线**人数 | SQLite 表现 | 是否需要换库 |
|:---:|------|:---:|
| 1–5 | 完全没压力 | 否 |
| 5–20 | 写并发偶尔锁等待，体验良好 | 否 |
| 20+ | 写锁排队明显 | **应升级 PostgreSQL/MySQL** |

升级数据库只需要把 `ZHUBO_DATABASE_URL` 换成新的连接串（见 §三）。

### 局域网访问的安全提醒

服务一旦监听到 `0.0.0.0`，**整个 LAN 都能访问**，请立即：

1. 把三个默认账号 (`admin/operator/finance`) 的密码全改掉
2. 更换 `ZHUBO_SECRET_KEY`（启动前 `set ZHUBO_SECRET_KEY=...`）
3. 不要把 8000 端口在路由器上做端口映射暴露到公网（如果要公网访问，必须再加 HTTPS + 反向代理）

### 手动放行防火墙（备用方法）

如果不想跑 `setup_lan.bat`，也可以手动用 PowerShell（管理员）：

```powershell
New-NetFirewallRule -DisplayName "zhubo_sys" -Direction Inbound -Protocol TCP -LocalPort 8000 -Action Allow
```

---

## 六、模块清单

| 模块 | 路由前缀 | 说明 |
|------|----------|------|
| 认证 | `/api/auth` | 登录、登出、`/me`、改密 |
| 用户管理 | `/api/users` | 角色：admin / operator / finance |
| 主播档案 | `/api/anchors` | 主播全字段、成长阶段、时间线 |
| 成长节点 | `/api/nodes` | entry / promotion / training / milestone / award / penalty |
| 节点附件 | `/api/files` / `/api/library` | 节点级文件 + 全局材料库 |
| 直播记录 | `/api/live-records` | 单场直播、聚合统计 |
| 直播间 | `/api/live-rooms` | 平台限定快手 |
| 合同 | `/api/contracts` | 含 自动入职节点 / 续签 milestone / 即将到期 |
| 培训 | `/api/trainings` | 培训计划 + 参训登记 + 签到 + 效果 |
| 薪资 | `/api/salaries` | 阶梯提成、配置版本、结算单 |
| 资产 | `/api/assets` | 直播间、设备、借用归还 |
| 看板 | `/api/dashboard` | 核心 KPI 聚合 |
| 操作日志 | `/api/logs` | 自动审计；admin/finance 可读 |

---

## 七、安全注意事项

- 部署前必须修改 `ZHUBO_SECRET_KEY`（建议 `python -c "import secrets; print(secrets.token_urlsafe(48))"`）
- 三个默认账号必须改密码
- 所有写接口已加 RBAC：业务模块要求 admin / operator，财务模块要求 admin / finance，合同终止仅 admin
- 文件上传只允许 `files/<anchor>/<node>/...` 与 `uploads/contracts/...` 子树，路径穿越在后端被拦截
- 所有写操作都会写入 `operation_logs`，操作员名取自 JWT，无法伪造

---

## 八、TODO（按优先级）

1. 给 `users.username` / `anchors.id_card` / `equipments.sn` 补 unique 约束
2. 登录失败次数限制 + 密码复杂度策略
3. 前端按页路由懒加载，缩小首屏 bundle
