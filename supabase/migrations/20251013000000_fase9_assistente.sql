-- Sorria FASE 9 — Secretária Virtual
-- IA → tools → services → RLS. Sem SQL arbitrário. Sem IA clínica.

insert into public.permissions (key, label, description, category) values
  ('assistant.use', 'Usar Secretária Virtual', 'Assistente administrativa permissionada', 'assistant')
on conflict (key) do nothing;

select public.grant_permissions('owner', array['assistant.use']);
select public.grant_permissions('dentist', array['assistant.use']);
select public.grant_permissions('secretary', array['assistant.use']);

do $$ begin
  if not exists (select 1 from pg_type where typname = 'assistant_action_status') then
    create type public.assistant_action_status as enum (
      'pending_confirmation', 'confirmed', 'executed', 'cancelled', 'expired', 'failed'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'assistant_message_role') then
    create type public.assistant_message_role as enum ('user', 'assistant', 'system');
  end if;
end $$;

create table if not exists public.assistant_threads (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text,
  context_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists assistant_threads_user_idx
  on public.assistant_threads (clinic_id, user_id, updated_at desc);

create table if not exists public.assistant_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.assistant_threads (id) on delete cascade,
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.assistant_message_role not null,
  content text not null,
  meta_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists assistant_messages_thread_idx
  on public.assistant_messages (thread_id, created_at);

create table if not exists public.assistant_action_plans (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  thread_id uuid references public.assistant_threads (id) on delete set null,
  action_type text not null,
  payload_json jsonb not null,
  preview_json jsonb not null default '{}'::jsonb,
  status public.assistant_action_status not null default 'pending_confirmation',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  confirmed_at timestamptz,
  executed_at timestamptz,
  error_message text
);

create index if not exists assistant_action_plans_user_idx
  on public.assistant_action_plans (clinic_id, user_id, status, expires_at);

alter table public.assistant_threads enable row level security;
alter table public.assistant_messages enable row level security;
alter table public.assistant_action_plans enable row level security;

create policy assistant_threads_own on public.assistant_threads
  for all to authenticated
  using (
    user_id = auth.uid()
    and public.has_permission(clinic_id, 'assistant.use')
  )
  with check (
    user_id = auth.uid()
    and public.has_permission(clinic_id, 'assistant.use')
  );

create policy assistant_messages_own on public.assistant_messages
  for all to authenticated
  using (
    user_id = auth.uid()
    and public.has_permission(clinic_id, 'assistant.use')
  )
  with check (
    user_id = auth.uid()
    and public.has_permission(clinic_id, 'assistant.use')
  );

create policy assistant_actions_own on public.assistant_action_plans
  for all to authenticated
  using (
    user_id = auth.uid()
    and public.has_permission(clinic_id, 'assistant.use')
  )
  with check (
    user_id = auth.uid()
    and public.has_permission(clinic_id, 'assistant.use')
  );

comment on table public.assistant_threads is
  'Threads da Secretária Virtual — tenant + dono. Sem acesso cross-clinic.';
comment on table public.assistant_action_plans is
  'Prévia de ações mutáveis; TTL + revalidação obrigatória na execução.';
