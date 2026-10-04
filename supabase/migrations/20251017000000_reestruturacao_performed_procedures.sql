-- Sorria — Reestruturação Subfase 3
-- Procedimento do paciente, consumo previsto×real, baixa e custo individual.
-- Sem previsão completa de agenda / reserva automática.

insert into public.permissions (key, name, description, category) values
  ('performed_procedures.view', 'Ver procedimentos realizados', 'Histórico por paciente', 'procedures'),
  ('performed_procedures.create', 'Criar procedimento realizado', 'Adicionar ao atendimento', 'procedures'),
  ('performed_procedures.update', 'Editar procedimento realizado', 'Atualizar dados/consumo', 'procedures'),
  ('performed_procedures.complete', 'Concluir procedimento realizado', 'Finalizar execução', 'procedures'),
  ('procedure_consumption.update', 'Editar consumo', 'Ajustar quantidades reais', 'procedures'),
  ('procedure_consumption.correct', 'Corrigir consumo confirmado', 'Reversão/correção com histórico', 'procedures')
on conflict (key) do nothing;

-- procedure_consumption.view / confirm e procedure_costs.view já existem (Subfase 1)

select public.grant_permissions('owner', array[
  'performed_procedures.view','performed_procedures.create','performed_procedures.update','performed_procedures.complete',
  'procedure_consumption.view','procedure_consumption.update','procedure_consumption.confirm','procedure_consumption.correct',
  'procedure_costs.view'
]);
select public.grant_permissions('dentist', array[
  'performed_procedures.view','performed_procedures.create','performed_procedures.update','performed_procedures.complete',
  'procedure_consumption.view','procedure_consumption.update','procedure_consumption.confirm','procedure_consumption.correct',
  'procedure_costs.view'
]);
select public.grant_permissions('secretary', array[
  'performed_procedures.view'
]);

do $$ begin
  if not exists (select 1 from pg_type where typname = 'performed_procedure_status') then
    create type public.performed_procedure_status as enum (
      'planned','in_progress','completed','cancelled'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'consumption_status') then
    create type public.consumption_status as enum (
      'planned','confirmed','corrected'
    );
  end if;
end $$;

create table if not exists public.performed_procedures (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  patient_id uuid not null references public.patients (id),
  appointment_id uuid references public.appointments (id),
  procedure_id uuid not null references public.procedures (id),
  procedure_name_snapshot text not null,
  treatment_item_id uuid,
  professional_id uuid not null references auth.users (id),
  tooth_number integer,
  region text,
  quantity numeric(10,2) not null default 1 check (quantity > 0),
  status public.performed_procedure_status not null default 'planned',
  standard_price_snapshot numeric(12,2),
  charged_amount numeric(12,2),
  charged_zero_reason text,
  planned_material_cost numeric(12,2) not null default 0,
  actual_material_cost numeric(12,2),
  planned_shared_cost numeric(12,2) not null default 0,
  actual_shared_cost numeric(12,2),
  planned_direct_cost numeric(12,2) not null default 0,
  actual_direct_cost numeric(12,2),
  planned_total_cost numeric(12,2) not null default 0,
  actual_total_cost numeric(12,2),
  gross_result numeric(12,2),
  gross_margin_percent numeric(8,2),
  consumption_confirmed boolean not null default false,
  consumption_confirmed_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  clinical_entry_id uuid,
  financial_transaction_id uuid,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists performed_procedures_patient_idx
  on public.performed_procedures (clinic_id, patient_id, created_at desc);
create index if not exists performed_procedures_appt_idx
  on public.performed_procedures (appointment_id);

create table if not exists public.procedure_consumptions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  performed_procedure_id uuid not null references public.performed_procedures (id) on delete cascade,
  patient_id uuid not null references public.patients (id),
  appointment_id uuid,
  inventory_item_id uuid not null references public.inventory_items (id),
  item_name_snapshot text not null,
  actual_inventory_item_id uuid references public.inventory_items (id),
  actual_item_name_snapshot text,
  consumption_mode public.consumption_mode not null,
  planned_quantity numeric(14,4) not null check (planned_quantity >= 0),
  actual_quantity numeric(14,4),
  consumption_unit public.inventory_unit not null,
  unit_cost_snapshot numeric(12,4) not null default 0,
  planned_cost numeric(12,2) not null default 0,
  actual_cost numeric(12,2),
  is_extra boolean not null default false,
  status public.consumption_status not null default 'planned',
  confirmed_by uuid references auth.users (id),
  confirmed_at timestamptz,
  inventory_movement_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists procedure_consumptions_pp_idx
  on public.procedure_consumptions (performed_procedure_id);
create index if not exists procedure_consumptions_patient_idx
  on public.procedure_consumptions (clinic_id, patient_id);

create table if not exists public.appointment_consumptions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  patient_id uuid not null references public.patients (id),
  inventory_item_id uuid not null references public.inventory_items (id),
  item_name_snapshot text not null,
  actual_inventory_item_id uuid references public.inventory_items (id),
  actual_item_name_snapshot text,
  planned_quantity numeric(14,4) not null check (planned_quantity >= 0),
  actual_quantity numeric(14,4),
  consumption_unit public.inventory_unit not null,
  unit_cost_snapshot numeric(12,4) not null default 0,
  planned_cost numeric(12,2) not null default 0,
  actual_cost numeric(12,2),
  status public.consumption_status not null default 'planned',
  confirmed_by uuid references auth.users (id),
  confirmed_at timestamptz,
  inventory_movement_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (appointment_id, inventory_item_id)
);

create index if not exists appointment_consumptions_appt_idx
  on public.appointment_consumptions (appointment_id);

-- Tenant guards
create or replace function public.enforce_performed_procedure_tenant()
returns trigger language plpgsql as $$
declare
  patient_clinic uuid;
  proc_clinic uuid;
  appt_patient uuid;
  appt_clinic uuid;
begin
  select clinic_id into patient_clinic from public.patients where id = new.patient_id;
  select clinic_id into proc_clinic from public.procedures where id = new.procedure_id;
  if patient_clinic is null or proc_clinic is null
     or patient_clinic <> new.clinic_id or proc_clinic <> new.clinic_id then
    raise exception 'CROSS_CLINIC_REFERENCE';
  end if;
  if new.appointment_id is not null then
    select clinic_id, patient_id into appt_clinic, appt_patient
      from public.appointments where id = new.appointment_id;
    if appt_clinic is null or appt_clinic <> new.clinic_id or appt_patient <> new.patient_id then
      raise exception 'CROSS_CLINIC_REFERENCE';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists performed_procedures_tenant_trg on public.performed_procedures;
create trigger performed_procedures_tenant_trg
  before insert or update on public.performed_procedures
  for each row execute function public.enforce_performed_procedure_tenant();

create or replace function public.enforce_procedure_consumption_tenant()
returns trigger language plpgsql as $$
declare
  pp_clinic uuid;
  item_clinic uuid;
begin
  select clinic_id into pp_clinic from public.performed_procedures where id = new.performed_procedure_id;
  select clinic_id into item_clinic from public.inventory_items where id = new.inventory_item_id;
  if pp_clinic is null or item_clinic is null
     or pp_clinic <> new.clinic_id or item_clinic <> new.clinic_id then
    raise exception 'CROSS_CLINIC_REFERENCE';
  end if;
  if new.actual_inventory_item_id is not null then
    select clinic_id into item_clinic from public.inventory_items where id = new.actual_inventory_item_id;
    if item_clinic is null or item_clinic <> new.clinic_id then
      raise exception 'CROSS_CLINIC_REFERENCE';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists procedure_consumptions_tenant_trg on public.procedure_consumptions;
create trigger procedure_consumptions_tenant_trg
  before insert or update on public.procedure_consumptions
  for each row execute function public.enforce_procedure_consumption_tenant();

alter table public.performed_procedures enable row level security;
alter table public.procedure_consumptions enable row level security;
alter table public.appointment_consumptions enable row level security;

create policy performed_procedures_select on public.performed_procedures for select to authenticated
  using (public.has_permission(clinic_id, 'performed_procedures.view'));
create policy performed_procedures_insert on public.performed_procedures for insert to authenticated
  with check (public.has_permission(clinic_id, 'performed_procedures.create'));
create policy performed_procedures_update on public.performed_procedures for update to authenticated
  using (
    public.has_permission(clinic_id, 'performed_procedures.update')
    or public.has_permission(clinic_id, 'performed_procedures.complete')
  )
  with check (
    public.has_permission(clinic_id, 'performed_procedures.update')
    or public.has_permission(clinic_id, 'performed_procedures.complete')
  );

create policy procedure_consumptions_select on public.procedure_consumptions for select to authenticated
  using (public.has_permission(clinic_id, 'procedure_consumption.view'));
create policy procedure_consumptions_write on public.procedure_consumptions for all to authenticated
  using (
    public.has_permission(clinic_id, 'procedure_consumption.update')
    or public.has_permission(clinic_id, 'procedure_consumption.confirm')
    or public.has_permission(clinic_id, 'procedure_consumption.correct')
  )
  with check (
    public.has_permission(clinic_id, 'procedure_consumption.update')
    or public.has_permission(clinic_id, 'procedure_consumption.confirm')
    or public.has_permission(clinic_id, 'procedure_consumption.correct')
  );

create policy appointment_consumptions_select on public.appointment_consumptions for select to authenticated
  using (public.has_permission(clinic_id, 'procedure_consumption.view'));
create policy appointment_consumptions_write on public.appointment_consumptions for all to authenticated
  using (
    public.has_permission(clinic_id, 'procedure_consumption.update')
    or public.has_permission(clinic_id, 'procedure_consumption.confirm')
  )
  with check (
    public.has_permission(clinic_id, 'procedure_consumption.update')
    or public.has_permission(clinic_id, 'procedure_consumption.confirm')
  );

-- Optional link from clinical entries
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'clinical_entries'
      and column_name = 'performed_procedure_id'
  ) then
    alter table public.clinical_entries
      add column performed_procedure_id uuid references public.performed_procedures (id);
  end if;
end $$;

comment on table public.performed_procedures is
  'Instância de procedimento em paciente específico — distinto do catálogo procedures.';
comment on table public.procedure_consumptions is
  'Snapshot de consumo exclusivo do performed_procedure. Baixa só após confirmação.';
comment on table public.appointment_consumptions is
  'Materiais per_appointment: uma baixa física; custo rateado entre procedimentos.';
