"""培训 + 参训登记 + 签到 + 培训前后效果对比"""
from datetime import datetime, timedelta
from tests.conftest import auth_headers, create_anchor


def _create_training(client, token, *, anchor_ids=None, **overrides) -> dict:
    payload = {
        "title": overrides.pop("title", "培训 A"),
        "training_type": overrides.pop("training_type", "skill"),
        "start_time": overrides.pop("start_time", "2025-03-15T09:00:00"),
        "end_time": overrides.pop("end_time", "2025-03-15T12:00:00"),
        "mode": overrides.pop("mode", "online"),
        "status": overrides.pop("status", "planned"),
        "anchor_ids": anchor_ids or [],
    }
    payload.update(overrides)
    res = client.post("/api/trainings", json=payload, headers=auth_headers(token))
    assert res.status_code == 201, res.text
    return res.json()


def test_create_training_with_attendees(client, admin_token):
    a = create_anchor(client, admin_token, name="主播A")
    b = create_anchor(client, admin_token, name="主播B")
    t = _create_training(client, admin_token, anchor_ids=[a["id"], b["id"]])
    assert t["attendance_count"] == 2
    assert len(t["attendances"]) == 2


def test_list_trainings_filter(client, admin_token):
    _create_training(client, admin_token, title="T1", training_type="skill")
    _create_training(client, admin_token, title="T2", training_type="compliance")
    res = client.get(
        "/api/trainings",
        params={"training_type": "compliance"},
        headers=auth_headers(admin_token),
    )
    items = res.json()["items"]
    assert len(items) == 1
    assert items[0]["title"] == "T2"


def test_update_training(client, admin_token):
    t = _create_training(client, admin_token, title="原")
    res = client.put(
        f"/api/trainings/{t['id']}",
        json={"title": "改名", "status": "completed"},
        headers=auth_headers(admin_token),
    )
    assert res.status_code == 200
    assert res.json()["title"] == "改名"
    assert res.json()["status"] == "completed"


def test_add_attendance_and_dedupe(client, admin_token):
    a = create_anchor(client, admin_token)
    b = create_anchor(client, admin_token, name="B", stage_name="B")
    t = _create_training(client, admin_token, anchor_ids=[a["id"]])

    # 同一个主播再添加 → 跳过
    res = client.post(
        f"/api/trainings/{t['id']}/attendances",
        json={"anchor_ids": [a["id"], b["id"]]},
        headers=auth_headers(admin_token),
    )
    assert res.status_code == 201
    # 这次只新增了 b
    assert len(res.json()) == 1
    assert res.json()[0]["anchor_id"] == b["id"]


def test_check_in_sets_time_automatically(client, admin_token):
    a = create_anchor(client, admin_token)
    t = _create_training(client, admin_token, anchor_ids=[a["id"]])
    att_id = t["attendances"][0]["id"]
    res = client.put(
        f"/api/attendances/{att_id}",
        json={"status": "checked_in"},
        headers=auth_headers(admin_token),
    )
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "checked_in"
    assert body["check_in_time"] is not None


def test_delete_attendance(client, admin_token):
    a = create_anchor(client, admin_token)
    t = _create_training(client, admin_token, anchor_ids=[a["id"]])
    att_id = t["attendances"][0]["id"]
    res = client.delete(f"/api/attendances/{att_id}", headers=auth_headers(admin_token))
    assert res.status_code == 204


def test_delete_training_404(client, admin_token):
    res = client.delete("/api/trainings/no-such", headers=auth_headers(admin_token))
    assert res.status_code == 404


def test_training_effect_compares_before_after(client, admin_token):
    a = create_anchor(client, admin_token)
    # pivot 培训时间
    pivot = "2025-04-15T10:00:00"
    t = _create_training(client, admin_token, anchor_ids=[a["id"]], start_time=pivot)
    att_id = t["attendances"][0]["id"]

    # 培训前后各 2 场直播
    base = datetime(2025, 4, 15, 10, 0, 0)
    for offset, gmv in [(-5, 1000), (-2, 2000), (1, 5000), (3, 6000)]:
        client.post(
            "/api/live-records",
            json={
                "anchor_id": a["id"],
                "live_date": (base + timedelta(days=offset)).isoformat(),
                "gmv": gmv,
                "duration_minutes": 60,
                "viewers_count": 100 + abs(offset) * 10,
            },
            headers=auth_headers(admin_token),
        )

    res = client.get(
        f"/api/attendances/{att_id}/effect",
        params={"window_days": 7},
        headers=auth_headers(admin_token),
    )
    assert res.status_code == 200
    body = res.json()
    assert body["sessions_before"] == 2
    assert body["sessions_after"] == 2
    # GMV 指标对比应当 after > before
    gmv_metric = next(m for m in body["metrics"] if "GMV" in m["label"])
    assert gmv_metric["before"] == 1500.0
    assert gmv_metric["after"] == 5500.0
    assert gmv_metric["delta"] == 4000.0


def test_finance_cannot_create_training(client, finance_token):
    res = client.post(
        "/api/trainings",
        json={
            "title": "X", "training_type": "skill",
            "start_time": "2025-01-01T00:00:00",
            "mode": "online", "status": "planned",
            "anchor_ids": [],
        },
        headers=auth_headers(finance_token),
    )
    assert res.status_code == 403
