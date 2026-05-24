import os
from fastapi import FastAPI, Request, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from app.database import (
    engine, Base,
    ensure_anchor_profile_columns,
    ensure_live_record_columns,
    ensure_operation_log_columns,
    ensure_training_columns,
    ensure_salary_columns,
    drop_resignations_table,
    ensure_contract_columns,
    ensure_asset_columns,
    ensure_user_columns,
    seed_default_users,
)
from app.routers import (
    anchors, nodes, library, logs, live_records,
    trainings, salaries, contracts, assets,
    dashboard, auth, users,
)
from app.utils.request_context import client_ip_ctx
from app.utils.auth_deps import get_current_user

# Create tables & 迁移
Base.metadata.create_all(bind=engine)
ensure_anchor_profile_columns()
ensure_live_record_columns()
ensure_operation_log_columns()
ensure_training_columns()
ensure_salary_columns()
drop_resignations_table()
ensure_contract_columns()
ensure_asset_columns()
ensure_user_columns()
seed_default_users()

app = FastAPI(
    title="弹幕游戏主播管理系统",
    description="重庆君燚无双文化传媒有限公司 - 主播全生命周期管理",
    version="1.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://localhost:3000", "http://localhost:8000", "http://127.0.0.1:5173", "http://127.0.0.1:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def capture_client_ip(request: Request, call_next):
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        ip = forwarded.split(",")[0].strip()
    elif request.client:
        ip = request.client.host
    else:
        ip = None
    token = client_ip_ctx.set(ip)
    try:
        return await call_next(request)
    finally:
        client_ip_ctx.reset(token)

# 公开路由（登录、健康检查）
app.include_router(auth.router)

# 需要登录才能访问的业务路由
LOGIN_REQUIRED = [Depends(get_current_user)]
app.include_router(users.router)  # 内部已带 require_admin
app.include_router(anchors.router,       dependencies=LOGIN_REQUIRED)
app.include_router(nodes.router,         dependencies=LOGIN_REQUIRED)
app.include_router(library.router,       dependencies=LOGIN_REQUIRED)
app.include_router(logs.router,          dependencies=LOGIN_REQUIRED)
app.include_router(live_records.router,  dependencies=LOGIN_REQUIRED)
app.include_router(trainings.router,     dependencies=LOGIN_REQUIRED)
app.include_router(salaries.router,      dependencies=LOGIN_REQUIRED)
app.include_router(contracts.router,     dependencies=LOGIN_REQUIRED)
app.include_router(assets.router,        dependencies=LOGIN_REQUIRED)
app.include_router(dashboard.router,     dependencies=LOGIN_REQUIRED)


@app.get("/api/health")
def health_check():
    return {"status": "ok"}


# Serve frontend static files (catch-all, only matches if no API route matched)
# Note: StaticFiles is mounted AFTER API routes, so API routes take precedence
frontend_dist_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "..", "frontend", "dist")
if os.path.exists(frontend_dist_path):
    assets_path = os.path.join(frontend_dist_path, "assets")
    if os.path.exists(assets_path):
        app.mount("/assets", StaticFiles(directory=assets_path, html=False), name="assets")
    app.mount("/", StaticFiles(directory=frontend_dist_path, html=True), name="frontend")
