import os
import shutil
import sqlite3
import uuid
import hashlib
import secrets
import base64
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.responses import Response
from pydantic import BaseModel, Field
from fastapi.staticfiles import StaticFiles

app = FastAPI()
DATA_DIR = os.environ.get("DATA_DIR", ".")
DB = os.path.join(DATA_DIR, "petebirthday.db")
# The guest code (uploads + the site-wide lock) lives only in Coolify (Environment Variables → SECRET_CODE), never in this file
SECRET_CODE = os.environ.get("SECRET_CODE", "")
# The admin code lives only in Coolify (Environment Variables → ADMIN_CODE), never in this file
ADMIN_CODE = os.environ.get("ADMIN_CODE", "")
# Pete's own secret word for the Confessional, also only in Coolify (Environment Variables → PETE_CODE)
PETE_CODE = os.environ.get("PETE_CODE", "")
UPLOAD_DIR = os.path.join(DATA_DIR, "uploads")
ALLOWED = {".jpg", ".jpeg", ".png", ".gif", ".heic", ".mp4", ".mov"}
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Private birthday card: the whole site sits behind the guest code (any username, code as password)
@app.middleware("http")
async def lock_site(request, call_next):
    header = request.headers.get("authorization", "")
    if SECRET_CODE and header.startswith("Basic "):
        try:
            _, _, given = base64.b64decode(header[6:]).decode().partition(":")
        except Exception:
            given = ""
        if secrets.compare_digest(given.strip(), SECRET_CODE):
            return await call_next(request)
    return Response("Pete's card is private.", status_code=401,
                    headers={"WWW-Authenticate": 'Basic realm="Pete\'s 50th"'})

# Private birthday card: tell search engines not to index any page, photo or video
@app.middleware("http")
async def no_index(request, call_next):
    response = await call_next(request)
    response.headers["X-Robots-Tag"] = "noindex, nofollow, noimageindex"
    return response

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
    # kind: 'message' (shown on the card) or 'relic' (old photo hidden in an advent window)
    cols = [r["name"] for r in conn.execute("PRAGMA table_info(messages)").fetchall()]
    if "kind" not in cols:
        conn.execute("ALTER TABLE messages ADD COLUMN kind TEXT DEFAULT 'message'")
    if "sticker" not in cols:
        # 1 = a cheeky photo gets a St Petermas sticker over it (tap to peek)
        conn.execute("ALTER TABLE messages ADD COLUMN sticker INTEGER DEFAULT 0")
    if "sticker_x" not in cols:
        # where the sticker sits on the photo, as % across and down
        conn.execute("ALTER TABLE messages ADD COLUMN sticker_x REAL DEFAULT 50")
        conn.execute("ALTER TABLE messages ADD COLUMN sticker_y REAL DEFAULT 50")
    if "window" not in cols:
        # a relic pinned to one advent window (1-31); empty = fill the relic windows in order
        conn.execute("ALTER TABLE messages ADD COLUMN window INTEGER")

    # advent windows Pete has scratched: their photos then appear in his card for everyone
    conn.execute("""
        CREATE TABLE IF NOT EXISTS revealed (
            day INTEGER PRIMARY KEY,
            revealed_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)
    # The Confessional: private memories and deep-and-meaningfuls, for Pete's eyes only
    # Pete's own secret word for the Confessional (only a salted hash is stored; nobody else knows it)
    # Pete's thank-you note, pinned at the top of the card (one note, can be edited)
    conn.execute("CREATE TABLE IF NOT EXISTS thanks (id INTEGER PRIMARY KEY CHECK (id = 1), text TEXT, updated_at TEXT)")
    conn.execute("CREATE TABLE IF NOT EXISTS pete_word (id INTEGER PRIMARY KEY CHECK (id = 1), salt TEXT, hash TEXT)")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS confessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            text TEXT NOT NULL,
            contact TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)
    ccols = [r["name"] for r in conn.execute("PRAGMA table_info(confessions)").fetchall()]
    if "seen" not in ccols:
        conn.execute("ALTER TABLE confessions ADD COLUMN seen INTEGER DEFAULT 0")  # 1 once Pete has opened it

# Window 1 opens on St Petermas Eve (Wed 30 Sept, 7pm UK); window N on N October (midnight UK)
EVE = datetime(2026, 9, 30, 18, 0, tzinfo=timezone.utc)
START = datetime(2026, 9, 30, 23, 0, tzinfo=timezone.utc)


def days_open_now():
    now = datetime.now(timezone.utc)
    if now < EVE:
        return 0
    if now < START:
        return 1
    return min(31, (now - START).days + 1)


class Message(BaseModel):
    code: str
    name: str = Field(max_length=60)
    text: str = Field(max_length=2000)
    media: str | None = None
    kind: str = "message"


@app.post("/messages")
def add_message(msg: Message):
    if msg.code != SECRET_CODE:
        raise HTTPException(status_code=403, detail="Wrong code")
    kind = "relic" if msg.kind == "relic" else "message"
    if kind == "relic" and not msg.media:
        raise HTTPException(status_code=400, detail="A relic needs a photo")
    with get_db() as conn:
        conn.execute(
            "INSERT INTO messages (name, text, media, kind) VALUES (?, ?, ?, ?)",
            (msg.name, msg.text, msg.media, kind),
        )
    return {"saved": True}


@app.get("/messages")
def list_messages():
    with get_db() as conn:
        rows = conn.execute(
            "SELECT id, name, text, media, COALESCE(sticker, 0) AS sticker, "
            "COALESCE(sticker_x, 50) AS sticker_x, COALESCE(sticker_y, 50) AS sticker_y, created_at FROM messages "
            "WHERE approved = 1 AND COALESCE(kind, 'message') = 'message' ORDER BY id"
        ).fetchall()
    return [dict(row) for row in rows]


@app.get("/relics")
def list_relics():
    # Approved old photos, in order: the first fills window 1, the second window 2, and so on
    with get_db() as conn:
        rows = conn.execute(
            "SELECT id, name, text, media, sticker, sticker_x, sticker_y, window FROM messages "
            "WHERE approved = 1 AND kind = 'relic' ORDER BY id"
        ).fetchall()
    return [dict(row) for row in rows]

@app.post("/upload")
def upload(code: str = Form(...), file: UploadFile = File(...)):
    if not SECRET_CODE or code != SECRET_CODE:
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
    if not ADMIN_CODE or admin_code != ADMIN_CODE:
        raise HTTPException(status_code=403, detail="Not allowed")


@app.get("/admin/messages")
def admin_list(admin_code: str):
    check_admin(admin_code)
    with get_db() as conn:
        rows = conn.execute(
            "SELECT id, name, text, media, approved, COALESCE(kind, 'message') AS kind, "
            "COALESCE(sticker, 0) AS sticker, COALESCE(sticker_x, 50) AS sticker_x, "
            "COALESCE(sticker_y, 50) AS sticker_y, created_at "
            "FROM messages ORDER BY id"
        ).fetchall()
    return [dict(row) for row in rows]


@app.post("/admin/sticker/{message_id}")
def admin_sticker(message_id: int, admin_code: str):
    # Toggle the St Petermas sticker over a cheeky photo
    check_admin(admin_code)
    with get_db() as conn:
        conn.execute(
            "UPDATE messages SET sticker = CASE WHEN COALESCE(sticker, 0) = 1 THEN 0 ELSE 1 END WHERE id = ?",
            (message_id,),
        )
    return {"toggled": message_id}


@app.post("/admin/sticker-pos/{message_id}")
def admin_sticker_pos(message_id: int, admin_code: str, x: float, y: float):
    # Move the sticker to where Lisa tapped on the photo
    check_admin(admin_code)
    x = max(0.0, min(100.0, x))
    y = max(0.0, min(100.0, y))
    with get_db() as conn:
        conn.execute("UPDATE messages SET sticker_x = ?, sticker_y = ? WHERE id = ?", (x, y, message_id))
    return {"moved": message_id, "x": x, "y": y}


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


@app.post("/admin/to-advent/{message_id}")
def admin_to_advent(message_id: int, admin_code: str, window: int):
    # Copy a message's photo (sticker and all) into an advent window as a relic
    check_admin(admin_code)
    if window < 1 or window > 31:
        raise HTTPException(status_code=400, detail="Window must be 1 to 31")
    with get_db() as conn:
        row = conn.execute("SELECT * FROM messages WHERE id = ?", (message_id,)).fetchone()
        if not row or not row["media"]:
            raise HTTPException(status_code=404, detail="No photo on that message")
        # its own copy of the file, so deleting one never breaks the other
        new_name = uuid.uuid4().hex + os.path.splitext(row["media"])[1].lower()
        shutil.copyfile(os.path.join(UPLOAD_DIR, row["media"]), os.path.join(UPLOAD_DIR, new_name))
        # one relic per pinned window
        conn.execute("UPDATE messages SET window = NULL WHERE kind = 'relic' AND window = ?", (window,))
        cur = conn.execute(
            "INSERT INTO messages (name, text, media, approved, kind, sticker, sticker_x, sticker_y, window) "
            "VALUES (?, '', ?, 1, 'relic', ?, ?, ?, ?)",
            (row["name"], new_name, row["sticker"] or 0, row["sticker_x"] or 50, row["sticker_y"] or 50, window),
        )
    return {"relic": cur.lastrowid, "window": window}


@app.post("/admin/relic-window/{message_id}")
def admin_relic_window(message_id: int, admin_code: str, window: int = 0):
    # Move a relic to a chosen advent window (1-31); 0 = no fixed window (fills in order again)
    check_admin(admin_code)
    if window < 0 or window > 31:
        raise HTTPException(status_code=400, detail="Window must be 1 to 31")
    with get_db() as conn:
        if window:
            conn.execute("UPDATE messages SET window = NULL WHERE kind = 'relic' AND window = ? AND id != ?",
                         (window, message_id))
        conn.execute("UPDATE messages SET window = ? WHERE id = ? AND kind = 'relic'",
                     (window or None, message_id))
    return {"relic": message_id, "window": window or None}


@app.post("/admin/replace-media/{message_id}")
def admin_replace_media(message_id: int, admin_code: str = Form(...), file: UploadFile = File(...)):
    # Swap the photo on a message (the old file is kept on disk, just no longer shown)
    check_admin(admin_code)
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED:
        raise HTTPException(status_code=400, detail="Photos and videos only")
    new_name = uuid.uuid4().hex + ext
    with open(os.path.join(UPLOAD_DIR, new_name), "wb") as saved:
        shutil.copyfileobj(file.file, saved)
    with get_db() as conn:
        conn.execute("UPDATE messages SET media = ?, sticker = 0 WHERE id = ?", (new_name, message_id))
    return {"media": new_name}


class Confession(BaseModel):
    code: str
    name: str = Field(min_length=1, max_length=60)
    text: str = Field(min_length=1, max_length=4000)
    contact: str | None = Field(default=None, max_length=200)


@app.post("/confessions")
def add_confession(c: Confession):
    # Friends (with the invite code) leave a private word for Pete. Never shown on the card.
    if c.code.strip() != SECRET_CODE:
        raise HTTPException(status_code=403, detail="That code isn't right")
    with get_db() as conn:
        conn.execute("INSERT INTO confessions (name, text, contact) VALUES (?, ?, ?)",
                     (c.name.strip(), c.text.strip(), (c.contact or "").strip() or None))
    return {"ok": True}


@app.get("/confessions/count")
def confession_count():
    # Only the number: the chapel door glows when something is waiting
    with get_db() as conn:
        n = conn.execute("SELECT COUNT(*) AS n FROM confessions").fetchone()["n"]
        unread = conn.execute("SELECT COUNT(*) AS n FROM confessions WHERE COALESCE(seen, 0) = 0").fetchone()["n"]
    return {"count": n, "unread": unread}


class PeteCode(BaseModel):
    pete_code: str
    new_word: str | None = Field(default=None, max_length=100)


def _hash(word: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac("sha256", word.strip().lower().encode(), salt.encode(), 200_000).hex()


def _pete_word():
    with get_db() as conn:
        return conn.execute("SELECT salt, hash FROM pete_word WHERE id = 1").fetchone()


@app.post("/confessions/open")
def open_confessions(body: PeteCode):
    # Once Pete has chosen his own word, only that word opens the Confessional.
    # Before then, Lisa's one-time key (PETE_CODE) lets him in once, to choose his word.
    row = _pete_word()
    if row:
        if not secrets.compare_digest(_hash(body.pete_code, row["salt"]), row["hash"]):
            raise HTTPException(status_code=403, detail="That's not the word")
    else:
        if not PETE_CODE or body.pete_code.strip().lower() != PETE_CODE.strip().lower():
            raise HTTPException(status_code=403, detail="That's not the word")
        if not body.new_word or len(body.new_word.strip()) < 3:
            return {"choose_word": True}  # first visit: ask Pete to choose his own word
        salt = secrets.token_hex(16)
        with get_db() as conn:
            conn.execute("INSERT OR REPLACE INTO pete_word (id, salt, hash) VALUES (1, ?, ?)",
                         (salt, _hash(body.new_word, salt)))
    with get_db() as conn:
        rows = conn.execute(
            "SELECT id, name, text, contact, created_at, COALESCE(seen, 0) AS seen FROM confessions ORDER BY id"
        ).fetchall()
        conn.execute("UPDATE confessions SET seen = 1 WHERE COALESCE(seen, 0) = 0")  # Pete has now read them
    return {"confessions": [dict(r) for r in rows]}


class Thanks(BaseModel):
    text: str = Field(max_length=2000)
    pete_code: str | None = None
    admin_code: str | None = None


@app.get("/thanks")
def get_thanks():
    with get_db() as conn:
        row = conn.execute("SELECT text FROM thanks WHERE id = 1").fetchone()
    return {"text": row["text"] if row and row["text"] else ""}


@app.post("/thanks")
def set_thanks(body: Thanks):
    # Pete (with his Confessional word) or Lisa (admin code) can post or edit the thank-you. Empty text removes it.
    ok = bool(ADMIN_CODE) and body.admin_code == ADMIN_CODE
    if not ok and body.pete_code:
        row = _pete_word()
        ok = bool(row) and secrets.compare_digest(_hash(body.pete_code, row["salt"]), row["hash"])
    if not ok:
        raise HTTPException(status_code=403, detail="Not allowed")
    with get_db() as conn:
        conn.execute("INSERT OR REPLACE INTO thanks (id, text, updated_at) VALUES (1, ?, CURRENT_TIMESTAMP)",
                     (body.text.strip(),))
    return {"ok": True}


@app.post("/admin/reset-pete-word")
def admin_reset_pete_word(admin_code: str):
    # If Pete forgets his word: clears it, so the one-time key works again and he chooses a new one
    check_admin(admin_code)
    with get_db() as conn:
        conn.execute("DELETE FROM pete_word")
    return {"reset": True}


@app.get("/revealed")
def list_revealed():
    with get_db() as conn:
        rows = conn.execute("SELECT day FROM revealed ORDER BY day").fetchall()
    return [row["day"] for row in rows]


@app.post("/revealed/{day}")
def add_revealed(day: int):
    # nobody can reveal a window before its day
    if day < 1 or day > days_open_now():
        raise HTTPException(status_code=403, detail="That window isn't open yet")
    with get_db() as conn:
        conn.execute("INSERT OR IGNORE INTO revealed (day) VALUES (?)", (day,))
    return {"ok": True}


class CodeCheck(BaseModel):
    code: str


# Anyone who reaches this is already past the site lock, so hand the card the guest code
# and it can open without asking a second time
@app.get("/door-code")
def door_code():
    return {"code": SECRET_CODE}


@app.post("/check-code")
def check_code(body: CodeCheck):
    if not SECRET_CODE or body.code.strip() != SECRET_CODE:
        raise HTTPException(status_code=403, detail="That code isn't right")
    return {"ok": True}


# Serve the built React site (only exists in the live version)
FRONTEND_DIR = "frontend/dist"
if os.path.isdir(FRONTEND_DIR):
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
