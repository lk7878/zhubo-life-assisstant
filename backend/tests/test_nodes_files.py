"""时间轴节点 CRUD + 文件上传/下载/删除 + 删除主播级联删文件目录"""
import io
import os
import pathlib
from tests.conftest import auth_headers, create_anchor, _TEST_FILES  # type: ignore


def _create_node(client, token, anchor_id, **overrides) -> dict:
    payload = {
        "type": overrides.pop("type", "milestone"),
        "date": overrides.pop("date", "2025-01-01T10:00:00"),
        "title": overrides.pop("title", "节点标题"),
        "content": overrides.pop("content", "节点内容"),
        "location": overrides.pop("location", None),
    }
    payload.update(overrides)
    res = client.post(
        f"/api/anchors/{anchor_id}/nodes",
        json=payload,
        headers=auth_headers(token),
    )
    assert res.status_code == 201, res.text
    return res.json()


def test_create_node(client, admin_token):
    anchor = create_anchor(client, admin_token)
    node = _create_node(client, admin_token, anchor["id"], title="初次面试", type="interview")
    assert node["title"] == "初次面试"
    assert node["type"] == "interview"
    assert node["anchor_id"] == anchor["id"]


def test_list_nodes_filter(client, admin_token):
    anchor = create_anchor(client, admin_token)
    _create_node(client, admin_token, anchor["id"], title="N1", type="milestone")
    _create_node(client, admin_token, anchor["id"], title="N2", type="training")
    res = client.get(
        f"/api/anchors/{anchor['id']}/nodes",
        params={"node_type": "training"},
        headers=auth_headers(admin_token),
    )
    body = res.json()
    assert body["total"] == 1
    assert body["items"][0]["title"] == "N2"


def test_get_node(client, admin_token):
    anchor = create_anchor(client, admin_token)
    node = _create_node(client, admin_token, anchor["id"])
    res = client.get(f"/api/nodes/{node['id']}", headers=auth_headers(admin_token))
    assert res.status_code == 200
    assert res.json()["id"] == node["id"]


def test_update_node(client, admin_token):
    anchor = create_anchor(client, admin_token)
    node = _create_node(client, admin_token, anchor["id"])
    res = client.put(
        f"/api/nodes/{node['id']}",
        json={"title": "新标题"},
        headers=auth_headers(admin_token),
    )
    assert res.status_code == 200
    assert res.json()["title"] == "新标题"


def test_delete_node(client, admin_token):
    anchor = create_anchor(client, admin_token)
    node = _create_node(client, admin_token, anchor["id"])
    res = client.delete(f"/api/nodes/{node['id']}", headers=auth_headers(admin_token))
    assert res.status_code == 204
    # 二次删 404
    res2 = client.delete(f"/api/nodes/{node['id']}", headers=auth_headers(admin_token))
    assert res2.status_code == 404


def test_anchor_create_to_timeline_links(client, admin_token):
    anchor = create_anchor(client, admin_token)
    _create_node(client, admin_token, anchor["id"], title="X", type="entry")
    res = client.get(f"/api/anchors/{anchor['id']}/timeline", headers=auth_headers(admin_token))
    assert res.status_code == 200
    items = res.json()
    assert len(items) == 1
    assert items[0]["title"] == "X"


# ---------- 文件上传 / 下载 / 删除 ----------
def _upload(client, token, node_id, *, filename="a.pdf", content=b"hello", category="documents"):
    files = {"file": (filename, io.BytesIO(content), "application/octet-stream")}
    data = {"category": category}
    res = client.post(
        f"/api/nodes/{node_id}/files",
        files=files, data=data,
        headers=auth_headers(token),
    )
    return res


def test_upload_file_success(client, admin_token):
    anchor = create_anchor(client, admin_token)
    node = _create_node(client, admin_token, anchor["id"])
    res = _upload(client, admin_token, node["id"], filename="report.pdf", content=b"PDF-CONTENT")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["original_name"] == "report.pdf"
    assert body["file_size"] == len(b"PDF-CONTENT")
    # 物理文件存在
    assert os.path.exists(body["file_path"])
    # 落到了 _TEST_FILES 下
    assert str(_TEST_FILES) in body["file_path"]


def test_upload_reject_bad_ext(client, admin_token):
    anchor = create_anchor(client, admin_token)
    node = _create_node(client, admin_token, anchor["id"])
    res = _upload(client, admin_token, node["id"], filename="malware.exe")
    assert res.status_code == 400


def test_upload_to_unknown_node(client, admin_token):
    res = _upload(client, admin_token, "no-such-node", filename="a.pdf")
    assert res.status_code == 404


def test_download_and_delete_file(client, admin_token):
    anchor = create_anchor(client, admin_token)
    node = _create_node(client, admin_token, anchor["id"])
    up = _upload(client, admin_token, node["id"], filename="hello.pdf", content=b"HELLO")
    fid = up.json()["id"]

    # 下载
    dl = client.get(f"/api/files/{fid}", headers=auth_headers(admin_token))
    assert dl.status_code == 200
    assert dl.content == b"HELLO"

    # 删除
    rm = client.delete(f"/api/files/{fid}", headers=auth_headers(admin_token))
    assert rm.status_code == 204
    # 404 之后再删
    rm2 = client.delete(f"/api/files/{fid}", headers=auth_headers(admin_token))
    assert rm2.status_code == 404
    # 物理文件已消失
    file_path = up.json()["file_path"]
    assert not os.path.exists(file_path)


def test_delete_node_removes_files(client, admin_token):
    anchor = create_anchor(client, admin_token)
    node = _create_node(client, admin_token, anchor["id"])
    up = _upload(client, admin_token, node["id"], filename="bye.pdf", content=b"X")
    fpath = up.json()["file_path"]
    assert os.path.exists(fpath)

    res = client.delete(f"/api/nodes/{node['id']}", headers=auth_headers(admin_token))
    assert res.status_code == 204
    assert not os.path.exists(fpath)


def test_delete_anchor_removes_material_dirs(client, admin_token):
    """删除主播应同步清空 4 类目录下该主播的目录。"""
    anchor = create_anchor(client, admin_token)
    node = _create_node(client, admin_token, anchor["id"])
    up = _upload(client, admin_token, node["id"], filename="x.pdf", content=b"X", category="documents")
    anchor_dir = pathlib.Path(_TEST_FILES) / "documents" / anchor["id"]
    assert anchor_dir.exists()

    res = client.delete(f"/api/anchors/{anchor['id']}", headers=auth_headers(admin_token))
    assert res.status_code == 204
    assert not anchor_dir.exists()
