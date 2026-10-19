/// Versioned SQLite migrations for the club/booking app backend.
///
/// This database is separate from the ARENA website's PostgreSQL database.
/// Every club-owned row carries `club_id`; child rows (match players, goals,
/// posters) repeat it so that cross-club joins can be rejected by queries and
/// validated by triggers.
const migrations = <int, String>{
  1: r'''
CREATE TABLE accounts (
  id INTEGER PRIMARY KEY,
  display_name TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('kakao','dev')),
  provider_subject TEXT NOT NULL,
  password_hash TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  source TEXT NOT NULL DEFAULT 'user_created' CHECK (source IN ('demo','user_created')),
  created_at TEXT NOT NULL,
  UNIQUE (provider, provider_subject)
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX sessions_account ON sessions(account_id);

CREATE TABLE files (
  id TEXT PRIMARY KEY,
  club_id INTEGER REFERENCES clubs(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('club_logo','player_photo','poster')),
  mime TEXT NOT NULL,
  path TEXT NOT NULL,
  size INTEGER NOT NULL,
  source TEXT NOT NULL,
  source_ref TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX files_club ON files(club_id);

CREATE TABLE clubs (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  region TEXT,
  description TEXT,
  logo_file_id TEXT REFERENCES files(id) ON DELETE SET NULL,
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','private')),
  discoverable INTEGER NOT NULL DEFAULT 1,
  records_visibility TEXT NOT NULL DEFAULT 'members' CHECK (records_visibility IN ('public','members')),
  join_policy TEXT NOT NULL DEFAULT 'approval' CHECK (join_policy IN ('approval','invite_only')),
  seasons_json TEXT NOT NULL DEFAULT '[]',
  min_win_rate_matches INTEGER NOT NULL DEFAULT 3,
  activity_note TEXT,
  source TEXT NOT NULL CHECK (source IN ('arena_import','demo','user_created')),
  source_ref TEXT,
  imported_at TEXT,
  created_by INTEGER REFERENCES accounts(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (source, source_ref)
);

CREATE TABLE memberships (
  id INTEGER PRIMARY KEY,
  club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner','manager','recorder','member')),
  status TEXT NOT NULL CHECK (status IN ('pending','approved','rejected','left','banned')),
  message TEXT,
  invite_id INTEGER REFERENCES invites(id) ON DELETE SET NULL,
  requested_at TEXT NOT NULL,
  decided_at TEXT,
  decided_by INTEGER REFERENCES accounts(id),
  UNIQUE (club_id, account_id)
);
-- Exactly zero or one active owner per club. Imported clubs start without one.
CREATE UNIQUE INDEX memberships_one_owner ON memberships(club_id)
  WHERE role = 'owner' AND status = 'approved';

CREATE TABLE invites (
  id INTEGER PRIMARY KEY,
  club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  token_hint TEXT NOT NULL,
  created_by INTEGER NOT NULL REFERENCES accounts(id),
  expires_at TEXT NOT NULL,
  max_uses INTEGER,
  use_count INTEGER NOT NULL DEFAULT 0,
  revoked_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE players (
  id INTEGER PRIMARY KEY,
  club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  nickname TEXT,
  number INTEGER,
  position TEXT,
  photo_file_id TEXT REFERENCES files(id) ON DELETE SET NULL,
  is_guest INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  source TEXT NOT NULL CHECK (source IN ('arena_import','demo','user_created')),
  source_ref TEXT,
  import_snapshot TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (club_id, source, source_ref)
);
CREATE INDEX players_club ON players(club_id);
-- One account may be linked to at most one player profile per club.
CREATE UNIQUE INDEX players_one_account_per_club ON players(club_id, account_id)
  WHERE account_id IS NOT NULL;

CREATE TABLE player_photos (
  id INTEGER PRIMARY KEY,
  club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  file_id TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  fit TEXT NOT NULL DEFAULT 'cover',
  source_ref TEXT,
  UNIQUE (player_id, source_ref)
);

CREATE TABLE player_links (
  id INTEGER PRIMARY KEY,
  club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending','approved','rejected','cancelled')),
  requested_at TEXT NOT NULL,
  decided_at TEXT,
  decided_by INTEGER REFERENCES accounts(id)
);
CREATE UNIQUE INDEX player_links_one_pending ON player_links(club_id, account_id)
  WHERE status = 'pending';

CREATE TABLE matches (
  id INTEGER PRIMARY KEY,
  club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  match_date TEXT NOT NULL,
  start_time TEXT,
  location TEXT,
  status TEXT NOT NULL CHECK (status IN ('scheduled','in_progress','completed','cancelled')),
  team_a_name TEXT NOT NULL,
  team_b_name TEXT NOT NULL,
  team_a_score INTEGER,
  team_b_score INTEGER,
  memo TEXT,
  source TEXT NOT NULL CHECK (source IN ('arena_import','demo','user_created')),
  source_ref TEXT,
  import_snapshot TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_by INTEGER REFERENCES accounts(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (club_id, source, source_ref)
);
CREATE INDEX matches_club_date ON matches(club_id, match_date);

CREATE TABLE match_players (
  id INTEGER PRIMARY KEY,
  club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
  team TEXT NOT NULL CHECK (team IN ('A','B')),
  goals INTEGER NOT NULL DEFAULT 0 CHECK (goals >= 0),
  assists INTEGER NOT NULL DEFAULT 0 CHECK (assists >= 0),
  is_mom INTEGER NOT NULL DEFAULT 0,
  UNIQUE (match_id, player_id)
);
CREATE INDEX match_players_player ON match_players(player_id);

CREATE TABLE match_goals (
  id INTEGER PRIMARY KEY,
  club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  scorer_player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
  assist_player_id INTEGER REFERENCES players(id) ON DELETE RESTRICT,
  assist_known INTEGER NOT NULL DEFAULT 1,
  sequence INTEGER NOT NULL,
  UNIQUE (match_id, scorer_player_id, sequence)
);

CREATE TABLE posters (
  id INTEGER PRIMARY KEY,
  club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  file_id TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  source_ref TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (match_id, source_ref)
);

-- Child rows must belong to the same club as their parent rows.
CREATE TRIGGER match_players_same_club BEFORE INSERT ON match_players
WHEN (SELECT club_id FROM matches WHERE id = NEW.match_id) IS NOT NEW.club_id
  OR (SELECT club_id FROM players WHERE id = NEW.player_id) IS NOT NEW.club_id
BEGIN SELECT RAISE(ABORT, 'cross_club_reference'); END;
CREATE TRIGGER match_goals_same_club BEFORE INSERT ON match_goals
WHEN (SELECT club_id FROM matches WHERE id = NEW.match_id) IS NOT NEW.club_id
  OR (SELECT club_id FROM players WHERE id = NEW.scorer_player_id) IS NOT NEW.club_id
  OR (NEW.assist_player_id IS NOT NULL AND
      (SELECT club_id FROM players WHERE id = NEW.assist_player_id) IS NOT NEW.club_id)
BEGIN SELECT RAISE(ABORT, 'cross_club_reference'); END;
CREATE TRIGGER posters_same_club BEFORE INSERT ON posters
WHEN (SELECT club_id FROM matches WHERE id = NEW.match_id) IS NOT NEW.club_id
  OR (SELECT club_id FROM files WHERE id = NEW.file_id) IS NOT NEW.club_id
BEGIN SELECT RAISE(ABORT, 'cross_club_reference'); END;
CREATE TRIGGER player_links_same_club BEFORE INSERT ON player_links
WHEN (SELECT club_id FROM players WHERE id = NEW.player_id) IS NOT NEW.club_id
BEGIN SELECT RAISE(ABORT, 'cross_club_reference'); END;

CREATE TABLE audit_logs (
  id INTEGER PRIMARY KEY,
  club_id INTEGER REFERENCES clubs(id) ON DELETE CASCADE,
  actor_account_id INTEGER REFERENCES accounts(id),
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  detail_json TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX audit_logs_club ON audit_logs(club_id, id);

CREATE TABLE import_runs (
  id INTEGER PRIMARY KEY,
  source TEXT NOT NULL,
  source_url TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL,
  summary_json TEXT
);
CREATE TABLE import_conflicts (
  id INTEGER PRIMARY KEY,
  run_id INTEGER NOT NULL REFERENCES import_runs(id) ON DELETE CASCADE,
  entity TEXT NOT NULL,
  entity_id INTEGER,
  source_ref TEXT NOT NULL,
  detail_json TEXT NOT NULL
);

CREATE TABLE venues (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  region TEXT NOT NULL,
  area_label TEXT NOT NULL,
  indoor INTEGER NOT NULL,
  play_format TEXT NOT NULL,
  surface TEXT,
  price_per_slot INTEGER NOT NULL,
  slot_minutes INTEGER NOT NULL DEFAULT 120,
  open_hour INTEGER NOT NULL,
  close_hour INTEGER NOT NULL,
  amenities_json TEXT NOT NULL DEFAULT '{}',
  booking_mode TEXT NOT NULL CHECK (booking_mode IN ('instant','approval','payment')),
  cancel_deadline_hours INTEGER NOT NULL DEFAULT 24,
  payment_hold_minutes INTEGER NOT NULL DEFAULT 10,
  description TEXT,
  provider TEXT NOT NULL DEFAULT 'demo',
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE venue_slots (
  id INTEGER PRIMARY KEY,
  venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  local_date TEXT NOT NULL,
  local_start TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  price INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','blocked')),
  UNIQUE (venue_id, starts_at)
);
CREATE INDEX venue_slots_date ON venue_slots(venue_id, local_date);

CREATE TABLE bookings (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  venue_id INTEGER NOT NULL REFERENCES venues(id),
  slot_id INTEGER NOT NULL REFERENCES venue_slots(id),
  account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
  booker_name TEXT NOT NULL,
  phone_hmac TEXT NOT NULL,
  phone_masked TEXT NOT NULL,
  headcount INTEGER,
  note TEXT,
  price INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending_approval','pending_payment','confirmed','cancelled','expired')),
  idempotency_key TEXT NOT NULL UNIQUE,
  hold_expires_at TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0,
  seed_ref TEXT UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  cancelled_at TEXT,
  cancel_reason TEXT
);
-- Server-side double-booking guard: one live booking per slot.
CREATE UNIQUE INDEX bookings_one_active_per_slot ON bookings(slot_id)
  WHERE status IN ('pending_approval','pending_payment','confirmed');
CREATE INDEX bookings_phone ON bookings(phone_hmac);
CREATE INDEX bookings_account ON bookings(account_id);

CREATE TABLE booking_events (
  id INTEGER PRIMARY KEY,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  actor TEXT NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE phone_verifications (
  id TEXT PRIMARY KEY,
  phone_hmac TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  verified_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX phone_verifications_phone ON phone_verifications(phone_hmac, created_at);

CREATE TABLE guest_tokens (
  token_hash TEXT PRIMARY KEY,
  phone_hmac TEXT NOT NULL,
  phone_masked TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE app_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
''',
};
