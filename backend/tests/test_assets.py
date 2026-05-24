"""资产：直播间 / 设备 / 借用记录 全流程"""
from datetime import date, timedelta
from tests.conftest import auth_headers, create_anchor


def _create_room(client, token, **overrides) -> dict:
    payload = {
        "name": overrides.pop("name", "1 号直播间"),
        "platform_account": overrides.pop("platform_account", "ks_001"),
        "status": overrides.pop("status", "active"),
    }
    payload.update(overrides)
    res = client.post("/api/live-rooms", json=payload, headers=auth_headers(token))
    assert res.status_code == 201, res.text
    return res.json()


def _create_equipment(client, token, **overrides) -> dict:
    payload = {
        "name": overrides.pop("name", "手机 A"),
        "category": overrides.pop("category", "phone"),
        "status": overrides.pop("status", "in_stock"),
    }
    payload.update(overrides)
    res = client.post("/api/equipment", json=payload, headers=auth_headers(token))
    assert res.status_code == 201, res.text
    return res.json()


# ---------- LiveRoom ----------
def test_create_and_get_room(client, admin_token):
    room = _create_room(client, admin_token, name="A 间", platform_account="ks_a")
    res = client.get(f"/api/live-rooms/{room['id']}", headers=auth_headers(admin_token))
    assert res.status_code == 200
    assert res.json()["name"] == "A 间"
    assert res.json()["equipment_count"] == 0


def test_list_rooms_search(client, admin_token):
    _create_room(client, admin_token, name="主直播间", platform_account="ks_1")
    _create_room(client, admin_token, name="副直播间", platform_account="ks_2")
    res = client.get(
        "/api/live-rooms",
        params={"search": "主"},
        headers=auth_headers(admin_token),
    )
    assert res.json()["total"] == 1


def test_assign_anchor_to_room(client, admin_token):
    a = create_anchor(client, admin_token)
    room = _create_room(client, admin_token, assigned_anchor_id=a["id"])
    assert room["assigned_anchor_id"] == a["id"]
    assert room["assigned_anchor_name"]


def test_delete_room_with_equipment_blocked(client, admin_token):
    room = _create_room(client, admin_token)
    _create_equipment(client, admin_token, live_room_id=room["id"], sn="SN-001")
    res = client.delete(f"/api/live-rooms/{room['id']}", headers=auth_headers(admin_token))
    assert res.status_code == 400


# ---------- Equipment ----------
def test_create_equipment_duplicate_sn(client, admin_token):
    _create_equipment(client, admin_token, sn="SN-DUP")
    res = client.post(
        "/api/equipment",
        json={"name": "x", "category": "phone", "sn": "SN-DUP"},
        headers=auth_headers(admin_token),
    )
    assert res.status_code == 400


def test_update_equipment(client, admin_token):
    e = _create_equipment(client, admin_token, sn="SN-A")
    res = client.put(
        f"/api/equipment/{e['id']}",
        json={"name": "更新后", "location": "仓库"},
        headers=auth_headers(admin_token),
    )
    assert res.status_code == 200
    assert res.json()["name"] == "更新后"
    assert res.json()["location"] == "仓库"


def test_delete_in_stock_equipment(client, admin_token):
    e = _create_equipment(client, admin_token, sn="SN-RM")
    res = client.delete(f"/api/equipment/{e['id']}", headers=auth_headers(admin_token))
    assert res.status_code == 204


# ---------- EquipmentLoan ----------
def test_loan_lifecycle(client, admin_token):
    a = create_anchor(client, admin_token)
    e = _create_equipment(client, admin_token, sn="LOAN-A")

    # 借出
    borrow = client.post(
        "/api/equipment-loans",
        json={
            "equipment_id": e["id"],
            "anchor_id": a["id"],
            "expected_return_at": (date.today() + timedelta(days=7)).isoformat(),
            "borrow_note": "拍摄用",
        },
        headers=auth_headers(admin_token),
    )
    assert borrow.status_code == 201, borrow.text
    loan = borrow.json()
    assert loan["status"] == "borrowed"

    # 此时设备状态 = borrowed
    e_now = client.get(f"/api/equipment/{e['id']}", headers=auth_headers(admin_token)).json()
    assert e_now["status"] == "borrowed"
    assert e_now["current_holder_id"] == a["id"]

    # 借出中设备不能删除
    bad = client.delete(f"/api/equipment/{e['id']}", headers=auth_headers(admin_token))
    assert bad.status_code == 400

    # 同一设备不能再借
    again = client.post(
        "/api/equipment-loans",
        json={"equipment_id": e["id"], "anchor_id": a["id"]},
        headers=auth_headers(admin_token),
    )
    assert again.status_code == 400

    # 归还
    ret = client.put(
        f"/api/equipment-loans/{loan['id']}/return",
        json={"status": "returned", "condition_on_return": "完好"},
        headers=auth_headers(admin_token),
    )
    assert ret.status_code == 200
    assert ret.json()["status"] == "returned"
    assert ret.json()["returned_at"] is not None

    # 设备回到 in_stock
    e_back = client.get(f"/api/equipment/{e['id']}", headers=auth_headers(admin_token)).json()
    assert e_back["status"] == "in_stock"
    assert e_back["current_holder_id"] is None

    # 已归还的借用记录可以删除
    rm = client.delete(f"/api/equipment-loans/{loan['id']}", headers=auth_headers(admin_token))
    assert rm.status_code == 204


def test_overdue_auto_in_list(client, admin_token):
    """list 时如果 expected_return_at < 今天，会自动标记 overdue"""
    a = create_anchor(client, admin_token)
    e = _create_equipment(client, admin_token, sn="OVD")
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    res = client.post(
        "/api/equipment-loans",
        json={"equipment_id": e["id"], "anchor_id": a["id"], "expected_return_at": yesterday},
        headers=auth_headers(admin_token),
    )
    assert res.status_code == 201

    listed = client.get("/api/equipment-loans", headers=auth_headers(admin_token)).json()
    assert any(l["status"] == "overdue" for l in listed["items"])


def test_return_damaged_marks_maintenance(client, admin_token):
    a = create_anchor(client, admin_token)
    e = _create_equipment(client, admin_token, sn="DAM")
    loan = client.post(
        "/api/equipment-loans",
        json={"equipment_id": e["id"], "anchor_id": a["id"]},
        headers=auth_headers(admin_token),
    ).json()
    ret = client.put(
        f"/api/equipment-loans/{loan['id']}/return",
        json={"status": "damaged"},
        headers=auth_headers(admin_token),
    )
    assert ret.status_code == 200
    e_now = client.get(f"/api/equipment/{e['id']}", headers=auth_headers(admin_token)).json()
    assert e_now["status"] == "maintenance"


def test_finance_cannot_write_assets(client, admin_token, finance_token):
    a = create_anchor(client, admin_token)
    # finance 不能建直播间
    r = client.post(
        "/api/live-rooms",
        json={"name": "x"},
        headers=auth_headers(finance_token),
    )
    assert r.status_code == 403

    # 但能读
    g = client.get("/api/live-rooms", headers=auth_headers(finance_token))
    assert g.status_code == 200
