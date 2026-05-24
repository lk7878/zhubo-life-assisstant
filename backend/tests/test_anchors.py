"""主播 CRUD、搜索、级联、成长阶段"""
from datetime import date, timedelta
from tests.conftest import auth_headers, create_anchor


def test_create_anchor(client, admin_token):
    res = client.post(
        "/api/anchors",
        json={"name": "张三", "stage_name": "小三", "status": "active", "phone": "13800000001"},
        headers=auth_headers(admin_token),
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["name"] == "张三"
    assert body["stage_name"] == "小三"
    assert body["live_stats"]["session_count"] == 0
    assert body["growth_stage"] in {"newbie", "growth", "mature", "top"}


def test_get_anchor(client, admin_token):
    anchor = create_anchor(client, admin_token, name="A", stage_name="A")
    res = client.get(f"/api/anchors/{anchor['id']}", headers=auth_headers(admin_token))
    assert res.status_code == 200
    assert res.json()["id"] == anchor["id"]


def test_get_anchor_404(client, admin_token):
    res = client.get("/api/anchors/no-such-id", headers=auth_headers(admin_token))
    assert res.status_code == 404


def test_list_anchors(client, admin_token):
    create_anchor(client, admin_token, name="A", stage_name="A")
    create_anchor(client, admin_token, name="B", stage_name="B")
    res = client.get("/api/anchors", headers=auth_headers(admin_token))
    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 2
    assert len(body["items"]) == 2


def test_list_anchors_search(client, admin_token):
    create_anchor(client, admin_token, name="艾米", stage_name="小米")
    create_anchor(client, admin_token, name="比尔", stage_name="阿伯")
    res = client.get("/api/anchors", params={"search": "米"}, headers=auth_headers(admin_token))
    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 1
    assert body["items"][0]["name"] == "艾米"


def test_list_anchors_status_filter(client, admin_token):
    create_anchor(client, admin_token, name="A", stage_name="A", status="active")
    create_anchor(client, admin_token, name="B", stage_name="B", status="onboarding")
    res = client.get("/api/anchors", params={"status": "active"}, headers=auth_headers(admin_token))
    assert res.json()["total"] == 1


def test_list_pagination(client, admin_token):
    for i in range(5):
        create_anchor(client, admin_token, name=f"A{i}", stage_name=f"A{i}")
    res = client.get(
        "/api/anchors",
        params={"skip": 2, "limit": 2},
        headers=auth_headers(admin_token),
    )
    body = res.json()
    assert body["total"] == 5
    assert len(body["items"]) == 2


def test_update_anchor(client, admin_token):
    anchor = create_anchor(client, admin_token, name="A", stage_name="A")
    res = client.put(
        f"/api/anchors/{anchor['id']}",
        json={"name": "改名后", "remark": "备注"},
        headers=auth_headers(admin_token),
    )
    assert res.status_code == 200
    assert res.json()["name"] == "改名后"
    assert res.json()["remark"] == "备注"


def test_update_anchor_404(client, admin_token):
    res = client.put(
        "/api/anchors/no-such-id",
        json={"name": "x"},
        headers=auth_headers(admin_token),
    )
    assert res.status_code == 404


def test_delete_anchor(client, admin_token):
    anchor = create_anchor(client, admin_token, name="A", stage_name="A")
    res = client.delete(f"/api/anchors/{anchor['id']}", headers=auth_headers(admin_token))
    assert res.status_code == 204
    # 二次删除 404
    res2 = client.delete(f"/api/anchors/{anchor['id']}", headers=auth_headers(admin_token))
    assert res2.status_code == 404


def test_anchor_timeline_empty(client, admin_token):
    anchor = create_anchor(client, admin_token, name="A", stage_name="A")
    res = client.get(f"/api/anchors/{anchor['id']}/timeline", headers=auth_headers(admin_token))
    assert res.status_code == 200
    assert res.json() == []


def test_growth_stage_newbie_for_fresh(client, admin_token):
    """无 hire_date 且无直播 → newbie"""
    anchor = create_anchor(client, admin_token, name="新人", stage_name="新")
    assert anchor["growth_stage"] == "newbie"


def test_growth_stage_mature_by_months(client, admin_token):
    """hire_date 早于 6 个月前 → mature（仅按月数判定也会 mature）。"""
    hire = (date.today() - timedelta(days=200)).isoformat()
    anchor = create_anchor(client, admin_token, name="老人", stage_name="老", hire_date=hire)
    assert anchor["growth_stage"] in {"mature", "top"}


def test_growth_stage_growth_by_months(client, admin_token):
    """hire_date 早于 3 个月，但不到 6 个月 → growth"""
    hire = (date.today() - timedelta(days=100)).isoformat()
    anchor = create_anchor(client, admin_token, name="N", stage_name="N", hire_date=hire)
    assert anchor["growth_stage"] == "growth"
