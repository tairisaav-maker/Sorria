-- Sorria FASE 2 — Pacientes (cadastro administrativo)
-- Administrative Patient Data ≠ Clinical Record Access
-- Sem campos clínicos nesta tabela.

-- ---------------------------------------------------------------------------
-- Enum status cadastral
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'patient_status') then
    create type public.patient_status as enum ('active', 'inactive', 'archived');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- patients
-- ---------------------------------------------------------------------------
create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,

  full_name text not null,
  preferred_name text,

  cpf text,
  cpf_normalized text,

  birth_date date,

  phone text,
  phone_normalized text,
  secondary_phone text,
  secondary_phone_normalized text,

  email text,
  email_normalized text,

  postal_code text,
  street text,
  number text,
  complement text,
  neighborhood text,
  city text,
  state text,

  guardian_name text,
  guardian_phone text,
  guardian_relationship text,

  emergency_contact_name text,
  emergency_contact_phone text,
  emergency_contact_relationship text,

  referral_source text,

  administrative_notes text,

  status public.patient_status not null default 'active',

  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

comment on table public.patients is
  'Cadastro administrativo do paciente. NÃO contém dados clínicos.';

comment on column public.patients.cpf_normalized is
  'Somente dígitos; usado em busca e duplicidade. Formatação só na UI.';
comment on column public.patients.phone_normalized is
  'Somente dígitos; busca/duplicidade sem máscara.';
comment on column public.patients.email_normalized is
  'lower(trim); comparação e busca.';
comment on column public.patients.status is
  'Somente active|inactive|archived. Estados derivados (em tratamento etc.) vêm de outros módulos.';
comment on column public.patients.administrative_notes is
  'Notas administrativas. Nunca usar para informação clínica.';

-- Impede CPF duplicado acidental na mesma clínica (quando preenchido)
create unique index if not exists patients_clinic_cpf_unique
  on public.patients (clinic_id, cpf_normalized)
  where cpf_normalized is not null and status <> 'archived';

create index if not exists patients_clinic_status_idx
  on public.patients (clinic_id, status);

create index if not exists patients_clinic_updated_idx
  on public.patients (clinic_id, updated_at desc);

create index if not exists patients_clinic_name_idx
  on public.patients (clinic_id, full_name);

create index if not exists patients_clinic_phone_idx
  on public.patients (clinic_id, phone_normalized)
  where phone_normalized is not null;

create index if not exists patients_clinic_email_idx
  on public.patients (clinic_id, email_normalized)
  where email_normalized is not null;

-- Busca parcial por nome (trigram) — requer extensão
create extension if not exists pg_trgm;

create index if not exists patients_full_name_trgm_idx
  on public.patients using gin (full_name gin_trgm_ops);

create index if not exists patients_preferred_name_trgm_idx
  on public.patients using gin (preferred_name gin_trgm_ops)
  where preferred_name is not null;

drop trigger if exists patients_set_updated_at on public.patients;
create trigger patients_set_updated_at
  before update on public.patients
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.patients enable row level security;

drop policy if exists "patients_select_demographics_view" on public.patients;
create policy "patients_select_demographics_view"
  on public.patients for select to authenticated
  using (
    public.is_active_clinic_member(clinic_id)
    and public.has_permission(clinic_id, 'patients.demographics.view')
  );

drop policy if exists "patients_insert_demographics_create" on public.patients;
create policy "patients_insert_demographics_create"
  on public.patients for insert to authenticated
  with check (
    public.is_active_clinic_member(clinic_id)
    and public.has_permission(clinic_id, 'patients.demographics.create')
  );

drop policy if exists "patients_update_admin_fields" on public.patients;
create policy "patients_update_admin_fields"
  on public.patients for update to authenticated
  using (
    public.is_active_clinic_member(clinic_id)
    and (
      public.has_permission(clinic_id, 'patients.demographics.update')
      or public.has_permission(clinic_id, 'patients.contact.update')
      or public.has_permission(clinic_id, 'patients.administrative.update')
    )
  )
  with check (
    public.is_active_clinic_member(clinic_id)
    and (
      public.has_permission(clinic_id, 'patients.demographics.update')
      or public.has_permission(clinic_id, 'patients.contact.update')
      or public.has_permission(clinic_id, 'patients.administrative.update')
    )
  );

-- Sem DELETE destrutivo — arquivar via status
drop policy if exists "patients_no_delete" on public.patients;
create policy "patients_no_delete"
  on public.patients for delete to authenticated
  using (false);
