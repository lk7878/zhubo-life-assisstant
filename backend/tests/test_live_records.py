"""直播记录 CRUD + 聚合统计影响 anchor.live_stats"""
from tests.conftest import auth_headers, create_anchor


def _create_record(client, token, anchor_id, **overrides) -> dict:
    payload = {
        "anchor_id": anchor_id,
        "live_date": overrides.pop("live_date", "2025-01-15T20:00:00"),
        "duration_minutes": overrides.pop("duration_minutes", 120),
        "viewers_count": overrides.pop("viewers_count", 1000),
        "gmv": overrides.pop("gmv", 5000.0),
        "orders_count": overrides.pop("orders_count", 20),
        "new_followers": overrides.pop("new_followers", 50),
        "conversion_rate": overrides.pop("conversion_rate", 2.5),
    }
    payload.update(overrides)
    res = client.post("/api/live-records", json=payload, headers=auth_headers(token))
    assert res.status_code == 201, res.text
    return res.json()


def test_create_record(client, admin_token):
    a = create_anchor(client, admin_token)
    rec = _create_record(client, admin_token, a["id"], gmv=8888.0)
    assert rec["gmv"] == 8888.0
    assert rec["anchor_id"] == a["id"]


def test_create_record_unknown_anchor(client, admin_token):
    res = client.post(
        "/api/live-records",
        json={"anchor_id": "no-such", "live_date": "2025-01-01T20:00:00"},
        headers=auth_headers(admin_token),
    )
    assert res.status_code == 404


def test_list_records_filter(client, admin_token):
    a = create_anchor(client, admin_token, name="A", stage_name="A")
    b = create_anchor(client, admin_token, name="B", stage_name="B")
    _create_record(client, admin_token, a["id"])
    _create_record(client, admin_token, b["id"])
    res = client.get(
        "/api/live-records",
        params={"anchor_id": a["id"]},
        headers=auth_headers(admin_token),
    )
    body = res.json()
    assert body["total"] == 1
    assert body["items"][0]["anchor_id"] == a["id"]


def test_update_and_delete(client, admin_token):
    a = create_anchor(client, admin_token)
    rec = _create_record(client, admin_token, a["id"])
    upd = client.put(
        f"/api/live-records/{rec['id']}",
        json={"gmv": 9999.0},
        headers=auth_headers(admin_token),
    )
    assert upd.status_code == 200
    assert upd.json()["gmv"] == 9999.0

    rm = client.delete(f"/api/live-records/{rec['id']}", headers=auth_headers(admin_token))
    assert rm.status_code == 204
    assert client.delete(f"/api/live-records/{rec['id']}", headers=auth_headers(admin_token)).status_code == 404


def test_anchor_live_stats_aggregated(client, admin_token):
    a = create_anchor(client, admin_token)
    _create_record(client, admin_token, a["id"], gmv=1000.0, duration_minutes=60, viewers_count=500)
    _create_record(client, admin_token, a["id"], gmv=3000.0, duration_minutes=120, viewers_count=1500)

    res = client.get(f"/api/anchors/{a['id']}", headers=auth_headers(admin_token))
    stats = res.json()["live_stats"]
    assert stats["session_count"] == 2
    assert stats["total_gmv"] == 4000.0
    assert stats["total_duration_minutes"] == 180
    assert stats["avg_gmv"] == 2000.0
    assert stats["avg_viewers"] == 1000.0


def test_finance_can_only_read_live_records(client, admin_token, finance_token):
    a = create_anchor(client, admin_token)
    _create_record(client, admin_token, a["id"])

    # finance 可读
    r = client.get("/api/live-records", headers=auth_headers(finance_token))
    assert r.status_code == 200

    # finance 不可写
    w = client.post(
        "/api/live-records",
        json={"anchor_id": a["id"], "live_date": "2025-02-01T10:00:00"},
        headers=auth_headers(finance_token),
    )
    assert w.status_code == 403
