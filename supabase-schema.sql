-- ============================================
-- The Circle Portal — Supabase Schema
-- Run this in the Supabase SQL editor
-- ============================================

-- Profiles table (extends Supabase auth.users)
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  role text not null default 'member' check (role in ('admin', 'member')),
  full_name text,
  created_at timestamptz default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Members table
create table if not exists members (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete set null,
  name text not null,
  email text not null unique,
  join_date date not null default current_date,
  cohort text,
  status text not null default 'active' check (status in ('active', 'inactive', 'graduated')),
  blueprint_data jsonb,
  -- When the member was actually invited to the portal (sent a login link).
  -- NULL = created but not yet given access; the Friday check-in cron skips these.
  invited_at timestamptz,
  created_at timestamptz default now()
);
-- For existing databases (table created before invited_at existed):
alter table members add column if not exists invited_at timestamptz;
-- Staff/test accounts that live in members but aren't real coaching members
-- (excluded from the weekly team digest).
alter table members add column if not exists is_internal boolean not null default false;

-- Weekly activity logs
create table if not exists weekly_logs (
  id uuid default gen_random_uuid() primary key,
  member_id uuid references members on delete cascade not null,
  week_of date not null,
  showed_up boolean not null default false,
  homework_done boolean not null default false,
  questions_asked integer not null default 0,
  notes text,
  logged_by uuid references auth.users on delete set null,
  created_at timestamptz default now(),
  unique (member_id, week_of)
);

-- Reports
create table if not exists reports (
  id uuid default gen_random_uuid() primary key,
  member_id uuid references members on delete cascade not null,
  period_type text not null check (period_type in ('monthly', 'quarterly', 'yearly')),
  period_label text not null,
  content_html text not null,
  generated_at timestamptz default now(),
  sent_at timestamptz,
  sent_by uuid references auth.users on delete set null
);

-- Per-member quarterly report reminders. Quarters run in 13-week blocks from the
-- member's own join_date, so a daily cron (/api/cron/quarter-reports) emails
-- admins when a member finishes a quarter. One row per member per completed
-- quarter guarantees the nudge fires exactly once.
create table if not exists quarter_report_notifications (
  id                uuid primary key default gen_random_uuid(),
  member_id         uuid not null references members(id) on delete cascade,
  completed_quarter int  not null,
  notified_at       timestamptz not null default now(),
  unique (member_id, completed_quarter)
);
alter table quarter_report_notifications enable row level security;
create policy "admins_all_qrn" on quarter_report_notifications
  for all using (is_admin()) with check (is_admin());

-- ============================================
-- Row Level Security
-- ============================================

alter table profiles enable row level security;
alter table members enable row level security;
alter table weekly_logs enable row level security;
alter table reports enable row level security;

-- Profiles: users can read/update their own
create policy "Users can view own profile"
  on profiles for select using (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);

-- Admins can do everything (helper function)
-- All staff roles count as "admin" for RLS read access. Granular write
-- permissions are enforced at the API layer (owner/admin/manager etc.).
create or replace function is_admin()
returns boolean as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
      and role in ('owner', 'admin', 'manager', 'support', 'tech')
  );
$$ language sql security definer;

-- Members: admins see all, members see their own
create policy "Admins can view all members"
  on members for select using (is_admin());

create policy "Members can view own record"
  on members for select using (
    email = (select email from auth.users where id = auth.uid())
  );

create policy "Admins can insert members"
  on members for insert with check (is_admin());

create policy "Admins can update members"
  on members for update using (is_admin());

-- Weekly logs: admins see/write all, members see own
create policy "Admins can manage all logs"
  on weekly_logs for all using (is_admin());

create policy "Members can view own logs"
  on weekly_logs for select using (
    member_id in (
      select id from members
      where email = (select email from auth.users where id = auth.uid())
    )
  );

-- Reports: admins manage all, members see sent reports for themselves
create policy "Admins can manage all reports"
  on reports for all using (is_admin());

create policy "Members can view own sent reports"
  on reports for select using (
    sent_at is not null
    and member_id in (
      select id from members
      where email = (select email from auth.users where id = auth.uid())
    )
  );

-- ============================================
-- Clarity Calls (embedded recordings: YouTube / Google Drive / Loom / Vimeo)
-- ============================================
create table if not exists clarity_calls (
  id           uuid primary key default gen_random_uuid(),
  member_id    uuid not null references members(id) on delete cascade,
  title        text not null,
  video_url    text not null,
  call_date    date,
  notes        text,
  created_at   timestamptz not null default now(),
  created_by   uuid references auth.users(id) on delete set null
);
create index if not exists clarity_calls_member_id_idx on clarity_calls(member_id);
alter table clarity_calls enable row level security;
create policy "admins_all_clarity_calls"
  on clarity_calls for all using (is_admin());
create policy "members_read_own_clarity_calls"
  on clarity_calls for select
  using (member_id in (select id from members where email = auth.email()));

-- ============================================
-- Office Hours (GLOBAL weekly recordings — same for every member)
-- ============================================
create table if not exists office_hours (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  video_url    text not null,
  call_date    date,
  notes        text,
  created_at   timestamptz not null default now(),
  created_by   uuid references auth.users(id) on delete set null
);
alter table office_hours enable row level security;
create policy "admins_all_office_hours"
  on office_hours for all using (is_admin());
create policy "authed_read_office_hours"
  on office_hours for select using (auth.uid() is not null);

-- ============================================
-- Member Documents (per-member files: contract, DISC, application, headshot, etc.)
-- ============================================
create table if not exists member_documents (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references members(id) on delete cascade,
  doc_type    text not null default 'other'
              check (doc_type in ('contract','disc','application','headshot','other')),
  title       text not null,
  file_path   text not null,
  file_name   text,
  mime_type   text,
  size_bytes  bigint,
  uploaded_at timestamptz not null default now(),
  uploaded_by uuid references auth.users(id) on delete set null
);
create index if not exists member_documents_member_id_idx on member_documents(member_id);
alter table member_documents enable row level security;
create policy "admins_all_member_documents"
  on member_documents for all using (is_admin());
create policy "members_read_own_member_documents"
  on member_documents for select
  using (member_id in (select id from members where email = auth.email()));

-- PRIVATE bucket (sensitive). Downloads served only via service-role signed URLs
-- from an access-checked API route. Never public.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('member-documents', 'member-documents', false, 26214400,
  array['application/pdf','image/jpeg','image/png','image/webp','image/gif','image/heic',
        'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain','text/csv'])
on conflict (id) do nothing;

-- ============================================
-- My Notes: multiple titled notes per member (member's private workspace)
-- ============================================
create table if not exists member_note_entries (
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid not null references members(id) on delete cascade,
  title      text not null default 'Untitled note',
  content    text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists member_note_entries_member_id_idx on member_note_entries(member_id);
alter table member_note_entries enable row level security;
create policy "members_own_note_entries" on member_note_entries for all
  using ((select email from members where id = member_note_entries.member_id) = (auth.jwt() ->> 'email'))
  with check ((select email from members where id = member_note_entries.member_id) = (auth.jwt() ->> 'email'));
create policy "admins_all_note_entries" on member_note_entries for all using (is_admin());

-- ============================================
-- Applications (GHL application-form answers — landing zone, keyed by email)
-- ============================================
create table if not exists applications (
  email       text primary key,
  data        jsonb not null default '{}'::jsonb,
  raw         jsonb,
  received_at timestamptz not null default now()
);
alter table applications enable row level security;
create policy "admins_all_applications" on applications for all using (is_admin());
-- Blueprint generation reads this by member email and auto-injects financial
-- tasks (homework.rule_key dedupes them on regeneration).

-- ============================================
-- Homework: per-task member notes + AI-suggested follow-up flag
-- (homework base table created via earlier migration, not in this file)
-- ============================================
alter table homework add column if not exists notes text;
alter table homework add column if not exists notes_at timestamptz; -- when the member note was last written
alter table homework add column if not exists auto_suggested boolean not null default false;
-- How each task entered the system (drives the admin label so AI/auto-added tasks
-- are distinguishable from admin-assigned "Homework"):
--   admin | blueprint | financial | ai_followup | followup
alter table homework add column if not exists source text not null default 'admin';
do $$ begin
  alter table homework add constraint homework_source_chk
    check (source in ('admin','blueprint','financial','ai_followup','followup','call'));
exception when duplicate_object then null; end $$;

-- ============================================
-- Payment tracking (ADMIN ONLY — replaces the payments spreadsheet)
-- ============================================
create table if not exists member_billing (
  member_id         uuid primary key references members(id) on delete cascade,
  schedule          text not null default 'monthly' check (schedule in ('monthly','annual')),
  amount            numeric(10,2),
  currency          text not null default 'USD',
  due_day           int check (due_day between 1 and 31),
  term_months       int check (term_months is null or term_months between 1 and 60), -- plan length (# monthly payments); null = legacy 12-mo default
  membership_start  date,
  membership_end    date,
  membership_status text not null default 'active' check (membership_status in ('active','paused','cancelled')),
  notes             text,
  updated_at        timestamptz not null default now(),
  updated_by        uuid references auth.users(id) on delete set null
);
create table if not exists member_payments (
  id           uuid primary key default gen_random_uuid(),
  member_id    uuid not null references members(id) on delete cascade,
  due_date     date,
  period_label text,
  amount_due   numeric(10,2) not null default 0,
  amount_paid  numeric(10,2) not null default 0,
  status       text not null default 'unpaid' check (status in ('unpaid','partial','paid')),
  paid_date    date,
  notes        text,
  created_at   timestamptz not null default now(),
  created_by   uuid references auth.users(id) on delete set null
);
create index if not exists member_payments_member_id_idx on member_payments(member_id);
-- Admin-only: no member policy means members can never read financial data.
alter table member_billing enable row level security;
alter table member_payments enable row level security;
create policy "admins_all_member_billing" on member_billing for all using (is_admin());
create policy "admins_all_member_payments" on member_payments for all using (is_admin());

-- ============================================
-- Storage: blueprints bucket (for uploaded PDF/HTML blueprints)
-- ============================================
-- Public bucket; files are named with unguessable UUIDs (mirrors the public
-- share-by-token model). Uploads happen server-side via the service-role client.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('blueprints', 'blueprints', true, 26214400, array['application/pdf','text/html'])
on conflict (id) do nothing;

-- ============================================
-- Seed: Set your admin accounts
-- ============================================
-- After Gogo and Adriana first log in, run:
-- update profiles set role = 'admin' where id = '<their-user-id>';

-- ── Editable app settings (key/value) ──────────────────────────────────────
-- Lets admins change values like the #teamgogo agent count from the UI without
-- a code change. Read by the chat routes (buildCanonicalFacts).
create table if not exists app_settings (
  key text primary key,
  value text,
  updated_at timestamptz default now()
);
alter table app_settings enable row level security;
create policy "authed read settings" on app_settings
  for select using (auth.uid() is not null);
create policy "admins manage settings" on app_settings
  for all using (is_admin()) with check (is_admin());
insert into app_settings (key, value) values ('teamgogo_agent_count', '1660')
  on conflict (key) do nothing;

-- Per-week Tuesday office-hours status (keyed by that week's Tuesday date).
-- No row = "meeting as usual"; a row marks the week on/off + an optional note.
create table if not exists office_hours_weeks (
  week_of date primary key,
  has_meeting boolean not null default true,
  -- status supersedes has_meeting: 'meeting' (as usual) | 'no_meeting' | 'rescheduled'.
  -- has_meeting kept in sync (true unless 'no_meeting') for any legacy reader.
  status text not null default 'meeting' check (status in ('meeting','no_meeting','rescheduled')),
  rescheduled_date date, -- when status='rescheduled': the moved call's date (that week)
  rescheduled_time text, -- when status='rescheduled': the moved call's time (HH:MM, ET)
  note text,
  updated_by uuid references auth.users,
  updated_at timestamptz default now()
);
alter table office_hours_weeks enable row level security;
create policy "authed read office hours weeks" on office_hours_weeks
  for select using (auth.uid() is not null);
create policy "admins manage office hours weeks" on office_hours_weeks
  for all using (is_admin()) with check (is_admin());
-- Default Zoom join link (editable in admin Settings).
insert into app_settings (key, value)
values ('office_hours_zoom_link', 'https://us02web.zoom.us/j/7344760289?omn=82664283854&jst=2')
on conflict (key) do nothing;

-- ============================================
-- ASK GOGO CHAT (member + staff conversations)
-- ============================================
-- Each session belongs to EITHER a member (member_id, matched by email) OR a
-- staff profile (staff_id) — never both (chat_sessions_owner_chk enforces XOR).
-- Members get the bubble on their portal; staff/Gogo get it in the admin portal.
-- Staff (owner/admin/manager/support/tech) monitor member chats read-only at
-- /admin/chats via the service-role client (no admin RLS policy here by design).
create table if not exists chat_sessions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references members(id) on delete cascade,
  staff_id uuid references profiles(id) on delete cascade,
  title text not null default 'New Chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chat_sessions_owner_chk check ((member_id is not null) <> (staff_id is not null))
);
create index if not exists idx_chat_sessions_member on chat_sessions(member_id, updated_at desc);
create index if not exists idx_chat_sessions_staff on chat_sessions(staff_id, updated_at desc);

create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references chat_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_chat_messages_session on chat_messages(session_id, created_at);

alter table chat_sessions enable row level security;
alter table chat_messages enable row level security;

-- Owners (member or staff) read/write only their own sessions + messages.
create policy "members_own_sessions" on chat_sessions for all
  using (member_id = (select id from members where email = (auth.jwt() ->> 'email')));
create policy "staff_own_sessions" on chat_sessions for all
  using (staff_id = auth.uid()) with check (staff_id = auth.uid());
create policy "members_own_messages" on chat_messages for all
  using (session_id in (select id from chat_sessions
    where member_id = (select id from members where email = (auth.jwt() ->> 'email'))));
create policy "staff_own_messages" on chat_messages for all
  using (session_id in (select id from chat_sessions where staff_id = auth.uid()))
  with check (session_id in (select id from chat_sessions where staff_id = auth.uid()));

-- ============================================
-- MONTHLY PROGRESS SURVEYS ("Circle Progress Check")
-- ============================================
-- Sent on the first Monday of each month (cron /api/cron/surveys) and enforced
-- as a blocking popup in the member portal until completed. Questions are fixed
-- in code (src/lib/survey-questions.ts). One survey_periods row per month gives
-- send/reminder idempotency; one survey_responses row per member per month holds
-- the answers (draft -> complete). Admin view: /admin/progress.
create table if not exists survey_periods (
  id             uuid primary key default gen_random_uuid(),
  period_month   date not null unique,              -- always the 1st of the month
  opened_on      date not null,                     -- the first Monday (send date)
  week_end       date not null,                     -- Sunday that ends the send week
  sent_at        timestamptz,                       -- set when the send email went out
  reminded_on    date[] not null default '{}',      -- reminder dates already sent
  created_at     timestamptz not null default now()
);

create table if not exists survey_responses (
  id             uuid primary key default gen_random_uuid(),
  member_id      uuid not null references members(id) on delete cascade,
  period_month   date not null,                     -- 1st of the month (matches survey_periods)
  answers        jsonb not null default '{}'::jsonb,
  status         text not null default 'draft' check (status in ('draft','complete')),
  started_at     timestamptz not null default now(),
  completed_at   timestamptz,
  updated_at     timestamptz not null default now(),
  unique (member_id, period_month)
);
create index if not exists survey_responses_member_id_idx on survey_responses(member_id);
create index if not exists survey_responses_period_idx on survey_responses(period_month);

alter table survey_periods enable row level security;
alter table survey_responses enable row level security;

-- Periods: any authenticated user may read (portal checks if a window is open);
-- only staff / the service-role cron may write.
create policy "authed_read_periods" on survey_periods for select using (auth.role() = 'authenticated');
create policy "admins_write_periods" on survey_periods for all using (is_admin()) with check (is_admin());

-- Responses: members read/write only their own (by email); admins manage all.
create policy "members_own_survey_responses" on survey_responses for all
  using ((select email from members where id = survey_responses.member_id) = (auth.jwt() ->> 'email'))
  with check ((select email from members where id = survey_responses.member_id) = (auth.jwt() ->> 'email'));
create policy "admins_all_survey_responses" on survey_responses for all using (is_admin());

-- ---------------------------------------------------------------------------
-- Content Machine (migration content_posts): AI-generated, Brain-grounded social
-- posts from member activity. Admin-only (/admin/content). Definitions & prompt
-- live in code (src/lib/content/*). Visuals render via next/og at
-- /api/content/[id]/image. Question set + highlight engine feed the signals.
create table if not exists content_posts (
  id              uuid primary key default gen_random_uuid(),
  source_type     text not null check (source_type in ('member_win','community','takeaway','educational')),
  member_id       uuid references members(id) on delete set null,   -- null for community/aggregate
  signal          jsonb not null default '{}'::jsonb,                -- raw trigger data (metrics, deltas)
  trigger_summary text not null default '',                          -- e.g. "Sean · income +45% in Sep"
  dedupe_key      text,                                              -- prevents regenerating the same signal
  format          text not null default 'carousel' check (format in ('single','carousel')),
  platform        text not null default 'both' check (platform in ('instagram','facebook','both')),
  caption         text not null default '',
  hashtags        text not null default '',
  slides          jsonb not null default '[]'::jsonb,                -- [{ headline, body, imageDirection }]
  art_direction   text not null default '',
  status          text not null default 'draft' check (status in ('draft','approved','rejected','posted')),
  edited          boolean not null default false,
  approved_by     uuid references profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  posted_at       timestamptz
);
create index if not exists content_posts_status_idx on content_posts(status);
create index if not exists content_posts_created_idx on content_posts(created_at desc);
-- Plain (non-partial) unique index so upsert ON CONFLICT (dedupe_key) works;
-- NULLs stay distinct, so aggregate rows without a dedupe_key are unaffected.
create unique index if not exists content_posts_dedupe_key_uk on content_posts(dedupe_key);
alter table content_posts enable row level security;
create policy "admins_manage_content" on content_posts for all using (is_admin()) with check (is_admin());

-- ============================================
-- Achievements / milestone celebrations
-- ============================================
-- Detection (deterministic rules + an AI catch-all pass) awards rows via the
-- service-role client from the daily cron (/api/cron/achievements) and an
-- after() hook on homework completion. `unique(member_id, achievement_key)`
-- guarantees each milestone fires exactly once. Members read their own to pop
-- the confetti gate (AchievementGate); the API stamps seen_at/dismissed_at.
-- `tier` gates emails (only 'milestone' sends). badge_key/metadata are stored
-- now so the badge-collection UI drops in later without a migration.
create table if not exists achievements (
  id              uuid primary key default gen_random_uuid(),
  member_id       uuid not null references members(id) on delete cascade,
  achievement_key text not null,
  title           text not null,
  body            text not null default '',
  emoji           text not null default '🎉',
  tier            text not null default 'small' check (tier in ('small','milestone')),
  source          text not null default 'rule' check (source in ('rule','ai')),
  badge_key       text,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  seen_at         timestamptz,
  dismissed_at    timestamptz,
  emailed_at      timestamptz,
  unique (member_id, achievement_key)
);
create index if not exists achievements_member_idx on achievements(member_id, created_at desc);
create index if not exists achievements_unseen_idx on achievements(member_id) where seen_at is null;
alter table achievements enable row level security;
create policy "admins_manage_achievements" on achievements
  for all using (is_admin()) with check (is_admin());
create policy "members_read_own_achievements" on achievements
  for select using (member_id in (select id from members where email = auth.email()));
