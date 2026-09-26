import os
import shutil
import sqlite3
import uuid
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from pydantic import BaseModel, Field
from fastapi.staticfiles import StaticFiles

app = FastAPI()
DB = "petebirthday.db"
SECRET_CODE = "allin76"
ADMIN_CODE = "scruttock"
UPLOAD_DIR = "uploads"
ALLOWED = {".jpg", ".jpeg", ".png", ".heic", ".mp4", ".mov"}
os.makedirs(UPLOAD_DIR, exist_ok=True)

app.mount("/media", StaticFiles(directory=UPLOAD_DIR), name="media")

def get_db():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    return conn


with get_db() as conn:
    conn.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            text TEXT NOT NULL,
            media TEXT,
            approved INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)

class Message(BaseModel):
    code: str
    name: str = Field(max_length=60)
    text: str = Field(max_length=2000)
    media: str | None = None


@app.get("/")
def home():
    return {"message": "Happy Birthday"}


@app.post("/messages")
def add_message(msg: Message):
    if msg.code != SECRET_CODE:
        raise HTTPException(status_code=403, detail="Wrong code")
    with get_db() as conn:
        conn.execute(
        "INSERT INTO messages (name, text, media) VALUES (?, ?, ?)",
  (msg.name, msg.text, msg.media),
        )
    return {"saved": True}


@app.get("/messages")
def list_messages():
    with get_db() as conn:
        rows = conn.execute(
            "SELECT id, name, text, media, created_at FROM messages WHERE approved = 1 ORDER BY id"
        ).fetchall()
    return [dict(row) for row in rows]

@app.post("/upload")
def upload(code: str = Form(...), file: UploadFile = File(...)):
    if code != SECRET_CODE:
        raise HTTPException(status_code=403, detail="Wrong code")

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED:
        raise HTTPException(status_code=400, detail="Photos and videos only")

    limit = 200 if ext in {".mp4", ".mov"} else 15
    if file.size and file.size > limit * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"File too big (max {limit} MB)")


    new_name = uuid.uuid4().hex + ext
    with open(os.path.join(UPLOAD_DIR, new_name), "wb") as saved:
        shutil.copyfileobj(file.file, saved)

    return {"file": new_name}

def check_admin(admin_code: str):
    if admin_code != ADMIN_CODE:
        raise HTTPException(status_code=403, detail="Not allowed")


@app.get("/admin/messages")
def admin_list(admin_code: str):
    check_admin(admin_code)
    with get_db() as conn:
        rows = conn.execute(
            "SELECT id, name, text, media, approved, created_at FROM messages ORDER BY id"
        ).fetchall()
    return [dict(row) for row in rows]


@app.post("/admin/approve/{message_id}")
def admin_approve(message_id: int, admin_code: str):
    check_admin(admin_code)
    with get_db() as conn:
        conn.execute("UPDATE messages SET approved = 1 WHERE id = ?", (message_id,))
    return {"approved": message_id}


@app.delete("/admin/messages/{message_id}")
def admin_delete(message_id: int, admin_code: str):
    check_admin(admin_code)
    with get_db() as conn:
        row = conn.execute("SELECT media FROM messages WHERE id = ?", (message_id,)).fetchone()
        if row and row["media"]:
            path = os.path.join(UPLOAD_DIR, row["media"])
            if os.path.exists(path):
                os.remove(path)
        conn.execute("DELETE FROM messages WHERE id = ?", (message_id,))
    return {"deleted": message_id}