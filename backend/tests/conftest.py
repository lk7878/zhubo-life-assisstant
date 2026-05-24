"""
全局 pytest 配置：

- 使用临时 SQLite 数据库 + 临时 files / uploads 目录，避免影响开发库；
- 每个测试函数自动重置业务表（保留默认三个用户账号）；
- 提供 client / admin_token / operator_token / finance_token 等 fixture 与
  `auth_headers(token)` / `login(client, ...)` 等 helper。
"""
from __future__ import annotations

import os
import shutil
import sys
import tempfile
import pathlib
from typing import Iterator

# ============== 1. 在导入 app 之前完成环境变量隔离 ==============
_TEST_ROOT = pathlib.Path(tempfile.mkdtemp(prefix="zhubo_test_"))
_TEST_DB = _TEST_ROOT / "test.db"
_TEST_FILES = _TEST_ROOT / "files"
_TEST_UPLOADS = _TEST_ROOT / "uploads" / "contracts"
_TEST_FILES.mkdir(parents=True, exist_ok=True)
_TEST_UPLOADS.mkdir(parents=True, exist_ok=True)

os.environ["ZHUBO_DATABASE_URL"] = f"sqlite:///{_TEST_DB.as_posix()}"
os.environ["ZHUBO_FILES_DIR"] = str(_TEST_FILES)
os.environ["ZHUBO_UPLOAD_DIR"] = str(_TEST_UPLOADS)
os.environ["ZHUBO_SECRET_KEY"] = "pytest-secret-do-not-use"

# 确保 backend/ 在 sys.path 上（兼容直接 `pytest tests` 的情况）
_BACKEND_DIR = pathlib.Path(__file__).resolve().parent.parent
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

# 现在才能导入 app
import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.database import Base, SessionLocal, engine  # noqa: E402


# ============== 2. session 级清理 ==============
@pytest.fixture(scope="session", autouse=True)
def _session_cleanup() -> Iterator[None]:
    yield
    try:
        shutil.rmtree(_TEST_ROOT, ignore_errors=True)
    except Exception:
        pass


# ============== 3. 每个测试前重置业务数据（保留 users 表） ==============
PRESERVED_TABLES = {"users"}


@pytest.fixture(autouse=True)
def _reset_db_each_test() -> Iterator[None]:
    """每个测试函数前清空除 users 外的全部业务表，并清掉临时 files / uploads 子目录。"""
    db = SessionLocal()
    try:
        for table in reversed(Base.metadata.sorted_tables):
            if table.name in PRESERVED_TABLES:
                continue
            db.execute(table.delete())
        db.commit()
    finally:
        db.close()

    # 清 files 子目录
    for child in list(_TEST_FILES.iterdir()):
        if child.is_dir():
            shutil.rmtree(child, ignore_errors=True)
        else:
            try:
                child.unlink()
            except OSError:
                pass
    # 清合同附件
    for child in list(_TEST_UPLOADS.iterdir()):
        try:
            child.unlink()
        except OSError:
            pass
    yield


# ============== 4. 客户端 & 认证 fixture ==============
@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as c:
        yield c


def login(client: TestClient, username: str, password: str) -> str:
    res = client.post("/api/auth/login", json={"username": username, "password": password})
    assert res.status_code == 200, f"login failed: {res.status_code} {res.text}"
    return res.json()["access_token"]


def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def admin_token(client: TestClient) -> str:
    return login(client, "admin", "admin123")


@pytest.fixture
def operator_token(client: TestClient) -> str:
    return login(client, "operator", "operator123")


@pytest.fixture
def finance_token(client: TestClient) -> str:
    return login(client, "finance", "finance123")


# ============== 5. 公用业务 helper ==============
def create_anchor(client: TestClient, token: str, **overrides) -> dict:
    """快速创建一个主播，返回响应 JSON。"""
    payload = {
        "name": overrides.pop("name", "测试主播"),
        "stage_name": overrides.pop("stage_name", "测试艺名"),
        "status": overrides.pop("status", "active"),
    }
    payload.update(overrides)
    res = client.post("/api/anchors", json=payload, headers=auth_headers(token))
    assert res.status_code == 201, f"create_anchor failed: {res.status_code} {res.text}"
    return res.json()
