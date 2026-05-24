"""
一键重置测试数据：tools/reset_db.py

用途：在每轮回归测试前清空数据，让测试用例编号 1 起的数据可重现。

会做：
  1) 删除 backend/zhubo_sys.db
  2) 清空 backend/files/ 目录下所有内容（保留目录本身）

注意：
  - 执行前请先停止后端（uvicorn），否则 SQLite 文件被占用会失败
  - 执行后启动后端，会自动重建表并种子三个默认账号（admin/operator/finance）

用法：
    cd D:\\zhubo-life-assisstant
    backend\\.venv\\Scripts\\python.exe tools\\reset_db.py
"""
import os
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND = os.path.join(ROOT, "backend")
DB = os.path.join(BACKEND, "zhubo_sys.db")
FILES = os.path.join(BACKEND, "files")


def confirm() -> bool:
    print("=" * 60)
    print("即将执行的操作：")
    print(f"  1) 删除数据库  : {DB}")
    print(f"  2) 清空文件目录: {FILES}\\*")
    print("=" * 60)
    print("提示：执行前请先停止后端（uvicorn），否则 DB 文件被占用会失败")
    ans = input("\n确认执行？输入 yes 继续，其他取消: ").strip().lower()
    return ans == "yes"


def remove_db() -> bool:
    if not os.path.exists(DB):
        print(f"[skip] 数据库不存在: {DB}")
        return True
    try:
        os.remove(DB)
        print(f"[ok]   已删除数据库: {DB}")
        return True
    except OSError as e:
        print(f"[fail] 删除数据库失败: {e}")
        print("       请先停止后端（uvicorn）后再次运行本脚本")
        return False


def clear_files() -> bool:
    if not os.path.isdir(FILES):
        print(f"[skip] 文件目录不存在: {FILES}")
        return True
    failed = 0
    for entry in os.listdir(FILES):
        p = os.path.join(FILES, entry)
        try:
            if os.path.isdir(p):
                shutil.rmtree(p)
            else:
                os.remove(p)
        except OSError as e:
            failed += 1
            print(f"[fail] 删除失败 {p}: {e}")
    if failed == 0:
        print(f"[ok]   已清空文件目录: {FILES}")
        return True
    print(f"[fail] 共有 {failed} 项清理失败")
    return False


def main() -> None:
    if not confirm():
        print("已取消")
        return
    print()
    ok_db = remove_db()
    ok_files = clear_files()
    print()
    if ok_db and ok_files:
        print("重置完成 ✔  下一步：启动后端，会自动建表并种子三个账号")
        print("    cd backend")
        print("    .\\.venv\\Scripts\\python.exe -m uvicorn app.main:app --reload --port 8000")
    else:
        print("部分步骤失败 ✘  请按上面提示处理后重试")
        sys.exit(1)


if __name__ == "__main__":
    main()
