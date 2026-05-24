"""认证、登录、修改密码、token 校验"""
from tests.conftest import auth_headers, login


def test_health(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


def test_login_success(client):
    res = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
    assert res.status_code == 200
    body = res.json()
    assert "access_token" in body
    assert body["user"]["username"] == "admin"
    assert body["user"]["role"] == "admin"


def test_login_wrong_password(client):
    res = client.post("/api/auth/login", json={"username": "admin", "password": "wrong"})
    assert res.status_code == 401


def test_login_unknown_user(client):
    res = client.post("/api/auth/login", json={"username": "no-such-user", "password": "x"})
    assert res.status_code == 401


def test_login_missing_field(client):
    res = client.post("/api/auth/login", json={"username": "admin"})
    # FastAPI 自动产生 422 校验错误
    assert res.status_code == 422


def test_me_requires_token(client):
    res = client.get("/api/auth/me")
    assert res.status_code == 401


def test_me_with_token(client, admin_token):
    res = client.get("/api/auth/me", headers=auth_headers(admin_token))
    assert res.status_code == 200
    assert res.json()["username"] == "admin"


def test_me_with_invalid_token(client):
    res = client.get("/api/auth/me", headers={"Authorization": "Bearer not-a-token"})
    assert res.status_code == 401


def test_logout(client, admin_token):
    res = client.post("/api/auth/logout", headers=auth_headers(admin_token))
    assert res.status_code == 200
    assert res.json() == {"ok": True}


def test_change_password_success(client, operator_token):
    # 改密码
    res = client.put(
        "/api/auth/change-password",
        json={"old_password": "operator123", "new_password": "Op@123456"},
        headers=auth_headers(operator_token),
    )
    assert res.status_code == 200

    # 旧密码不再可用
    bad = client.post("/api/auth/login", json={"username": "operator", "password": "operator123"})
    assert bad.status_code == 401

    # 新密码可用
    new_token = login(client, "operator", "Op@123456")
    assert new_token

    # 改回原密码（不依赖测试间状态，单元独立的话其实不需要，但保险起见）
    res2 = client.put(
        "/api/auth/change-password",
        json={"old_password": "Op@123456", "new_password": "operator123"},
        headers=auth_headers(new_token),
    )
    assert res2.status_code == 200


def test_change_password_wrong_old(client, operator_token):
    res = client.put(
        "/api/auth/change-password",
        json={"old_password": "wrong-old", "new_password": "abc1234"},
        headers=auth_headers(operator_token),
    )
    assert res.status_code == 400


def test_change_password_too_short(client, operator_token):
    res = client.put(
        "/api/auth/change-password",
        json={"old_password": "operator123", "new_password": "12345"},
        headers=auth_headers(operator_token),
    )
    assert res.status_code == 400


def test_three_default_users_exist(client):
    # 三个默认账号都能登录
    for u, p in [("admin", "admin123"), ("operator", "operator123"), ("finance", "finance123")]:
        res = client.post("/api/auth/login", json={"username": u, "password": p})
        assert res.status_code == 200, f"{u} login failed: {res.text}"
