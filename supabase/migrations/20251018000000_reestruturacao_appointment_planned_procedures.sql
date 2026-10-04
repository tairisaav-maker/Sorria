-- Sorria — Reestruturação Subfase 4
-- Procedimentos previstos na Agenda + previsão de materiais (sem reserva/baixa).

insert into public.permissions (key, name, description, category) values
  ('appointment_planned_procedures.view', 'Ver procedimentos previstos', 'Procedimentos planejados na Agenda', 'agenda'),
  ('appointment_planned_procedures.create', 'Criar procedimento previsto', 'Adicionar procedimento à consulta', 'agenda'),
  ('appointment_planned_procedures.update', 'Editar procedimento previsto', 'Atualizar/remover procedimento planejado', 'agenda'),
  ('inventory.forecast_view', 'Ver previsão de materiais', 'Necessidade vs estoque pela Agenda', 'inventory'),
  ('inventory.forecast_cost_view', 'Ver custo estimado da previsão', 'Custos projetados de materiais', 'inventory')
on conflict (key) do nothing;

select public.grant_permissions('owner', array[
  'appointment_planned_procedures.view','appointment_planned_procedures.create','appointment_planned_procedures.update',
  'inventory.forecast_view','inventory.forecast_cost_view'
]);
select public.grant_permissions('dentist', array[
  'appointment_planned_procedures.view','appointment_planned_procedures.create','appointment_planned_procedures.update',
  'inventory.forecast_view','inventory.forecast_cost_view'
]);
select public.grant_permissions('secretary', array[
  'appointment_planned_procedures.view','appointment_planned_procedures.create','appointment_planned_procedures.update',
  'inventory.forecast_view'
]);

create table if not exists public.appointment_planned_procedures (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  patient_id uuid not null references public.patients (id),
  procedure_id uuid not null references public.procedures (id),
  procedure_variant_id uuid,
  tooth_number integer,
  region text,
  quantity numeric(10,2) not null default 1 check (quantity > 0),
  notes text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled_at timestamptz
);

create index if not exists appointment_planned_procedures_appt_idx
  on public.appointment_planned_procedures (appointment_id)
  where cancelled_at is null;
create index if not exists appointment_planned_procedures_proc_idx
  on public.appointment_planned_procedures (procedure_id);
create index if not exists appointment_planned_procedures_patient_idx
  on public.appointment_planned_procedures (clinic_id, patient_id);
create index if not exists appointments_clinic_start_status_idx
  on public.appointments (clinic_id, start_at, status);

-- Link planned → performed
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'performed_procedures'
      and column_name = 'appointment_planned_procedure_id'
  ) then
    alter table public.performed_procedures
      add column appointment_planned_procedure_id uuid
        references public.appointment_planned_procedures (id);
  end if;
end $$;

create or replace function public.enforce_planned_procedure_tenant()
returns trigger language plpgsql as $$
declare
  appt_clinic uuid;
  appt_patient uuid;
  proc_clinic uuid;
  patient_clinic uuid;
begin
  select clinic_id, patient_id into appt_clinic, appt_patient
    from public.appointments where id = new.appointment_id;
  select clinic_id into proc_clinic from public.procedures where id = new.procedure_id;
  select clinic_id into patient_clinic from public.patients where id = new.patient_id;
  if appt_clinic is null or proc_clinic is null or patient_clinic is null
     or appt_clinic <> new.clinic_id or proc_clinic <> new.clinic_id
     or patient_clinic <> new.clinic_id or appt_patient <> new.patient_id then
    raise exception 'CROSS_CLINIC_REFERENCE';
  end if;
  return new;
end;
$$;

drop trigger if exists appointment_planned_procedures_tenant_trg on public.appointment_planned_procedures;
create trigger appointment_planned_procedures_tenant_trg
  before insert or update on public.appointment_planned_procedures
  for each row execute function public.enforce_planned_procedure_tenant();

alter table public.appointment_planned_procedures enable row level security;

create policy appointment_planned_procedures_select on public.appointment_planned_procedures
  for select to authenticated
  using (public.has_permission(clinic_id, 'appointment_planned_procedures.view'));
create policy appointment_planned_procedures_insert on public.appointment_planned_procedures
  for insert to authenticated
  with check (public.has_permission(clinic_id, 'appointment_planned_procedures.create'));
create policy appointment_planned_procedures_update on public.appointment_planned_procedures
  for update to authenticated
  using (public.has_permission(clinic_id, 'appointment_planned_procedures.update'))
  with check (public.has_permission(clinic_id, 'appointment_planned_procedures.update'));

comment on table public.appointment_planned_procedures is
  'Procedimento previsto na Agenda — distinto de performed_procedures (realizado).';
