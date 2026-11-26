-- 《魔數學院》Cloudflare D1 (SQLite) 資料庫結構
-- 套用方式：
--   本地：npx wrangler d1 execute mosu-db --local --file=worker/schema.sql
--   雲端：npx wrangler d1 execute mosu-db --remote --file=worker/schema.sql

CREATE TABLE IF NOT EXISTS classes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,           -- 班級代碼，例如 402
  name TEXT NOT NULL,                  -- 班級名稱，例如 四年二班
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  group_name TEXT NOT NULL DEFAULT '', -- 組別，例如 1、A（可留空）
  seat_no TEXT NOT NULL DEFAULT '',    -- 座號，例如 07
  name TEXT NOT NULL,                  -- 姓名／暱稱
  login_code TEXT NOT NULL UNIQUE,     -- 顯示用登入碼，例如 402-1-07-K9
  login_key TEXT NOT NULL UNIQUE,      -- 比對用（大寫、去連字號與空白）
  token TEXT NOT NULL UNIQUE,          -- 學生同步憑證
  save_json TEXT,                      -- 完整遊戲存檔 JSON
  lv INTEGER NOT NULL DEFAULT 1,
  progress_pct INTEGER NOT NULL DEFAULT 0,
  review_count INTEGER NOT NULL DEFAULT 0,
  total_play_sec INTEGER NOT NULL DEFAULT 0,
  session_count INTEGER NOT NULL DEFAULT 0,
  total_answered INTEGER NOT NULL DEFAULT 0,
  total_correct INTEGER NOT NULL DEFAULT 0,
  last_seen_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  client_sid TEXT NOT NULL UNIQUE,     -- 前端單次遊玩識別碼（避免重覆計次與重覆累計時間）
  started_at TEXT NOT NULL,
  ended_at TEXT NOT NULL,
  active_sec INTEGER NOT NULL DEFAULT 0,
  answered INTEGER NOT NULL DEFAULT 0,
  correct INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS mistakes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  client_mid TEXT UNIQUE,              -- 前端錯題事件去重 id
  branch TEXT NOT NULL DEFAULT '',
  grade TEXT NOT NULL DEFAULT '',
  type_key TEXT NOT NULL DEFAULT '',
  question_text TEXT NOT NULL,
  student_answer TEXT NOT NULL DEFAULT '',
  correct_answer TEXT NOT NULL DEFAULT '',
  mode TEXT NOT NULL DEFAULT '',
  resolved INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id);
CREATE INDEX IF NOT EXISTS idx_sessions_student_time ON sessions(student_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_mistakes_student_time ON mistakes(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mistakes_branch ON mistakes(branch, resolved);
