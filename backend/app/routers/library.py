import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from ..models import Anchor, FileRecord, Node, OperationType, UserRole
from ..schemas import LibraryTreeNode
from ..utils.auth_deps import require_role
from ..config import FILES_DIR, FILE_CATEGORIES

router = APIRouter(prefix="/api/library", tags=["library"])

BUSINESS_WRITE = [Depends(require_role(UserRole.ADMIN, UserRole.OPERATOR))]


CATEGORY_KEYS = set(FILE_CATEGORIES.keys())


def _log(db: Session, action: OperationType, target_type: str, target_id: str = None,
         target_name: str = None, details: str = None):
    from ..models import OperationLog
    from ..utils.request_context import get_current_ip, get_audit_operator, get_audit_user_id
    db.add(OperationLog(
        operator=get_audit_operator(),
        user_id=get_audit_user_id(),
        action=action,
        target_type=target_type,
        target_id=target_id,
        target_name=target_name,
        details=details,
        ip_address=get_current_ip(),
    ))


def _resolve_library_path(rel_path: str) -> str:
    """
    将以 `/contracts/<anchor_id>[/<filename>]` 形式的 path 解析为磁盘绝对路径。
    校验：
      1. 必须以已知分类开头；
      2. 解析后必须落在 FILES_DIR 内（防止路径穿越）。
    """
    if not rel_path or not rel_path.startswith("/"):
        raise HTTPException(status_code=400, detail="无效路径")
    parts = [p for p in rel_path.split("/") if p]
    if not parts:
        raise HTTPException(status_code=400, detail="无效路径")
    category = parts[0]
    if category not in CATEGORY_KEYS:
        raise HTTPException(status_code=400, detail="无效分类")
    if any(p in ("", ".", "..") for p in parts):
        raise HTTPException(status_code=400, detail="无效路径")

    abs_files_dir = os.path.abspath(FILES_DIR)
    abs_path = os.path.abspath(os.path.join(abs_files_dir, *parts))
    try:
        common = os.path.commonpath([abs_files_dir, abs_path])
    except ValueError:
        raise HTTPException(status_code=400, detail="无效路径")
    if common != abs_files_dir or abs_path == abs_files_dir:
        raise HTTPException(status_code=400, detail="无效路径")
    return abs_path


def _delete_filerecords_under(db: Session, abs_path: str) -> int:
    """
    清理 DB 中 file_path 位于 abs_path 之下（含自身）的 FileRecord。
    返回删除条数。返回前不 commit，由调用方统一 commit。
    """
    norm_target = os.path.normcase(os.path.abspath(abs_path))
    records = db.query(FileRecord).all()
    n = 0
    for rec in records:
        rec_path = os.path.normcase(os.path.abspath(rec.file_path or ""))
        if rec_path == norm_target or rec_path.startswith(norm_target + os.sep):
            db.delete(rec)
            n += 1
    return n


@router.get("/tree", response_model=List[LibraryTreeNode])
def get_library_tree(db: Session = Depends(get_db)):
    """获取材料库目录树。无对应主播的子目录标记为 orphan。"""
    tree: List[LibraryTreeNode] = []

    for category_key, category_name in FILE_CATEGORIES.items():
        category_node = LibraryTreeNode(
            name=category_name,
            path=f"/{category_key}",
            type="folder",
            children=[]
        )

        category_path = os.path.join(FILES_DIR, category_key)
        if os.path.isdir(category_path):
            for anchor_id in sorted(os.listdir(category_path)):
                anchor_path = os.path.join(category_path, anchor_id)
                if not os.path.isdir(anchor_path):
                    continue

                anchor = db.query(Anchor).filter(Anchor.id == anchor_id).first()
                is_orphan = anchor is None
                anchor_label = anchor.stage_name if anchor else f"[已删除] {anchor_id[:8]}"

                anchor_files: List[LibraryTreeNode] = []
                for fname in sorted(os.listdir(anchor_path)):
                    fpath = os.path.join(anchor_path, fname)
                    if not os.path.isfile(fpath):
                        continue
                    file_record = db.query(FileRecord).filter(
                        FileRecord.file_path == fpath
                    ).first()
                    anchor_files.append(LibraryTreeNode(
                        name=fname,
                        path=f"/{category_key}/{anchor_id}/{fname}",
                        type="file",
                        children=[],
                        file_id=file_record.id if file_record else None,
                        orphan=is_orphan or None,
                    ))

                category_node.children.append(LibraryTreeNode(
                    name=anchor_label,
                    path=f"/{category_key}/{anchor_id}",
                    type="folder",
                    children=anchor_files,
                    orphan=is_orphan or None,
                ))

        tree.append(category_node)

    return tree


@router.get("/files")
def get_library_files(
    category: str = None,
    anchor_id: str = None,
    db: Session = Depends(get_db)
):
    """获取指定目录下的文件列表"""
    query = db.query(FileRecord)

    if category:
        query = query.filter(FileRecord.category == category)

    if anchor_id:
        node_ids = [n.id for n in db.query(Node).filter(Node.anchor_id == anchor_id).all()]
        query = query.filter(FileRecord.node_id.in_(node_ids))

    files = query.all()
    return [
        {
            "id": f.id,
            "filename": f.filename,
            "original_name": f.original_name,
            "file_type": f.file_type,
            "file_size": f.file_size,
            "category": f.category,
            "uploaded_at": f.uploaded_at
        }
        for f in files
    ]


@router.get("/preview/{file_id}")
def preview_file(file_id: str, db: Session = Depends(get_db)):
    """预览文件"""
    file_record = db.query(FileRecord).filter(FileRecord.id == file_id).first()
    if not file_record:
        raise HTTPException(status_code=404, detail="文件不存在")

    if not os.path.exists(file_record.file_path):
        raise HTTPException(status_code=404, detail="文件已丢失")

    ext = file_record.file_type.lower() if file_record.file_type else ""
    if ext in [".jpg", ".jpeg", ".png"]:
        media_type = f"image/{ext[1:]}"
    elif ext == ".pdf":
        media_type = "application/pdf"
    else:
        media_type = "application/octet-stream"

    return FileResponse(
        path=file_record.file_path,
        media_type=media_type
    )


@router.delete("/file", status_code=204, dependencies=BUSINESS_WRITE)
def delete_library_file(
    path: str = Query(..., description="形如 /contracts/<anchor_id>/<filename>"),
    db: Session = Depends(get_db),
):
    """删除材料库中的单个文件（含磁盘文件与 DB FileRecord 记录）。"""
    abs_path = _resolve_library_path(path)
    if not os.path.exists(abs_path):
        raise HTTPException(status_code=404, detail="文件不存在")
    if not os.path.isfile(abs_path):
        raise HTTPException(status_code=400, detail="路径不是文件")

    fname = os.path.basename(abs_path)
    removed = _delete_filerecords_under(db, abs_path)
    try:
        os.remove(abs_path)
    except OSError as e:
        raise HTTPException(status_code=500, detail=f"删除文件失败: {e}")

    _log(db, OperationType.DELETE, "library_file",
         target_name=fname,
         details=f"删除材料库文件: {path}（同步清理 {removed} 条记录）")
    db.commit()
    return None


@router.delete("/folder", status_code=204, dependencies=BUSINESS_WRITE)
def delete_library_folder(
    path: str = Query(..., description="形如 /contracts/<anchor_id>"),
    db: Session = Depends(get_db),
):
    """删除材料库中的目录（连同其下全部文件与 DB 记录）。不允许删除分类根目录。"""
    abs_path = _resolve_library_path(path)
    parts = [p for p in path.split("/") if p]
    if len(parts) < 2:
        raise HTTPException(status_code=400, detail="不允许删除分类根目录")
    if not os.path.exists(abs_path):
        raise HTTPException(status_code=404, detail="目录不存在")
    if not os.path.isdir(abs_path):
        raise HTTPException(status_code=400, detail="路径不是目录")

    removed = _delete_filerecords_under(db, abs_path)
    try:
        shutil.rmtree(abs_path)
    except OSError as e:
        raise HTTPException(status_code=500, detail=f"删除目录失败: {e}")

    _log(db, OperationType.DELETE, "library_folder",
         target_name=os.path.basename(abs_path),
         details=f"删除材料库目录: {path}（同步清理 {removed} 条记录）")
    db.commit()
    return None


@router.post("/cleanup-orphans", dependencies=BUSINESS_WRITE)
def cleanup_orphan_folders(db: Session = Depends(get_db)):
    """
    清理孤儿目录：扫描 4 类目录下没有对应主播的子目录，整目录删除。
    返回清理结果统计。
    """
    abs_files_dir = os.path.abspath(FILES_DIR)
    removed_folders: List[str] = []
    removed_records_total = 0

    for category_key in FILE_CATEGORIES.keys():
        category_path = os.path.join(abs_files_dir, category_key)
        if not os.path.isdir(category_path):
            continue
        for anchor_id in list(os.listdir(category_path)):
            anchor_path = os.path.join(category_path, anchor_id)
            if not os.path.isdir(anchor_path):
                continue
            anchor = db.query(Anchor).filter(Anchor.id == anchor_id).first()
            if anchor is not None:
                continue
            removed_records_total += _delete_filerecords_under(db, anchor_path)
            try:
                shutil.rmtree(anchor_path)
                removed_folders.append(f"/{category_key}/{anchor_id}")
            except OSError:
                # 继续清理其他目录，不让一个失败影响整体
                continue

    if removed_folders:
        _log(db, OperationType.DELETE, "library_orphans",
             target_name=f"{len(removed_folders)} 个目录",
             details=f"一键清理孤儿目录: {', '.join(removed_folders)}（同步清理 {removed_records_total} 条记录）")
    db.commit()

    return {
        "removed_folders": removed_folders,
        "removed_records": removed_records_total,
    }
