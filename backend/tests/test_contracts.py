"""合同 CRUD + 自动入职节点联动 + 续签 + 终止 admin only + 即将到期"""
from datetime import date, timedelta
from tests.conftest import auth_headers, create_anchor


def _new(client, token, anchor_id, **overrides) -> dict:
    today = date.today()
    payload = {
        "anchor_id": anchor_id,
        "contract_type": overrides.pop("contract_type", "formal"),
        "party_a": overrides.pop("party_a", "公司"),
        "start_date": overrides.pop("start_date", today.isoformat()),
        "end_date": overrides.pop("end_date", (today + timedelta(days=365)).isoformat()),
        "contract_no": overrides.pop("contract_no", "C001"),
    }
    payload.update(overrides)
    res = client.post("/api/contracts", json=payload, headers=auth_headers(token))
    assert res.status_code == 201, res.text
    return res.json()


def test_create_formal_contract_auto_creates_entry_node(client, admin_token):
    a = create_anchor(client, admin_token)
    c = _new(client, admin_token, a["id"], contract_type="formal")
    assert c["contract_type"] == "formal"

    # 时间线应有一条 entry
    tl = client.get(f"/api/anchors/{a['id']}/timeline", headers=auth_headers(admin_token)).json()
    entries = [n for n in tl if n["type"] == "entry"]
    assert len(entries) == 1


def test_probation_contract_also_creates_entry(client, admin_token):
    a = create_anchor(client, admin_token)
    _new(client, admin_token, a["id"], contract_type="probation")
    tl = client.get(f"/api/anchors/{a['id']}/timeline", headers=auth_headers(admin_token)).json()
    assert any(n["type"] == "entry" for n in tl)


def test_renewal_contract_does_not_re_create_entry(client, admin_token):
    """续签合同不应再生成 entry，只产生 milestone。"""
    a = create_anchor(client, admin_token)
    _new(client, admin_token, a["id"], contract_type="formal", contract_no="C-A")
    _new(client, admin_token, a["id"], contract_type="renewal", contract_no="C-B")
    tl = client.get(f"/api/anchors/{a['id']}/timeline", headers=auth_headers(admin_token)).json()
    entries = [n for n in tl if n["type"] == "entry"]
    assert len(entries) == 1


def test_list_and_search_contract(client, admin_token):
    a = create_anchor(client, admin_token, name="张某")
    _new(client, admin_token, a["id"], contract_no="ABC-001", party_b="张某")
    _new(client, admin_token, a["id"], contract_no="XYZ-999", party_b="李某")
    res = client.get(
        "/api/contracts",
        params={"search": "ABC"},
        headers=auth_headers(admin_token),
    )
    assert res.status_code == 200
    items = res.json()["items"]
    assert len(items) == 1
    assert items[0]["contract_no"] == "ABC-001"


def test_update_contract(client, admin_token):
    a = create_anchor(client, admin_token)
    c = _new(client, admin_token, a["id"], remark="原备注")
    res = client.put(
        f"/api/contracts/{c['id']}",
        json={"remark": "新备注"},
        headers=auth_headers(admin_token),
    )
    assert res.status_code == 200
    assert res.json()["remark"] == "新备注"


def test_terminate_admin_only(client, admin_token, operator_token):
    a = create_anchor(client, admin_token)
    c = _new(client, admin_token, a["id"])

    bad = client.put(
        f"/api/contracts/{c['id']}/terminate",
        json={"terminated_at": date.today().isoformat(), "termination_reason": "test"},
        headers=auth_headers(operator_token),
    )
    assert bad.status_code == 403

    ok = client.put(
        f"/api/contracts/{c['id']}/terminate",
        json={"terminated_at": date.today().isoformat(), "termination_reason": "故意终止"},
        headers=auth_headers(admin_token),
    )
    assert ok.status_code == 200
    assert ok.json()["status"] == "terminated"

    # 已终止不能再终止
    again = client.put(
        f"/api/contracts/{c['id']}/terminate",
        json={"terminated_at": date.today().isoformat()},
        headers=auth_headers(admin_token),
    )
    assert again.status_code == 400


def test_renew_creates_new_contract_and_milestone(client, admin_token):
    a = create_anchor(client, admin_token)
    c = _new(client, admin_token, a["id"], contract_type="formal", contract_no="C-OLD")
    today = date.today()
    new_start = (today + timedelta(days=10)).isoformat()
    new_end = (today + timedelta(days=400)).isoformat()
    res = client.post(
        f"/api/contracts/{c['id']}/renew",
        json={
            "new_start_date": new_start,
            "new_end_date": new_end,
            "contract_type": "renewal",
        },
        headers=auth_headers(admin_token),
    )
    assert res.status_code == 201, res.text
    new_c = res.json()
    assert new_c["previous_contract_id"] == c["id"]
    assert new_c["start_date"] == new_start

    # 时间线应当出现一条续签 milestone
    tl = client.get(f"/api/anchors/{a['id']}/timeline", headers=auth_headers(admin_token)).json()
    milestones = [n for n in tl if n["type"] == "milestone"]
    assert len(milestones) >= 1


def test_expiring_within_30_days(client, admin_token):
    a = create_anchor(client, admin_token)
    today = date.today()
    # 一个 15 天后到期 → 应该出现在 expiring（refresh_status 会自动判定为 EXPIRING_SOON）
    near = _new(
        client, admin_token, a["id"], contract_no="NEAR",
        start_date=(today - timedelta(days=300)).isoformat(),
        end_date=(today + timedelta(days=15)).isoformat(),
        status="active",
    )
    # 一个 200 天后到期 → 不应出现
    _new(
        client, admin_token, a["id"], contract_no="FAR",
        start_date=today.isoformat(),
        end_date=(today + timedelta(days=200)).isoformat(),
        status="active",
    )
    res = client.get(
        "/api/contracts/expiring",
        params={"days": 30},
        headers=auth_headers(admin_token),
    )
    assert res.status_code == 200
    nos = [c["contract_no"] for c in res.json()["items"]]
    assert "NEAR" in nos
    assert "FAR" not in nos


def test_delete_breaks_previous_link(client, admin_token):
    """删除被续签的旧合同时，新合同 previous_contract_id 应自动清空，不报外键错。"""
    a = create_anchor(client, admin_token)
    old = _new(client, admin_token, a["id"], contract_no="OLD")
    today = date.today()
    new_c = client.post(
        f"/api/contracts/{old['id']}/renew",
        json={
            "new_start_date": today.isoformat(),
            "new_end_date": (today + timedelta(days=365)).isoformat(),
            "contract_type": "renewal",
        },
        headers=auth_headers(admin_token),
    ).json()

    # 删除旧合同
    rm = client.delete(f"/api/contracts/{old['id']}", headers=auth_headers(admin_token))
    assert rm.status_code == 204

    after = client.get(f"/api/contracts/{new_c['id']}", headers=auth_headers(admin_token)).json()
    assert after["previous_contract_id"] is None


def test_finance_cannot_create_contract(client, admin_token, finance_token):
    a = create_anchor(client, admin_token)
    res = client.post(
        "/api/contracts",
        json={
            "anchor_id": a["id"],
            "contract_type": "formal",
            "party_a": "公司",
            "start_date": "2026-01-01",
            "end_date": "2027-01-01",
        },
        headers=auth_headers(finance_token),
    )
    assert res.status_code == 403
