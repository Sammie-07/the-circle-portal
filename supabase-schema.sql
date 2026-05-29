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
  created_at timestamptz default now()
);

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
create or replace function is_admin()
returns boolean as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
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
-- Seed: Set your admin accounts
-- ============================================
-- After Gogo and Adriana first log in, run:
-- update profiles set role = 'admin' where id = '<their-user-id>';
