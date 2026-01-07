-- 初期スキーマ（保護者・児童・出欠・メッセージ）
create extension if not exists "pgcrypto";

create type public.attendance_status as enum ('present', 'absent', 'late', 'unknown');
create type public.message_direction as enum ('inbound', 'outbound');

create table public.guardians (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  line_user_id text unique,
  login_token text unique,
  created_at timestamptz not null default now()
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  grade text,
  notes text,
  created_at timestamptz not null default now()
);

create table public.guardian_students (
  guardian_id uuid references public.guardians (id) on delete cascade,
  student_id uuid references public.students (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (guardian_id, student_id)
);

create index idx_guardian_students_student_id on public.guardian_students (student_id);

create table public.attendance_requests (
  id uuid primary key default gen_random_uuid(),
  guardian_id uuid not null references public.guardians (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  requested_for date not null,
  status public.attendance_status not null default 'unknown',
  reason text,
  created_at timestamptz not null default now(),
  unique (student_id, requested_for)
);

create index idx_attendance_requests_requested_for on public.attendance_requests (requested_for);
create index idx_attendance_requests_guardian_id on public.attendance_requests (guardian_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  guardian_id uuid not null references public.guardians (id) on delete cascade,
  student_id uuid references public.students (id) on delete set null,
  direction public.message_direction not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index idx_messages_guardian_created_at on public.messages (guardian_id, created_at desc);
create index idx_messages_student_created_at on public.messages (student_id, created_at desc);

create view public.attendance_daily_stats as
select
  ar.requested_for,
  ar.student_id,
  count(*) filter (where ar.status = 'present') as present_count,
  count(*) filter (where ar.status = 'absent') as absent_count,
  count(*) filter (where ar.status = 'late') as late_count,
  count(*) as total_count
from public.attendance_requests ar
group by ar.requested_for, ar.student_id;

create view public.attendance_overall_stats as
select
  count(*) filter (where status = 'present') as present_count,
  count(*) filter (where status = 'absent') as absent_count,
  count(*) filter (where status = 'late') as late_count,
  count(*) as total_count
from public.attendance_requests;
