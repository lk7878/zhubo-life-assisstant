"""薪资：阶梯提成算法 + 配置 + 结算单全流程，并验证 operator 写权限受限。"""
from tests.conftest import auth_headers, create_anchor


def _create_live(client, token, anchor_id, *, live_date, gmv):
    res = client.post(
        "/api/live-records",
        json={"anchor_id": anchor_id, "live_date": live_date, "gmv": gmv, "duration_minutes": 60},
        headers=auth_headers(token),
    )
    assert res.status_code == 201, res.text
    return res.json()


def test_get_default_config_lazy_create(client, admin_token):
    res = client.get("/api/salary/configs/default", headers=auth_headers(admin_token))
    assert res.status_code == 200
    body = res.json()
    assert body["is_default"] is True
    assert body["base_salary"] > 0
    assert isinstance(body["commission_tiers"], list)
    assert len(body["commission_tiers"]) >= 1


def test_anchor_config_inherits_default(client, admin_token):
    a = create_anchor(client, admin_token)
    res = client.get(f"/api/salary/configs/anchor/{a['id']}", headers=auth_headers(admin_token))
    assert res.status_code == 200
    body = res.json()
    # 没单独设置时，is_default 字段为 False（不是默认配置）但内容继承自默认
    assert body["base_salary"] > 0
    assert "继承" in (body.get("remark") or "")


def test_finance_can_update_default_config(client, finance_token):
    res = client.put(
        "/api/salary/configs/default",
        json={
            "base_salary": 4000,
            "daily_base": 150,
            "commission_tiers": [
                {"min": 0, "max": 10000, "rate": 5},
                {"min": 10000, "max": None, "rate": 10},
            ],
        },
        headers=auth_headers(finance_token),
    )
    assert res.status_code == 200
    assert res.json()["base_salary"] == 4000
    assert res.json()["daily_base"] == 150


def test_operator_cannot_update_default_config(client, operator_token):
    res = client.put(
        "/api/salary/configs/default",
        json={"base_salary": 5000, "daily_base": 200, "commission_tiers": []},
        headers=auth_headers(operator_token),
    )
    assert res.status_code == 403


def test_preview_uses_default_tier_formula(client, admin_token):
    """默认阶梯 0-1w 5% / 1-5w 8% / 5-20w 12% / 20w+ 15%, GMV=8w → 7300"""
    a = create_anchor(client, admin_token)
    _create_live(client, admin_token, a["id"], live_date="2025-03-01T20:00:00", gmv=80000)
    res = client.post(
        "/api/salary/preview",
        json={
            "anchor_id": a["id"],
            "period_type": "month",
            "period_start": "2025-03-01",
            "period_end": "2025-03-31",
        },
        headers=auth_headers(admin_token),
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["total_gmv"] == 80000.0
    # 1万*5% + 4万*8% + 3万*12% = 500 + 3200 + 3600 = 7300
    assert body["commission"] == 7300.0
    assert body["base_salary"] == 3000.0  # 默认月底薪
    assert body["total_payable"] == 10300.0


def test_preview_day_period_uses_daily_base(client, admin_token, finance_token):
    """day 期间 → 底薪 = daily_base * 天数"""
    # 先设默认 daily_base=200
    client.put(
        "/api/salary/configs/default",
        json={
            "base_salary": 3000,
            "daily_base": 200,
            "commission_tiers": [{"min": 0, "max": None, "rate": 10}],
        },
        headers=auth_headers(finance_token),
    )
    a = create_anchor(client, admin_token)
    _create_live(client, admin_token, a["id"], live_date="2025-03-10T20:00:00", gmv=10000)
    res = client.post(
        "/api/salary/preview",
        json={
            "anchor_id": a["id"],
            "period_type": "day",
            "period_start": "2025-03-10",
            "period_end": "2025-03-12",
        },
        headers=auth_headers(admin_token),
    )
    body = res.json()
    # 3 天 * 200 = 600
    assert body["base_salary"] == 600.0
    # 1w * 10% = 1000
    assert body["commission"] == 1000.0


def test_salary_record_lifecycle(client, admin_token, finance_token):
    a = create_anchor(client, admin_token)
    _create_live(client, admin_token, a["id"], live_date="2025-04-05T20:00:00", gmv=20000)

    # 创建（finance）
    rec = client.post(
        "/api/salary/records",
        json={
            "anchor_id": a["id"],
            "period_type": "month",
            "period_start": "2025-04-01",
            "period_end": "2025-04-30",
            "bonus": 500,
            "deduction": 100,
        },
        headers=auth_headers(finance_token),
    )
    assert rec.status_code == 201, rec.text
    rec_body = rec.json()
    rid = rec_body["id"]
    assert rec_body["status"] == "draft"
    # 1万*5% + 1万*8% = 500 + 800 = 1300
    assert rec_body["commission"] == 1300.0
    # 3000 + 1300 + 500 - 100 = 4700
    assert rec_body["total_payable"] == 4700.0
    assert rec_body["formula_snapshot"]  # 保存了阶梯快照

    # 标记发放
    pay = client.put(
        f"/api/salary/records/{rid}/pay",
        json={"payment_method": "bank", "voucher": "VOUCHER-001"},
        headers=auth_headers(finance_token),
    )
    assert pay.status_code == 200
    paid = pay.json()
    assert paid["status"] == "paid"
    assert paid["payment_method"] == "bank"
    assert paid["paid_at"] is not None

    # 已发放不可删除
    rm = client.delete(f"/api/salary/records/{rid}", headers=auth_headers(finance_token))
    assert rm.status_code == 400


def test_salary_record_delete_draft(client, admin_token, finance_token):
    a = create_anchor(client, admin_token)
    rec = client.post(
        "/api/salary/records",
        json={
            "anchor_id": a["id"],
            "period_type": "month",
            "period_start": "2025-05-01",
            "period_end": "2025-05-31",
        },
        headers=auth_headers(finance_token),
    ).json()
    rm = client.delete(f"/api/salary/records/{rec['id']}", headers=auth_headers(finance_token))
    assert rm.status_code == 204


def test_operator_cannot_create_record(client, admin_token, operator_token):
    a = create_anchor(client, admin_token)
    res = client.post(
        "/api/salary/records",
        json={
            "anchor_id": a["id"],
            "period_type": "month",
            "period_start": "2025-06-01",
            "period_end": "2025-06-30",
        },
        headers=auth_headers(operator_token),
    )
    assert res.status_code == 403


def test_list_records_filter_by_month(client, admin_token, finance_token):
    a = create_anchor(client, admin_token)
    client.post(
        "/api/salary/records",
        json={"anchor_id": a["id"], "period_type": "month",
              "period_start": "2025-07-01", "period_end": "2025-07-31"},
        headers=auth_headers(finance_token),
    )
    client.post(
        "/api/salary/records",
        json={"anchor_id": a["id"], "period_type": "month",
              "period_start": "2025-08-01", "period_end": "2025-08-31"},
        headers=auth_headers(finance_token),
    )

    res = client.get(
        "/api/salary/records",
        params={"month": "2025-07"},
        headers=auth_headers(admin_token),
    )
    assert res.status_code == 200
    items = res.json()["items"]
    assert len(items) == 1
    assert items[0]["period_start"].startswith("2025-07")
