import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FILES_DIR = os.environ.get("ZHUBO_FILES_DIR") or os.path.join(BASE_DIR, "files")

DATABASE_URL = os.environ.get("ZHUBO_DATABASE_URL") or "sqlite:///./zhubo_sys.db"

FILE_CATEGORIES = {
    "contracts": "合同文件",
    "training": "培训记录",
    "photos": "照片",
    "documents": "其他文档"
}

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".doc", ".docx", ".xls", ".xlsx"]
