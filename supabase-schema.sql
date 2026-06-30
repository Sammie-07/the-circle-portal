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
alter table homework add column if not exists auto_suggested boolean not null default false;
-- How each task entered the system (drives the admin label so AI/auto-added tasks
-- are distinguishable from admin-assigned "Homework"):
--   admin | blueprint | financial | ai_followup | followup
alter table homework add column if not exists source text not null default 'admin';
do $$ begin
  alter table homework add constraint homework_source_chk
    check (source in ('admin','blueprint','financial','ai_followup','followup'));
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
