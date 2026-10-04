CREATE TABLE IF NOT EXISTS participants (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 session_hash text NOT NULL UNIQUE,
 consent_version text NOT NULL,
 source text NOT NULL DEFAULT 'direct',
 mode text NOT NULL DEFAULT 'development',
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE participants ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'development';
CREATE TABLE IF NOT EXISTS study_sessions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 participant_id uuid NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK (kind IN ('pre','practice','post')),
 question_ids text[] NOT NULL,
 started_at timestamptz NOT NULL DEFAULT now(),
 completed_at timestamptz,
 score integer NOT NULL DEFAULT 0,
 UNIQUE(id,participant_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS one_assessment ON study_sessions(participant_id,kind) WHERE kind IN ('pre','post');
CREATE UNIQUE INDEX IF NOT EXISTS one_open_practice ON study_sessions(participant_id) WHERE kind='practice' AND completed_at IS NULL;
CREATE TABLE IF NOT EXISTS attempts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 session_id uuid NOT NULL,
 participant_id uuid NOT NULL,
 question_id text NOT NULL,
 choice integer NOT NULL CHECK (choice BETWEEN 0 AND 3),
 correct boolean NOT NULL,
 last_choice integer NOT NULL CHECK(last_choice BETWEEN 0 AND 3),
 try_count integer NOT NULL DEFAULT 1,
 resolved_at timestamptz,
 elapsed_ms integer NOT NULL CHECK (elapsed_ms BETWEEN 0 AND 3600000),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(session_id,question_id),
 FOREIGN KEY(session_id,participant_id) REFERENCES study_sessions(id,participant_id) ON DELETE CASCADE
);
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS last_choice integer;
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS try_count integer NOT NULL DEFAULT 1;
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS resolved_at timestamptz;
CREATE TABLE IF NOT EXISTS hint_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 session_id uuid NOT NULL,
 participant_id uuid NOT NULL,
 question_id text NOT NULL,
 stage integer NOT NULL CHECK (stage BETWEEN 1 AND 3),
 choice integer CHECK (choice BETWEEN 0 AND 3),
 source text NOT NULL CHECK (source IN ('authored','model','fallback','pending')),
 text text NOT NULL DEFAULT '',
 highlight text NOT NULL DEFAULT '',
 input_tokens integer NOT NULL DEFAULT 0,
 output_tokens integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(session_id,question_id,stage),
 FOREIGN KEY(session_id,participant_id) REFERENCES study_sessions(id,participant_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS content_reviews (
 question_id text PRIMARY KEY,
 content_hash text NOT NULL,
 reviewer text NOT NULL,
 notes text NOT NULL DEFAULT '',
 approved_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 participant_id uuid REFERENCES participants(id) ON DELETE CASCADE,
 name text NOT NULL,
 value text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS events_by_participant ON events(participant_id,name);
CREATE TABLE IF NOT EXISTS payments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 participant_id uuid NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
 reference text NOT NULL UNIQUE,
 amount integer NOT NULL CHECK(amount=14900),
 status text NOT NULL CHECK(status IN ('paid','refunded')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS rate_limits (
 bucket text PRIMARY KEY,
 count integer NOT NULL DEFAULT 1,
 expires_at timestamptz NOT NULL
);
