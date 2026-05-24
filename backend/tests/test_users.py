"""用户管理：仅 admin 可访问"""
from tests.conftest import auth_headers, login


def test_list_users_admin(client, admin_token):
    res = client.get("/api/users", headers=auth_headers(admin_token))
    assert res.status_code == 200
    body = res.json()
    assert body["total"] >= 3
    usernames = {u["username"] for u in body["items"]}
    assert {"admin", "operator", "finance"}.issubset(usernames)


def test_list_users_operator_forbidden(client, operator_token):
    res = client.get("/api/users", headers=auth_headers(operator_token))
    assert res.status_code == 403


def test_list_users_finance_forbidden(client, finance_token):
    res = client.get("/api/users", headers=auth_headers(finance_token))
    assert res.status_code == 403


def test_list_users_anonymous(client):
    res = client.get("/api/users")
    assert res.status_code == 401


def test_create_user(client, admin_token):
    res = client.post(
        "/api/users",
        json={
            "username": "tester1",
            "password": "Test@1234",
            "real_name": "测试员",
            "role": "operator",
            "is_active": True,
        },
        headers=auth_headers(admin_token),
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["username"] == "tester1"
    assert body["role"] == "operator"

    # 新用户可登录
    token = login(client, "tester1", "Test@1234")
    me = client.get("/api/auth/me", headers=auth_headers(token))
    assert me.status_code == 200


def test_create_user_duplicate_username(client, admin_token):
    payload = {"username": "dup", "password": "abc1234", "real_name": "X", "role": "operator"}
    r1 = client.post("/api/users", json=payload, headers=auth_headers(admin_token))
    assert r1.status_code == 201
    r2 = client.post("/api/users", json=payload, headers=auth_headers(admin_token))
    assert r2.status_code == 400


def test_reset_user_password(client, admin_token):
    create = client.post(
        "/api/users",
        json={"username": "rp", "password": "abc1234", "real_name": "RP", "role": "operator"},
        headers=auth_headers(admin_token),
    )
    assert create.status_code == 201
    uid = create.json()["id"]

    res = client.put(
        f"/api/users/{uid}/password",
        json={"new_password": "Reset@123"},
        headers=auth_headers(admin_token),
    )
    assert res.status_code == 200

    # 旧密码失败、新密码成功
    assert client.post("/api/auth/login", json={"username": "rp", "password": "abc1234"}).status_code == 401
    assert client.post("/api/auth/login", json={"username": "rp", "password": "Reset@123"}).status_code == 200


def test_disable_user_blocks_login(client, admin_token):
    create = client.post(
        "/api/users",
        json={"username": "disme", "password": "abc1234", "real_name": "D", "role": "operator"},
        headers=auth_headers(admin_token),
    )
    uid = create.json()["id"]
    # 停用
    upd = client.put(
        f"/api/users/{uid}",
        json={"is_active": False},
        headers=auth_headers(admin_token),
    )
    assert upd.status_code == 200
    # 登录被拒
    login_res = client.post("/api/auth/login", json={"username": "disme", "password": "abc1234"})
    assert login_res.status_code == 403


def test_delete_user(client, admin_token):
    create = client.post(
        "/api/users",
        json={"username": "delme", "password": "abc1234", "real_name": "X", "role": "operator"},
        headers=auth_headers(admin_token),
    )
    uid = create.json()["id"]
    res = client.delete(f"/api/users/{uid}", headers=auth_headers(admin_token))
    assert res.status_code in (200, 204)
    # 再删一次返回 404
    res2 = client.delete(f"/api/users/{uid}", headers=auth_headers(admin_token))
    assert res2.status_code == 404


def test_cannot_delete_self(client, admin_token):
    me = client.get("/api/auth/me", headers=auth_headers(admin_token)).json()
    res = client.delete(f"/api/users/{me['id']}", headers=auth_headers(admin_token))
    # 业务上一般不允许删除自己，看实现可能是 400/403
    assert res.status_code in (400, 403, 409)
