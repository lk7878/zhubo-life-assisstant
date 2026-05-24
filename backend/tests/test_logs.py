"""操作日志：自动产生 + 查询接口"""
from tests.conftest import auth_headers, create_anchor


def test_log_created_on_create_anchor(client, admin_token):
    create_anchor(client, admin_token, name="日志主播", stage_name="日志")
    res = client.get("/api/logs", headers=auth_headers(admin_token))
    assert res.status_code == 200
    items = res.json()["items"]
    assert any(it["target_type"] == "anchor" and it["action"] == "create" for it in items)


def test_log_records_operator(client, admin_token):
    """日志的 operator 字段应记录当前用户的 real_name 或 username"""
    me = client.get("/api/auth/me", headers=auth_headers(admin_token)).json()
    expected = {me.get("real_name") or me["username"], me["username"]}

    create_anchor(client, admin_token, name="X", stage_name="X")
    res = client.get("/api/logs", headers=auth_headers(admin_token))
    item = next(
        it for it in res.json()["items"]
        if it["target_type"] == "anchor" and it["action"] == "create"
    )
    assert item["operator"] in expected


def test_log_order_desc(client, admin_token):
    """最新日志在前。"""
    create_anchor(client, admin_token, name="A", stage_name="A")
    create_anchor(client, admin_token, name="B", stage_name="B")
    res = client.get("/api/logs", headers=auth_headers(admin_token))
    items = res.json()["items"]
    # 至少有两条 create
    create_logs = [it for it in items if it["action"] == "create" and it["target_type"] == "anchor"]
    assert len(create_logs) >= 2
    # 时间倒序
    times = [it["created_at"] for it in create_logs]
    assert times == sorted(times, reverse=True)


def test_log_pagination(client, admin_token):
    for i in range(5):
        create_anchor(client, admin_token, name=f"N{i}", stage_name=f"N{i}")
    res = client.get("/api/logs", params={"skip": 0, "limit": 3}, headers=auth_headers(admin_token))
    body = res.json()
    assert body["total"] >= 5
    assert len(body["items"]) == 3


def test_log_anonymous_blocked(client):
    assert client.get("/api/logs").status_code == 401
