-- Sorria FASE 5 — Planos de tratamento
-- Plano ≠ Pagamento · Odontograma ≠ Orçamento · Aceite ≠ Receita
-- Valores: numeric(12,2) — nunca float

-- Novas permissões
insert into public.permissions (key, name, description, category)
values
  ('treatments.present', 'Apresentar plano', 'Marcar plano como apresentado ao paciente', 'treatments'),
  ('treatments.acceptance_manage', 'Gerenciar aceite', 'Registrar aceite ou recusa do plano', 'treatments'),
  ('treatments.progress_update', 'Atualizar progresso', 'Iniciar/concluir itens do plano', 'treatments')
on conflict (key) do update
  set name = excluded.name,
      description = excluded.description;

select public.grant_permissions('dentist', array[
  'treatments.view','treatments.create','treatments.update',
  'treatments.present','treatments.acceptance_manage','treatments.progress_update'
]);

select public.grant_permissions('secretary', array[
  'treatments.administrative_view',
  'treatments.present','treatments.acceptance_manage'
]);

-- Owner: apenas administrativo (sem clínico de tratamento por padrão)
select public.grant_permissions('owner', array[
  'treatments.administrative_view',
  'treatments.present','treatments.acceptance_manage'
]);

-- Owner com clinical_access: incluir permissões clínicas de tratamento no helper
create or replace function public.has_clinical_permission(p_clinic_id uuid, p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.clinic_members m
    join public.roles r on r.id = m.role_id
    where m.user_id = auth.uid()
      and m.clinic_id = p_clinic_id
      and m.status = 'active'
      and (
        (r.key = 'dentist' and public.has_clinic_permission(p_clinic_id, p_permission))
        or (
          r.key = 'owner'
          and m.clinical_access = true
          and p_permission = any (array[
            'clinical_record.view','clinical_record.create','clinical_record.update',
            'anamnesis.view','anamnesis.create','anamnesis.update',
            'clinical_evolution.view','clinical_evolution.create','clinical_evolution.update',
            'odontogram.view','odontogram.update',
            'clinical_files.view','clinical_files.upload',
            'treatments.view','treatments.create','treatments.update',
            'treatments.present','treatments.acceptance_manage','treatments.progress_update'
          ])
        )
        or (r.key = 'owner' and public.has_clinic_permission(p_clinic_id, p_permission))
      )
  );
$$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'treatment_plan_status') then
    create type public.treatment_plan_status as enum (
      'draft','presented','accepted','in_progress','completed','rejected'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'treatment_item_status') then
    create type public.treatment_item_status as enum (
      'planned','accepted','in_progress','completed','cancelled'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'discount_type') then
    create type public.discount_type as enum ('percent','fixed');
  end if;
end $$;

create table if not exists public.treatment_plans (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  patient_id uuid not null references public.patients (id) on delete restrict,

  title text not null,
  description text,
  notes text, -- interno; não expor ao paciente

  status public.treatment_plan_status not null default 'draft',
  version_number integer not null default 1,

  subtotal_amount numeric(12, 2) not null default 0,
  discount_type public.discount_type,
  discount_value numeric(12, 2),
  total_amount numeric(12, 2) not null default 0,

  valid_until date,

  created_by uuid references public.profiles (id) on delete set null,
  presented_by uuid references public.profiles (id) on delete set null,
  presented_at timestamptz,
  accepted_at timestamptz,
  accepted_version integer,
  rejected_at timestamptz,
  rejection_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,

  constraint treatment_plans_amounts_nonneg check (
    subtotal_amount >= 0 and total_amount >= 0
    and (discount_value is null or discount_value >= 0)
  )
);

create index if not exists treatment_plans_clinic_patient_idx
  on public.treatment_plans (clinic_id, patient_id, created_at desc);
create index if not exists treatment_plans_clinic_status_idx
  on public.treatment_plans (clinic_id, status);

drop trigger if exists treatment_plans_set_updated_at on public.treatment_plans;
create trigger treatment_plans_set_updated_at
  before update on public.treatment_plans
  for each row execute function public.set_updated_at();

create table if not exists public.treatment_items (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  treatment_plan_id uuid not null references public.treatment_plans (id) on delete cascade,
  patient_id uuid not null references public.patients (id) on delete restrict,

  procedure_name text not null,
  description text,

  quantity integer not null default 1 check (quantity > 0),
  unit_price numeric(12, 2) not null default 0 check (unit_price >= 0),
  total_price numeric(12, 2) not null default 0 check (total_price >= 0),

  status public.treatment_item_status not null default 'planned',
  sort_order integer not null default 0,

  source_odontogram_entry_id uuid references public.odontogram_entries (id) on delete set null,
  source_clinical_entry_id uuid references public.clinical_entries (id) on delete set null,

  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists treatment_items_plan_idx
  on public.treatment_items (treatment_plan_id, sort_order);
create index if not exists treatment_items_patient_idx
  on public.treatment_items (clinic_id, patient_id);

drop trigger if exists treatment_items_set_updated_at on public.treatment_items;
create trigger treatment_items_set_updated_at
  before update on public.treatment_items
  for each row execute function public.set_updated_at();

create table if not exists public.treatment_item_teeth (
  treatment_item_id uuid not null references public.treatment_items (id) on delete cascade,
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  tooth_number integer not null check (tooth_number between 11 and 48),
  primary key (treatment_item_id, tooth_number)
);

create table if not exists public.treatment_plan_versions (
  id uuid primary key default gen_random_uuid(),
  treatment_plan_id uuid not null references public.treatment_plans (id) on delete cascade,
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  version_number integer not null,
  snapshot_json jsonb not null,
  presented_by uuid references public.profiles (id) on delete set null,
  presented_at timestamptz,
  change_reason text,
  created_at timestamptz not null default now(),
  unique (treatment_plan_id, version_number)
);

-- RLS
alter table public.treatment_plans enable row level security;
alter table public.treatment_items enable row level security;
alter table public.treatment_item_teeth enable row level security;
alter table public.treatment_plan_versions enable row level security;

create or replace function public.can_view_treatment(p_clinic_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_clinic_permission(p_clinic_id, 'treatments.view')
      or public.has_clinic_permission(p_clinic_id, 'treatments.administrative_view')
      or public.has_clinical_permission(p_clinic_id, 'treatments.view');
$$;

drop policy if exists treatment_plans_select on public.treatment_plans;
create policy treatment_plans_select on public.treatment_plans for select to authenticated
  using (public.can_view_treatment(clinic_id));

drop policy if exists treatment_plans_insert on public.treatment_plans;
create policy treatment_plans_insert on public.treatment_plans for insert to authenticated
  with check (
    public.has_clinic_permission(clinic_id, 'treatments.create')
    or public.has_clinical_permission(clinic_id, 'treatments.create')
  );

drop policy if exists treatment_plans_update on public.treatment_plans;
create policy treatment_plans_update on public.treatment_plans for update to authenticated
  using (
    public.has_clinic_permission(clinic_id, 'treatments.update')
    or public.has_clinic_permission(clinic_id, 'treatments.present')
    or public.has_clinic_permission(clinic_id, 'treatments.acceptance_manage')
    or public.has_clinic_permission(clinic_id, 'treatments.progress_update')
    or public.has_clinical_permission(clinic_id, 'treatments.update')
  )
  with check (
    public.has_clinic_permission(clinic_id, 'treatments.update')
    or public.has_clinic_permission(clinic_id, 'treatments.present')
    or public.has_clinic_permission(clinic_id, 'treatments.acceptance_manage')
    or public.has_clinic_permission(clinic_id, 'treatments.progress_update')
    or public.has_clinical_permission(clinic_id, 'treatments.update')
  );

drop policy if exists treatment_plans_delete on public.treatment_plans;
create policy treatment_plans_delete on public.treatment_plans for delete to authenticated
  using (false);

drop policy if exists treatment_items_select on public.treatment_items;
create policy treatment_items_select on public.treatment_items for select to authenticated
  using (public.can_view_treatment(clinic_id));

drop policy if exists treatment_items_write on public.treatment_items;
create policy treatment_items_write on public.treatment_items for all to authenticated
  using (
    public.has_clinic_permission(clinic_id, 'treatments.update')
    or public.has_clinic_permission(clinic_id, 'treatments.progress_update')
    or public.has_clinical_permission(clinic_id, 'treatments.update')
  )
  with check (
    public.has_clinic_permission(clinic_id, 'treatments.create')
    or public.has_clinic_permission(clinic_id, 'treatments.update')
    or public.has_clinical_permission(clinic_id, 'treatments.create')
  );

drop policy if exists treatment_item_teeth_all on public.treatment_item_teeth;
create policy treatment_item_teeth_all on public.treatment_item_teeth for all to authenticated
  using (public.can_view_treatment(clinic_id))
  with check (public.can_view_treatment(clinic_id));

drop policy if exists treatment_plan_versions_select on public.treatment_plan_versions;
create policy treatment_plan_versions_select on public.treatment_plan_versions for select to authenticated
  using (public.can_view_treatment(clinic_id));

drop policy if exists treatment_plan_versions_insert on public.treatment_plan_versions;
create policy treatment_plan_versions_insert on public.treatment_plan_versions for insert to authenticated
  with check (
    public.has_clinic_permission(clinic_id, 'treatments.present')
    or public.has_clinic_permission(clinic_id, 'treatments.update')
    or public.has_clinical_permission(clinic_id, 'treatments.update')
  );

drop policy if exists treatment_plan_versions_mutate on public.treatment_plan_versions;
create policy treatment_plan_versions_mutate on public.treatment_plan_versions for update to authenticated
  using (false);
