"""通用安全/权限边界用例"""
from tests.conftest import auth_headers, create_anchor


# ---- 未登录访问 ----
def test_anonymous_blocked_anchors(client):
    assert client.get("/api/anchors").status_code == 401


def test_anonymous_blocked_dashboard(client):
    assert client.get("/api/dashboard/overview").status_code == 401


def test_anonymous_blocked_logs(client):
    assert client.get("/api/logs").status_code == 401


# ---- 角色越权（直接调 API，绕过前端） ----
def test_finance_cannot_create_anchor(client, finance_token):
    res = client.post(
        "/api/anchors",
        json={"name": "X", "stage_name": "Y", "status": "active"},
        headers=auth_headers(finance_token),
    )
    # finance 仅可读业务，写入应当被拒
    assert res.status_code in (401, 403)


def test_operator_cannot_write_salary(client, admin_token, operator_token):
    # 用 admin 先建一个主播以备用
    anchor = create_anchor(client, admin_token, name="A", stage_name="A艺名")

    # operator 尝试写入薪资配置 → 403
    res = client.put(
        f"/api/salary/configs/anchor/{anchor['id']}",
        json={"base_salary": 5000, "daily_base": 200, "commission_tiers": []},
        headers=auth_headers(operator_token),
    )
    assert res.status_code == 403


def test_operator_cannot_terminate_contract(client, admin_token, operator_token):
    anchor = create_anchor(client, admin_token, name="A", stage_name="A艺名")
    cres = client.post(
        "/api/contracts",
        json={
            "anchor_id": anchor["id"],
            "contract_type": "formal",
            "party_a": "公司",
            "start_date": "2026-01-01",
            "end_date": "2027-01-01",
        },
        headers=auth_headers(admin_token),
    )
    assert cres.status_code == 201
    cid = cres.json()["id"]

    res = client.put(
        f"/api/contracts/{cid}/terminate",
        json={"terminated_at": "2026-06-01", "termination_reason": "test"},
        headers=auth_headers(operator_token),
    )
    assert res.status_code == 403


# ---- 注入 / 异常输入 ----
def test_sql_injection_in_search(client, admin_token):
    """搜索参数带单引号也不应当造成 500（SQLAlchemy 已参数化）。"""
    res = client.get(
        "/api/anchors",
        params={"search": "' OR '1'='1"},
        headers=auth_headers(admin_token),
    )
    assert res.status_code == 200
    assert res.json()["total"] == 0


def test_invalid_token_format(client):
    res = client.get("/api/anchors", headers={"Authorization": "garbage"})
    assert res.status_code == 401


def test_bearer_no_token(client):
    res = client.get("/api/anchors", headers={"Authorization": "Bearer "})
    assert res.status_code == 401
