-- Independent local D1 schema. Never applied to Supabase or a remote database.
CREATE TABLE IF NOT EXISTS identities (
  id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
  password_hash TEXT NOT NULL, password_salt TEXT NOT NULL, confirmed INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES identities(id), expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS entities (
  collection TEXT NOT NULL, id TEXT NOT NULL, operation_id TEXT,
  data TEXT NOT NULL CHECK(json_valid(data)), PRIMARY KEY(collection,id)
);
CREATE INDEX IF NOT EXISTS entities_operation ON entities(operation_id,collection);
CREATE TABLE IF NOT EXISTS revisions (id INTEGER PRIMARY KEY CHECK(id=1), version INTEGER NOT NULL);
INSERT OR IGNORE INTO revisions VALUES(1,0);
CREATE TABLE IF NOT EXISTS commands (
  actor_id TEXT NOT NULL REFERENCES identities(id), id TEXT NOT NULL,
  kind TEXT NOT NULL, payload TEXT NOT NULL, result TEXT NOT NULL CHECK(json_valid(result)),
  PRIMARY KEY(actor_id,id)
);
CREATE TABLE IF NOT EXISTS audit_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT, operation_id TEXT, actor_id TEXT NOT NULL,
  command_id TEXT NOT NULL, kind TEXT NOT NULL, created_at TEXT NOT NULL,
  UNIQUE(actor_id,command_id)
);
-- A failed compare-and-swap is a constraint failure, not a zero-row UPDATE.
-- This first statement aborts the entire D1 batch before domain/ledger/audit writes.
CREATE TABLE IF NOT EXISTS transaction_guards (id TEXT PRIMARY KEY, ok INTEGER NOT NULL CHECK(ok=1));
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY, operation_id TEXT NOT NULL, author_id TEXT NOT NULL,
  sha256 TEXT NOT NULL, object_key TEXT NOT NULL, mime TEXT NOT NULL, name TEXT NOT NULL,
  size INTEGER NOT NULL CHECK(size>0), created_at TEXT NOT NULL,
  extraction TEXT CHECK(extraction IS NULL OR json_valid(extraction)),
  UNIQUE(operation_id,sha256)
);
CREATE TABLE IF NOT EXISTS document_entry_links (
  document_id TEXT PRIMARY KEY REFERENCES documents(id), entry_id TEXT NOT NULL UNIQUE, operation_id TEXT NOT NULL
);
