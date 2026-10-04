-- Sorria FASE 7 — Portal do Paciente
-- Solicitação ≠ Consulta · E-mail igual ≠ vínculo · patient_visible obrigatório
-- Identidade: auth.uid() → patient_portal_access (active) → clinic + patient → resource

-- ---------------------------------------------------------------------------
-- patient_portal_access (N:N — prepara responsável/multi-clínica)
-- ---------------------------------------------------------------------------
do $$ begin
  if not exists (select 1 from pg_type where typname = 'portal_access_status') then
    create type public.portal_access_status as enum ('invited', 'active', 'revoked');
  end if;
  if not exists (select 1 from pg_type where typname = 'appointment_request_type') then
    create type public.appointment_request_type as enum (
      'new_appointment', 'reschedule', 'cancellation'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'record_copy_status') then
    create type public.record_copy_status as enum (
      'requested', 'preparing', 'available', 'delivered', 'cancelled'
    );
  end if;
end $$;

create table if not exists public.patient_portal_access (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  patient_id uuid not null references public.patients (id) on delete cascade,
  auth_user_id uuid not null references auth.users (id) on delete cascade,
  status public.portal_access_status not null default 'invited',
  invited_at timestamptz,
  activated_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, patient_id, auth_user_id)
);

create index if not exists patient_portal_access_auth_idx
  on public.patient_portal_access (auth_user_id, status);
create index if not exists patient_portal_access_patient_idx
  on public.patient_portal_access (clinic_id, patient_id, status);

drop trigger if exists patient_portal_access_set_updated_at on public.patient_portal_access;
create trigger patient_portal_access_set_updated_at
  before update on public.patient_portal_access
  for each row execute function public.set_updated_at();

comment on table public.patient_portal_access is
  'Vínculo explícito auth↔paciente↔clínica. E-mail igual NÃO autoriza. Suporta responsável N:N.';

-- Helpers de Portal
create or replace function public.has_active_portal_access(
  p_clinic_id uuid,
  p_patient_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.patient_portal_access a
    where a.auth_user_id = auth.uid()
      and a.clinic_id = p_clinic_id
      and a.patient_id = p_patient_id
      and a.status = 'active'
  );
$$;

create or replace function public.my_portal_patient_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select a.patient_id
  from public.patient_portal_access a
  where a.auth_user_id = auth.uid()
    and a.status = 'active';
$$;

-- ---------------------------------------------------------------------------
-- Evoluir appointment_requests (request_type)
-- ---------------------------------------------------------------------------
alter table public.appointment_requests
  add column if not exists request_type public.appointment_request_type
    not null default 'new_appointment';

alter table public.appointment_requests
  add column if not exists related_appointment_id uuid
    references public.appointments (id) on delete set null;

create index if not exists appointment_requests_type_idx
  on public.appointment_requests (clinic_id, request_type, status);

-- Paciente pode criar/ver próprias solicitações
drop policy if exists appointment_requests_patient_select on public.appointment_requests;
create policy appointment_requests_patient_select
  on public.appointment_requests for select to authenticated
  using (
    public.has_active_portal_access(clinic_id, patient_id)
  );

drop policy if exists appointment_requests_patient_insert on public.appointment_requests;
create policy appointment_requests_patient_insert
  on public.appointment_requests for insert to authenticated
  with check (
    public.has_active_portal_access(clinic_id, patient_id)
  );

drop policy if exists appointment_requests_patient_update on public.appointment_requests;
create policy appointment_requests_patient_update
  on public.appointment_requests for update to authenticated
  using (public.has_active_portal_access(clinic_id, patient_id))
  with check (public.has_active_portal_access(clinic_id, patient_id));

-- Appointments: paciente lê próprios
drop policy if exists appointments_patient_select on public.appointments;
create policy appointments_patient_select
  on public.appointments for select to authenticated
  using (public.has_active_portal_access(clinic_id, patient_id));

-- Paciente confirma presença (update limitado — app/service reforça regras)
drop policy if exists appointments_patient_confirm on public.appointments;
create policy appointments_patient_confirm
  on public.appointments for update to authenticated
  using (public.has_active_portal_access(clinic_id, patient_id))
  with check (public.has_active_portal_access(clinic_id, patient_id));

-- Treatments
drop policy if exists treatment_plans_patient_select on public.treatment_plans;
create policy treatment_plans_patient_select
  on public.treatment_plans for select to authenticated
  using (public.has_active_portal_access(clinic_id, patient_id));

drop policy if exists treatment_items_patient_select on public.treatment_items;
create policy treatment_items_patient_select
  on public.treatment_items for select to authenticated
  using (public.has_active_portal_access(clinic_id, patient_id));

-- Finance (somente próprias obrigações de receita)
drop policy if exists financial_transactions_patient_select on public.financial_transactions;
create policy financial_transactions_patient_select
  on public.financial_transactions for select to authenticated
  using (
    type = 'income'
    and patient_id is not null
    and public.has_active_portal_access(clinic_id, patient_id)
  );

drop policy if exists payment_installments_patient_select on public.payment_installments;
create policy payment_installments_patient_select
  on public.payment_installments for select to authenticated
  using (
    exists (
      select 1 from public.financial_transactions t
      where t.id = financial_transaction_id
        and t.type = 'income'
        and t.patient_id is not null
        and public.has_active_portal_access(t.clinic_id, t.patient_id)
    )
  );

drop policy if exists payments_patient_select on public.payments;
create policy payments_patient_select
  on public.payments for select to authenticated
  using (
    exists (
      select 1 from public.financial_transactions t
      where t.id = financial_transaction_id
        and t.type = 'income'
        and t.patient_id is not null
        and public.has_active_portal_access(t.clinic_id, t.patient_id)
    )
    and reversed_at is null
  );

-- Attachments: só patient_visible
drop policy if exists attachments_patient_select on public.attachments;
create policy attachments_patient_select
  on public.attachments for select to authenticated
  using (
    patient_visible = true
    and public.has_active_portal_access(clinic_id, patient_id)
  );

-- Patients: ler próprio cadastro
drop policy if exists patients_portal_select on public.patients;
create policy patients_portal_select
  on public.patients for select to authenticated
  using (public.has_active_portal_access(clinic_id, id));

drop policy if exists patients_portal_update on public.patients;
create policy patients_portal_update
  on public.patients for update to authenticated
  using (public.has_active_portal_access(clinic_id, id))
  with check (public.has_active_portal_access(clinic_id, id));

-- ---------------------------------------------------------------------------
-- record_copy_requests
-- ---------------------------------------------------------------------------
create table if not exists public.record_copy_requests (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  patient_id uuid not null references public.patients (id) on delete cascade,
  status public.record_copy_status not null default 'requested',
  requested_at timestamptz not null default now(),
  prepared_at timestamptz,
  available_at timestamptz,
  delivered_at timestamptz,
  handled_by uuid references public.profiles (id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists record_copy_requests_clinic_idx
  on public.record_copy_requests (clinic_id, status, requested_at desc);

drop trigger if exists record_copy_requests_set_updated_at on public.record_copy_requests;
create trigger record_copy_requests_set_updated_at
  before update on public.record_copy_requests
  for each row execute function public.set_updated_at();

alter table public.record_copy_requests enable row level security;

drop policy if exists record_copy_patient_select on public.record_copy_requests;
create policy record_copy_patient_select
  on public.record_copy_requests for select to authenticated
  using (public.has_active_portal_access(clinic_id, patient_id));

drop policy if exists record_copy_patient_insert on public.record_copy_requests;
create policy record_copy_patient_insert
  on public.record_copy_requests for insert to authenticated
  with check (public.has_active_portal_access(clinic_id, patient_id));

drop policy if exists record_copy_staff_all on public.record_copy_requests;
create policy record_copy_staff_all
  on public.record_copy_requests for all to authenticated
  using (
    public.has_permission(clinic_id, 'patients.administrative.view')
    or public.has_permission(clinic_id, 'clinical_record.view')
  )
  with check (
    public.has_permission(clinic_id, 'patients.administrative.update')
    or public.has_permission(clinic_id, 'clinical_record.update')
  );

-- ---------------------------------------------------------------------------
-- portal_notifications (interno; sem push externo)
-- ---------------------------------------------------------------------------
create table if not exists public.portal_notifications (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  patient_id uuid not null references public.patients (id) on delete cascade,
  auth_user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists portal_notifications_user_idx
  on public.portal_notifications (auth_user_id, read_at, created_at desc);

alter table public.portal_notifications enable row level security;

drop policy if exists portal_notifications_select on public.portal_notifications;
create policy portal_notifications_select
  on public.portal_notifications for select to authenticated
  using (
    auth_user_id = auth.uid()
    and public.has_active_portal_access(clinic_id, patient_id)
  );

drop policy if exists portal_notifications_update on public.portal_notifications;
create policy portal_notifications_update
  on public.portal_notifications for update to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

alter table public.patient_portal_access enable row level security;

drop policy if exists patient_portal_access_select on public.patient_portal_access;
create policy patient_portal_access_select
  on public.patient_portal_access for select to authenticated
  using (
    auth_user_id = auth.uid()
    or public.has_permission(clinic_id, 'patients.administrative.view')
  );

-- Storage: paciente só patient_visible (path ainda tenant-bound)
-- Policies existentes do bucket clinical-files permanecem privadas;
-- acesso via signed URL gerada após checagem de patient_visible no service.
