create table public.line_flow_sessions (
  line_user_id text primary key,
  guardian_id uuid references public.guardians (id) on delete set null,
  flow text not null,
  step text not null,
  data jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null default (now() + interval '2 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_line_flow_sessions_expires_at on public.line_flow_sessions (expires_at);
create index idx_line_flow_sessions_guardian_id on public.line_flow_sessions (guardian_id);
