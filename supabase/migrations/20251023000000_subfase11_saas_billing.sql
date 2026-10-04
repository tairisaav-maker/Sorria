-- Sorria — Subfase 11
-- Planos, entitlements, assinaturas SaaS e billing events.
-- Billing SaaS ≠ financeiro do consultório.
-- PLAN ≠ SUBSCRIPTION ≠ PAYMENT ≠ PERMISSION

-- Planos comerciais (seed configurável — preços NÃO são tabela comercial final)
create table if not exists public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  billing_interval text not null check (billing_interval in ('month', 'year')),
  price_amount_cents integer not null check (price_amount_cents >= 0),
  currency text not null default 'BRL',
  active boolean not null default true,
  trial_days integer check (trial_days is null or trial_days >= 0),
  max_professionals integer check (max_professionals is null or max_professionals > 0),
  max_staff_users integer check (max_staff_users is null or max_staff_users > 0),
  storage_limit_bytes bigint check (storage_limit_bytes is null or storage_limit_bytes > 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.plan_entitlements (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.subscription_plans (id) on delete cascade,
  entitlement_key text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (plan_id, entitlement_key)
);

create index if not exists plan_entitlements_key_idx
  on public.plan_entitlements (entitlement_key);

create table if not exists public.clinic_subscriptions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  plan_id uuid not null references public.subscription_plans (id),
  status text not null check (
    status in ('trialing', 'active', 'past_due', 'cancelled', 'expired')
  ),
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  billing_provider text,
  provider_customer_id text,
  provider_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists clinic_subscriptions_one_open_idx
  on public.clinic_subscriptions (clinic_id)
  where status in ('trialing', 'active', 'past_due');

create index if not exists clinic_subscriptions_clinic_idx
  on public.clinic_subscriptions (clinic_id, status);

create table if not exists public.billing_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  clinic_id uuid references public.clinics (id) on delete set null,
  payload_digest text,
  processed_at timestamptz,
  status text not null check (status in ('received', 'processed', 'ignored', 'failed')),
  error_message text,
  created_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

create table if not exists public.clinic_invitations (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  email text not null,
  role_key text not null,
  token_hash text not null,
  invited_by uuid references auth.users (id),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists clinic_invitations_clinic_idx
  on public.clinic_invitations (clinic_id, email);

-- RLS: planos públicos de leitura para autenticados; escrita só service role
alter table public.subscription_plans enable row level security;
alter table public.plan_entitlements enable row level security;
alter table public.clinic_subscriptions enable row level security;
alter table public.billing_events enable row level security;
alter table public.clinic_invitations enable row level security;

create policy subscription_plans_select_authenticated
  on public.subscription_plans for select
  to authenticated
  using (active = true);

create policy plan_entitlements_select_authenticated
  on public.plan_entitlements for select
  to authenticated
  using (
    exists (
      select 1 from public.subscription_plans p
      where p.id = plan_id and p.active = true
    )
  );

create policy clinic_subscriptions_select_member
  on public.clinic_subscriptions for select
  to authenticated
  using (public.is_clinic_member(clinic_id));

create policy clinic_invitations_select_member
  on public.clinic_invitations for select
  to authenticated
  using (public.is_clinic_member(clinic_id));

-- billing_events: sem política de select para authenticated (somente service role)

-- Seed placeholder (preços internos — REVISÃO DE PRODUTO NECESSÁRIA)
insert into public.subscription_plans (
  id, code, name, description, billing_interval, price_amount_cents, currency,
  active, trial_days, max_professionals, max_staff_users, storage_limit_bytes, sort_order
) values
  (
    '11111111-1111-1111-1111-111111111001',
    'starter',
    'Starter',
    'Núcleo operacional do consultório (placeholder interno)',
    'month',
    0,
    'BRL',
    true,
    14,
    2,
    3,
    1073741824,
    1
  ),
  (
    '11111111-1111-1111-1111-111111111002',
    'pro',
    'Pro',
    'Relatórios avançados, reposição e precificação (placeholder interno)',
    'month',
    0,
    'BRL',
    true,
    14,
    5,
    10,
    5368709120,
    2
  )
on conflict (code) do nothing;

insert into public.plan_entitlements (plan_id, entitlement_key, enabled)
select p.id, e.key, true
from public.subscription_plans p
cross join (
  values
    ('inventory'),
    ('procedure_costing'),
    ('exports')
) as e(key)
where p.code = 'starter'
on conflict (plan_id, entitlement_key) do nothing;

insert into public.plan_entitlements (plan_id, entitlement_key, enabled)
select p.id, e.key, true
from public.subscription_plans p
cross join (
  values
    ('inventory'),
    ('procedure_costing'),
    ('operational_costing'),
    ('advanced_reports'),
    ('exports'),
    ('replenishment'),
    ('pricing_analysis')
) as e(key)
where p.code = 'pro'
on conflict (plan_id, entitlement_key) do nothing;
