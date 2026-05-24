"""材料库目录树、孤儿清理、路径穿越防护"""
import io
import os
import pathlib
from tests.conftest import auth_headers, create_anchor, _TEST_FILES  # type: ignore


def _create_node_and_upload(client, token, anchor_id, *, category="documents", content=b"x"):
    node = client.post(
        f"/api/anchors/{anchor_id}/nodes",
        json={"type": "milestone", "date": "2025-01-01T10:00:00", "title": "n"},
        headers=auth_headers(token),
    ).json()
    res = client.post(
        f"/api/nodes/{node['id']}/files",
        files={"file": ("a.pdf", io.BytesIO(content), "application/pdf")},
        data={"category": category},
        headers=auth_headers(token),
    )
    assert res.status_code == 200, res.text
    return res.json()


def test_tree_empty_returns_4_categories(client, admin_token):
    res = client.get("/api/library/tree", headers=auth_headers(admin_token))
    assert res.status_code == 200
    names = [n["name"] for n in res.json()]
    assert {"合同文件", "培训记录", "照片", "其他文档"}.issubset(names)


def test_tree_lists_files(client, admin_token):
    anchor = create_anchor(client, admin_token)
    f = _create_node_and_upload(client, admin_token, anchor["id"], category="documents", content=b"abc")
    res = client.get("/api/library/tree", headers=auth_headers(admin_token))
    tree = res.json()
    doc_node = next(n for n in tree if n["path"] == "/documents")
    assert len(doc_node["children"]) == 1
    anchor_node = doc_node["children"][0]
    assert anchor_node["path"].startswith(f"/documents/{anchor['id']}")
    assert anchor_node["orphan"] is None
    file_node = anchor_node["children"][0]
    assert file_node["type"] == "file"
    assert file_node["file_id"] == f["id"]


def test_files_filter(client, admin_token):
    anchor = create_anchor(client, admin_token)
    _create_node_and_upload(client, admin_token, anchor["id"], category="documents", content=b"a")
    _create_node_and_upload(client, admin_token, anchor["id"], category="photos", content=b"b")
    res = client.get(
        "/api/library/files",
        params={"category": "photos"},
        headers=auth_headers(admin_token),
    )
    assert res.status_code == 200
    items = res.json()
    assert len(items) == 1
    assert items[0]["category"] == "photos"


def test_preview_image_mime(client, admin_token):
    anchor = create_anchor(client, admin_token)
    # 模拟 jpg
    node = client.post(
        f"/api/anchors/{anchor['id']}/nodes",
        json={"type": "milestone", "date": "2025-01-01T10:00:00", "title": "n"},
        headers=auth_headers(admin_token),
    ).json()
    res = client.post(
        f"/api/nodes/{node['id']}/files",
        files={"file": ("hi.jpg", io.BytesIO(b"\xff\xd8\xff"), "image/jpeg")},
        data={"category": "photos"},
        headers=auth_headers(admin_token),
    )
    fid = res.json()["id"]
    pv = client.get(f"/api/library/preview/{fid}", headers=auth_headers(admin_token))
    assert pv.status_code == 200
    assert pv.headers.get("content-type", "").startswith("image/")


def test_delete_library_file(client, admin_token):
    anchor = create_anchor(client, admin_token)
    f = _create_node_and_upload(client, admin_token, anchor["id"], category="documents", content=b"x")
    file_path = pathlib.Path(f["file_path"])
    assert file_path.exists()
    rel = "/" + str(file_path.relative_to(_TEST_FILES)).replace(os.sep, "/")
    res = client.delete(
        "/api/library/file",
        params={"path": rel},
        headers=auth_headers(admin_token),
    )
    assert res.status_code == 204
    assert not file_path.exists()


def test_delete_library_folder(client, admin_token):
    anchor = create_anchor(client, admin_token)
    _create_node_and_upload(client, admin_token, anchor["id"], category="documents", content=b"x")
    anchor_dir = pathlib.Path(_TEST_FILES) / "documents" / anchor["id"]
    assert anchor_dir.exists()
    rel = f"/documents/{anchor['id']}"
    res = client.delete(
        "/api/library/folder",
        params={"path": rel},
        headers=auth_headers(admin_token),
    )
    assert res.status_code == 204
    assert not anchor_dir.exists()


def test_delete_category_root_forbidden(client, admin_token):
    res = client.delete(
        "/api/library/folder",
        params={"path": "/documents"},
        headers=auth_headers(admin_token),
    )
    assert res.status_code == 400


def test_path_traversal_blocked(client, admin_token):
    """带 ../ 的路径应当被拒绝"""
    for bad in ["/documents/../../etc", "/../secret", "/unknown_category/aaa"]:
        res = client.delete(
            "/api/library/folder",
            params={"path": bad},
            headers=auth_headers(admin_token),
        )
        assert res.status_code == 400, f"path {bad} should be 400, got {res.status_code}"


def test_orphan_cleanup(client, admin_token):
    """删除主播后，目录变 orphan，cleanup 后被清理"""
    anchor = create_anchor(client, admin_token)
    _create_node_and_upload(client, admin_token, anchor["id"], category="documents", content=b"x")
    anchor_dir = pathlib.Path(_TEST_FILES) / "documents" / anchor["id"]

    # 删主播：路由会同步清理材料库目录
    assert client.delete(f"/api/anchors/{anchor['id']}", headers=auth_headers(admin_token)).status_code == 204
    # 因为 delete_anchor 已经清理，此时目录其实已经不存在；为了能测 cleanup-orphans 接口，我们手动再造一个孤儿目录
    fake_orphan = pathlib.Path(_TEST_FILES) / "documents" / "fake-orphan-id"
    fake_orphan.mkdir(parents=True, exist_ok=True)
    (fake_orphan / "x.txt").write_text("hi")

    res = client.post("/api/library/cleanup-orphans", headers=auth_headers(admin_token))
    assert res.status_code == 200
    body = res.json()
    assert any("fake-orphan-id" in p for p in body["removed_folders"])
    assert not fake_orphan.exists()
