CREATE TABLE IF NOT EXISTS inference_usage (
  actor_id TEXT NOT NULL REFERENCES identities(id),
  day TEXT NOT NULL,
  count INTEGER NOT NULL CHECK(count BETWEEN 1 AND 20),
  PRIMARY KEY(actor_id,day)
);
