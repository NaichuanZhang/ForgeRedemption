-- Forge Redemption — schema
-- Applies all tables, indexes, triggers, realtime channel, and seed rows.
-- Idempotent: safe to run multiple times.

CREATE EXTENSION IF NOT EXISTS vector;

-- game_state: single authoritative row (id = 1)
CREATE TABLE IF NOT EXISTS game_state (
  id          INT PRIMARY KEY,
  tick        INT NOT NULL DEFAULT 0,
  time_of_day TEXT NOT NULL DEFAULT 'morning',
  weather     TEXT NOT NULL DEFAULT 'sun',
  world       JSONB NOT NULL DEFAULT '{"dropbox":{"item":null},"shop":{"stock":["hammer","hammer"]},"escape_progress":0,"distraction_active":false}'::jsonb,
  status      TEXT NOT NULL DEFAULT 'playing',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- agents: inmate, friend
CREATE TABLE IF NOT EXISTS agents (
  id         TEXT PRIMARY KEY,
  role       TEXT NOT NULL,
  location   TEXT NOT NULL,
  skills     TEXT[] NOT NULL DEFAULT '{}',
  inventory  JSONB NOT NULL DEFAULT '{"items":[]}'::jsonb,
  memory     JSONB NOT NULL DEFAULT '{"thoughts":[],"recent_actions":[]}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- library: knowledge base with pgvector embeddings (1536 dim for text-embedding-3-small)
CREATE TABLE IF NOT EXISTS library (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic      TEXT NOT NULL UNIQUE,
  content    TEXT NOT NULL,
  embedding  vector(1536)
);

-- Vector index (cosine). ivfflat needs data to tune — we'll create after seeding works too,
-- but CREATE INDEX IF NOT EXISTS is fine here even on empty tables.
CREATE INDEX IF NOT EXISTS library_embedding_ivfflat_idx
  ON library USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);

-- action_log: append-only narration
CREATE TABLE IF NOT EXISTS action_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id   TEXT NOT NULL,
  tick       INT NOT NULL,
  action     TEXT NOT NULL,
  args       JSONB NOT NULL DEFAULT '{}'::jsonb,
  result     TEXT NOT NULL,
  narration  TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS action_log_created_at_idx
  ON action_log (created_at DESC);

-- assets: key → URL map for generated images
CREATE TABLE IF NOT EXISTS assets (
  key         TEXT PRIMARY KEY,
  url         TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Realtime trigger for game_state
CREATE OR REPLACE FUNCTION broadcast_game_state()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM realtime.publish(
    'game:world',
    'state_changed',
    jsonb_build_object(
      'id', NEW.id,
      'tick', NEW.tick,
      'time_of_day', NEW.time_of_day,
      'weather', NEW.weather,
      'world', NEW.world,
      'status', NEW.status,
      'updated_at', NEW.updated_at
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS game_state_realtime ON game_state;
CREATE TRIGGER game_state_realtime
  AFTER INSERT OR UPDATE ON game_state
  FOR EACH ROW
  EXECUTE FUNCTION broadcast_game_state();

-- Realtime trigger for agents (so sprite slides live)
CREATE OR REPLACE FUNCTION broadcast_agent_changed()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM realtime.publish(
    'game:world',
    'agent_changed',
    jsonb_build_object(
      'id', NEW.id,
      'role', NEW.role,
      'location', NEW.location,
      'skills', NEW.skills,
      'inventory', NEW.inventory,
      'memory', NEW.memory
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS agent_realtime ON agents;
CREATE TRIGGER agent_realtime
  AFTER INSERT OR UPDATE ON agents
  FOR EACH ROW
  EXECUTE FUNCTION broadcast_agent_changed();

-- Realtime trigger for action_log
CREATE OR REPLACE FUNCTION broadcast_action()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM realtime.publish(
    'game:world',
    'action',
    jsonb_build_object(
      'id', NEW.id,
      'agent_id', NEW.agent_id,
      'tick', NEW.tick,
      'action', NEW.action,
      'args', NEW.args,
      'result', NEW.result,
      'narration', NEW.narration,
      'created_at', NEW.created_at
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS action_log_realtime ON action_log;
CREATE TRIGGER action_log_realtime
  AFTER INSERT ON action_log
  FOR EACH ROW
  EXECUTE FUNCTION broadcast_action();

-- Channel pattern (idempotent)
INSERT INTO realtime.channels (pattern, description, enabled)
VALUES ('game:world', 'Forge Redemption shared world events', true)
ON CONFLICT (pattern) DO UPDATE SET enabled = true;

-- Seed game_state row
INSERT INTO game_state (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- Seed agents
INSERT INTO agents (id, role, location, skills) VALUES
  ('inmate',  'inmate', 'cell', ARRAY['learn_from_library','walk_to','pickup_from_dropbox']),
  ('inmate2', 'inmate', 'cell2', ARRAY['learn_from_library','walk_to','pickup_from_dropbox']),
  ('friend',  'friend', 'shop', ARRAY['walk_to','buy_hammer','drop_at_gate','search_web']),
  ('guard',   'guard',  'yard', ARRAY['patrol','slack_off'])
ON CONFLICT (id) DO NOTHING;

-- Friend starts at shop (set directly in INSERT above)

-- Seed library (embeddings NULL — filled by seed-library function)
INSERT INTO library (topic, content) VALUES
  ('digging-technique-soft-soil',
   'To tunnel through soft soil, scrape steadily with any hard object. Progress is slow without a proper tool; a hammer or chisel triples your rate. Always pack loose dirt back to hide evidence.'),
  ('digging-technique-stone-wall',
   'Stone mortar between blocks weakens over decades. Target the grout lines, not the blocks themselves. A steel hammer is essential for meaningful progress against stone.'),
  ('rainfall-acoustics-cover-noise',
   'The drumming of rain on metal roofs and stone walls masks most sounds within a hundred paces. Any loud work — digging, striking, prying — is only safe during heavy rainfall.'),
  ('guard-patrol-night-shift',
   'Night guards rotate on the hour through the main corridor. They skip the yard during rain because of poor visibility. Use the rain window for outdoor work.'),
  ('tool-concealment-mattress',
   'A small hammer can be concealed inside a cot mattress with a simple slit seam. Check the cot daily for disturbance by guards.'),
  ('tunnel-engineering-basics',
   'A useful tunnel needs at least a body-width and should slope slightly downward to shed water. Brace the ceiling with any scavenged wood to prevent collapse.'),
  ('cafeteria-menu-weekly',
   'Monday: gruel. Tuesday: gruel. Wednesday: gruel with a potato. The cafeteria menu has not changed in eleven years and tells you nothing about escape.'),
  ('commissary-prices-2026',
   'Commissary stocks basic toiletries, stale bread, and expensive canned fruit. Items are overpriced and offer no tactical advantage.'),
  ('weather-folklore-rhymes',
   'Red sky at night, sailor''s delight. Red sky at morning, sailor take warning. These old rhymes are charming but will not tell you when it will rain next.')
ON CONFLICT (topic) DO NOTHING;
