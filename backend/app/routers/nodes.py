import os
import uuid
import aiofiles
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional

from ..database import get_db
from ..models import Node, FileRecord, Anchor, OperationLog, OperationType, UserRole
from ..schemas import NodeCreate, NodeUpdate, NodeResponse, NodeListResponse, FileUploadResponse
from ..utils.auth_deps import require_role
from ..config import FILES_DIR, MAX_FILE_SIZE, ALLOWED_EXTENSIONS, FILE_CATEGORIES

BUSINESS_WRITE = [Depends(require_role(UserRole.ADMIN, UserRole.OPERATOR))]

router = APIRouter(prefix="/api", tags=["nodes"])


def get_category_folder(category: str) -> str:
    folder_map = {
        "contracts": "contracts",
        "training": "training",
        "photos": "photos",
        "documents": "documents"
    }
    return folder_map.get(category, "documents")


def log_operation(db: Session, action: OperationType, target_type: str, target_id: str = None, target_name: str = None, details: str = None):
    from ..utils.request_context import get_current_ip, get_audit_operator, get_audit_user_id
    log = OperationLog(
        operator=get_audit_operator(),
        user_id=get_audit_user_id(),
        action=action,
        target_type=target_type,
        target_id=target_id,
        target_name=target_name,
        details=details,
        ip_address=get_current_ip(),
    )
    db.add(log)


@router.get("/anchors/{anchor_id}/nodes", response_model=NodeListResponse)
def get_anchor_nodes(
    anchor_id: str,
    node_type: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(Node).filter(Node.anchor_id == anchor_id)

    if node_type:
        query = query.filter(Node.type == node_type)

    total = query.count()
    items = query.order_by(Node.date.desc()).offset(skip).limit(limit).all()

    return NodeListResponse(items=items, total=total)


@router.get("/nodes/{node_id}", response_model=NodeResponse)
def get_node(node_id: str, db: Session = Depends(get_db)):
    node = db.query(Node).filter(Node.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="节点不存在")
    return node


@router.post("/anchors/{anchor_id}/nodes", response_model=NodeResponse, status_code=201, dependencies=BUSINESS_WRITE)
def create_node(anchor_id: str, node_data: NodeCreate, db: Session = Depends(get_db)):
    anchor = db.query(Anchor).filter(Anchor.id == anchor_id).first()
    if not anchor:
        raise HTTPException(status_code=404, detail="主播不存在")

    node = Node(anchor_id=anchor_id, **node_data.model_dump())
    db.add(node)
    db.flush()

    # 记录操作日志
    log_operation(
        db, OperationType.CREATE, "node",
        target_id=node.id,
        target_name=node.title,
        details=f"为主播 {anchor.name} 创建节点: {node.title}"
    )

    db.commit()
    db.refresh(node)
    return node


@router.put("/nodes/{node_id}", response_model=NodeResponse, dependencies=BUSINESS_WRITE)
def update_node(node_id: str, node_data: NodeUpdate, db: Session = Depends(get_db)):
    node = db.query(Node).filter(Node.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="节点不存在")

    update_data = node_data.model_dump(exclude_unset=True)

    # 记录变更详情
    changes = []
    for key, value in update_data.items():
        old_value = getattr(node, key)
        if old_value != value:
            changes.append(f"{key}: {old_value} -> {value}")
        setattr(node, key, value)

    # 记录操作日志
    if changes:
        log_operation(
            db, OperationType.UPDATE, "node",
            target_id=node.id,
            target_name=node.title,
            details=f"更新节点: {', '.join(changes)}"
        )

    db.commit()
    db.refresh(node)
    return node


@router.delete("/nodes/{node_id}", status_code=204, dependencies=BUSINESS_WRITE)
def delete_node(node_id: str, db: Session = Depends(get_db)):
    node = db.query(Node).filter(Node.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="节点不存在")

    node_title = node.title

    # 记录操作日志（在删除前）
    log_operation(
        db, OperationType.DELETE, "node",
        target_id=node.id,
        target_name=node_title,
        details=f"删除节点: {node_title}"
    )

    # Delete associated files from filesystem
    files = db.query(FileRecord).filter(FileRecord.node_id == node_id).all()
    for file_record in files:
        if os.path.exists(file_record.file_path):
            os.remove(file_record.file_path)

    db.delete(node)
    db.commit()
    return None


@router.post("/nodes/{node_id}/files", response_model=FileUploadResponse, dependencies=BUSINESS_WRITE)
async def upload_file(
    node_id: str,
    category: str = Form(...),
    file: UploadFile = File(...)
):
    # Validate node exists
    from ..database import SessionLocal
    db = SessionLocal()
    try:
        node = db.query(Node).filter(Node.id == node_id).first()
        if not node:
            raise HTTPException(status_code=404, detail="节点不存在")

        # Validate file extension
        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(status_code=400, detail=f"不支持的文件类型: {ext}")

        # Check file size
        contents = await file.read()
        if len(contents) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail="文件大小超过限制")

        # Generate unique filename
        unique_filename = f"{uuid.uuid4()}{ext}"
        category_folder = get_category_folder(category)
        anchor_folder = os.path.join(FILES_DIR, category_folder, node.anchor_id)
        os.makedirs(anchor_folder, exist_ok=True)

        file_path = os.path.join(anchor_folder, unique_filename)

        # Save file
        async with aiofiles.open(file_path, 'wb') as f:
            await f.write(contents)

        # Create file record
        file_record = FileRecord(
            node_id=node_id,
            filename=unique_filename,
            original_name=file.filename,
            file_path=file_path,
            file_type=ext,
            file_size=len(contents),
            category=category
        )
        db.add(file_record)
        db.flush()

        # 记录操作日志
        log_operation(
            db, OperationType.CREATE, "file",
            target_id=file_record.id,
            target_name=file.filename,
            details=f"上传文件: {file.filename} 到节点 {node.title}"
        )

        db.commit()
        db.refresh(file_record)

        return file_record
    finally:
        db.close()


@router.get("/files/{file_id}")
def download_file(file_id: str, db: Session = Depends(get_db)):
    file_record = db.query(FileRecord).filter(FileRecord.id == file_id).first()
    if not file_record:
        raise HTTPException(status_code=404, detail="文件不存在")

    if not os.path.exists(file_record.file_path):
        raise HTTPException(status_code=404, detail="文件已丢失")

    return FileResponse(
        path=file_record.file_path,
        filename=file_record.original_name,
        media_type="application/octet-stream"
    )


@router.delete("/files/{file_id}", status_code=204, dependencies=BUSINESS_WRITE)
def delete_file(file_id: str, db: Session = Depends(get_db)):
    file_record = db.query(FileRecord).filter(FileRecord.id == file_id).first()
    if not file_record:
        raise HTTPException(status_code=404, detail="文件不存在")

    file_name = file_record.original_name

    # 记录操作日志
    log_operation(
        db, OperationType.DELETE, "file",
        target_id=file_record.id,
        target_name=file_name,
        details=f"删除文件: {file_name}"
    )

    if os.path.exists(file_record.file_path):
        os.remove(file_record.file_path)

    db.delete(file_record)
    db.commit()
    return None