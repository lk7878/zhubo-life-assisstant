from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker
from .config import DATABASE_URL

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def ensure_anchor_profile_columns():
    columns = {
        "gender": "VARCHAR(20)",
        "age": "INTEGER",
        "wechat": "VARCHAR(100)",
        "city": "VARCHAR(100)",
        "commute_distance": "VARCHAR(100)",
        "marital_status": "VARCHAR(20)",
        "has_children": "VARCHAR(20)",
        "douyin_account": "VARCHAR(100)",
        "kuaishou_account": "VARCHAR(100)",
        "xiaohongshu_account": "VARCHAR(100)",
        "weibo_account": "VARCHAR(100)",
        "bilibili_account": "VARCHAR(100)",
        "video_account": "VARCHAR(100)",
        "followers_count": "INTEGER",
        "average_viewers": "FLOAT",
        "average_gmv": "FLOAT",
        "conversion_rate": "FLOAT",
        "fan_profile": "TEXT",
        "fan_growth": "INTEGER",
        "bank_name": "VARCHAR(100)",
        "bank_card_number": "VARCHAR(50)",
        "bank_account_name": "VARCHAR(100)",
        "emergency_contact_name": "VARCHAR(100)",
        "emergency_contact_relation": "VARCHAR(50)",
        "emergency_contact_phone": "VARCHAR(20)",
        "category_tags": "VARCHAR(255)",
        "style_tags": "VARCHAR(255)",
        "level_tags": "VARCHAR(255)",
        "grade": "VARCHAR(20)",
        "grade_note": "TEXT",
    }
    with engine.begin() as conn:
        existing = {row[1] for row in conn.execute(text("PRAGMA table_info(anchors)"))}
        for name, column_type in columns.items():
            if name not in existing:
                conn.execute(text(f"ALTER TABLE anchors ADD COLUMN {name} {column_type}"))


def ensure_live_record_columns():
    columns = {
        "live_end_time": "DATETIME",
    }
    with engine.begin() as conn:
        table_exists = conn.execute(
            text("SELECT name FROM sqlite_master WHERE type='table' AND name='live_records'")
        ).fetchone()
        if not table_exists:
            return
        existing = {row[1] for row in conn.execute(text("PRAGMA table_info(live_records)"))}
        for name, column_type in columns.items():
            if name not in existing:
                conn.execute(text(f"ALTER TABLE live_records ADD COLUMN {name} {column_type}"))


def ensure_training_columns():
    """培训计划表的字段迁移（仅当表已存在时补字段）"""
    columns = {
        # 这里预留：未来培训表加字段时只需在此声明
    }
    with engine.begin() as conn:
        table_exists = conn.execute(
            text("SELECT name FROM sqlite_master WHERE type='table' AND name='trainings'")
        ).fetchone()
        if not table_exists:
            return
        existing = {row[1] for row in conn.execute(text("PRAGMA table_info(trainings)"))}
        for name, column_type in columns.items():
            if name not in existing:
                conn.execute(text(f"ALTER TABLE trainings ADD COLUMN {name} {column_type}"))


def ensure_salary_columns():
    """薪资表字段迁移（暂未补字段，预留入口）"""
    config_columns = {}
    record_columns = {}
    with engine.begin() as conn:
        for table, columns in [("salary_configs", config_columns), ("salary_records", record_columns)]:
            exists = conn.execute(
                text(f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table}'")
            ).fetchone()
            if not exists:
                continue
            existing = {row[1] for row in conn.execute(text(f"PRAGMA table_info({table})"))}
            for name, ctype in columns.items():
                if name not in existing:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {ctype}"))


def ensure_asset_columns():
    """直播间 + 设备 + 借用记录字段迁移（预留入口）"""
    columns_map = {
        "live_rooms": {},
        "equipment": {},
        "equipment_loans": {},
    }
    with engine.begin() as conn:
        for table, columns in columns_map.items():
            exists = conn.execute(
                text(f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table}'")
            ).fetchone()
            if not exists:
                continue
            existing = {row[1] for row in conn.execute(text(f"PRAGMA table_info({table})"))}
            for name, ctype in columns.items():
                if name not in existing:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {ctype}"))


def ensure_contract_columns():
    """合同表字段迁移（预留入口）"""
    columns = {}
    with engine.begin() as conn:
        exists = conn.execute(
            text("SELECT name FROM sqlite_master WHERE type='table' AND name='contracts'")
        ).fetchone()
        if not exists:
            return
        existing = {row[1] for row in conn.execute(text("PRAGMA table_info(contracts)"))}
        for name, ctype in columns.items():
            if name not in existing:
                conn.execute(text(f"ALTER TABLE contracts ADD COLUMN {name} {ctype}"))


def drop_resignations_table():
    """离职流程模块已下线：启动时若仍存在历史 resignations 表则丢弃。"""
    with engine.begin() as conn:
        exists = conn.execute(
            text("SELECT name FROM sqlite_master WHERE type='table' AND name='resignations'")
        ).fetchone()
        if not exists:
            return
        conn.execute(text("DROP TABLE resignations"))


def ensure_operation_log_columns():
    columns = {
        "ip_address": "VARCHAR(64)",
        "user_id": "VARCHAR(36)",
    }
    with engine.begin() as conn:
        table_exists = conn.execute(
            text("SELECT name FROM sqlite_master WHERE type='table' AND name='operation_logs'")
        ).fetchone()
        if not table_exists:
            return
        existing = {row[1] for row in conn.execute(text("PRAGMA table_info(operation_logs)"))}
        for name, column_type in columns.items():
            if name not in existing:
                conn.execute(text(f"ALTER TABLE operation_logs ADD COLUMN {name} {column_type}"))


def ensure_user_columns():
    """用户表字段迁移（预留入口）"""
    columns = {}
    with engine.begin() as conn:
        exists = conn.execute(
            text("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
        ).fetchone()
        if not exists:
            return
        existing = {row[1] for row in conn.execute(text("PRAGMA table_info(users)"))}
        for name, ctype in columns.items():
            if name not in existing:
                conn.execute(text(f"ALTER TABLE users ADD COLUMN {name} {ctype}"))


def seed_default_users():
    """启动时自动创建三个默认账号（已存在则跳过）。"""
    from .models import User, UserRole
    from .utils.security import hash_password
    defaults = [
        ("admin",    "admin123",    "系统管理员", UserRole.ADMIN),
        ("operator", "operator123", "运营专员",   UserRole.OPERATOR),
        ("finance",  "finance123",  "财务专员",   UserRole.FINANCE),
    ]
    db = SessionLocal()
    try:
        for username, password, real_name, role in defaults:
            exists = db.query(User).filter(User.username == username).first()
            if exists:
                continue
            db.add(User(
                username=username,
                password_hash=hash_password(password),
                real_name=real_name,
                role=role,
                is_active=True,
            ))
        db.commit()
    finally:
        db.close()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
