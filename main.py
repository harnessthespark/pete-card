import sqlite3
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI()
DB = "petebirthday.db"
SECRET_CODE = "allin76"


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
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)


class Message(BaseModel):
    code: str
    name: str
    text: str


@app.get("/")
def home():
    return {"message": "Happy Birthday"}


@app.post("/messages")
def add_message(msg: Message):
    if msg.code != SECRET_CODE:
        raise HTTPException(status_code=403, detail="Wrong code")
    with get_db() as conn:
        conn.execute(
            "INSERT INTO messages (name, text) VALUES (?, ?)",
            (msg.name, msg.text),
        )
    return {"saved": True}


@app.get("/messages")
def list_messages():
    with get_db() as conn:
        rows = conn.execute(
            "SELECT id, name, text, created_at FROM messages ORDER BY id"
        ).fetchall()
    return [dict(row) for row in rows]