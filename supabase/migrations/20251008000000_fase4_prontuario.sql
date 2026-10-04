-- Sorria FASE 4 — Prontuário clínico
-- Administrativo ≠ Clínico · Rascunho ≠ Finalizado · Correção ≠ Sobrescrita
-- Owner administrativo ≠ acesso clínico universal

-- ---------------------------------------------------------------------------
-- Owner: remover permissões clínicas padrão (opt-in via clinical_access)
-- ---------------------------------------------------------------------------
alter table public.clinic_members
  add column if not exists clinical_access boolean not null default false;

comment on column public.clinic_members.clinical_access is
  'Opt-in de acesso clínico. Owner sem este flag não acessa prontuário.';

-- Proprietários que também são profissionais clínicos (seed/demo) podem ser marcados depois.
-- Revoga clínico do papel owner no catálogo:
delete from public.role_permissions rp
using public.roles r, public.permissions p
where rp.role_id = r.id
  and rp.permission_id = p.id
  and r.key = 'owner'
  and p.key in (
    'clinical_record.view','clinical_record.create','clinical_record.update',
    'anamnesis.view','anamnesis.create','anamnesis.update',
    'clinical_evolution.view','clinical_evolution.create','clinical_evolution.update',
    'odontogram.view','odontogram.update',
    'clinical_files.view','clinical_files.upload',
    'treatments.view','treatments.create','treatments.update'
  );

-- Helper: permissão clínica efetiva (role dentist OU owner+clinical_access)
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
            'treatments.view','treatments.create','treatments.update'
          ])
        )
        or (r.key = 'owner' and public.has_clinic_permission(p_clinic_id, p_permission))
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  if not exists (select 1 from pg_type where typname = 'anamnesis_status') then
    create type public.anamnesis_status as enum ('draft', 'submitted', 'reviewed');
  end if;
  if not exists (select 1 from pg_type where typname = 'clinical_entry_status') then
    create type public.clinical_entry_status as enum ('draft', 'finalized');
  end if;
  if not exists (select 1 from pg_type where typname = 'tooth_condition') then
    create type public.tooth_condition as enum (
      'healthy','caries','restoration','missing','implant','crown','endodontics','extraction_indicated','other'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'clinical_attachment_type') then
    create type public.clinical_attachment_type as enum (
      'clinical_photo','radiograph','exam','pdf','other'
    );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- anamneses
-- ---------------------------------------------------------------------------
create table if not exists public.anamneses (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  patient_id uuid not null references public.patients (id) on delete restrict,
  template_version integer not null default 1,
  status public.anamnesis_status not null default 'draft',
  answered_by uuid references public.profiles (id) on delete set null,
  answered_at timestamptz,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, patient_id, template_version)
);

create index if not exists anamneses_clinic_patient_idx
  on public.anamneses (clinic_id, patient_id);

drop trigger if exists anamneses_set_updated_at on public.anamneses;
create trigger anamneses_set_updated_at
  before update on public.anamneses
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- anamnesis_answers
-- ---------------------------------------------------------------------------
create table if not exists public.anamnesis_answers (
  id uuid primary key default gen_random_uuid(),
  anamnesis_id uuid not null references public.anamneses (id) on delete cascade,
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  question_key text not null,
  value_bool boolean,
  value_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (anamnesis_id, question_key)
);

create index if not exists anamnesis_answers_clinic_idx
  on public.anamnesis_answers (clinic_id);

drop trigger if exists anamnesis_answers_set_updated_at on public.anamnesis_answers;
create trigger anamnesis_answers_set_updated_at
  before update on public.anamnesis_answers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- clinical_entries
-- ---------------------------------------------------------------------------
create table if not exists public.clinical_entries (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  patient_id uuid not null references public.patients (id) on delete restrict,
  appointment_id uuid references public.appointments (id) on delete set null,
  professional_id uuid not null references public.profiles (id) on delete restrict,
  status public.clinical_entry_status not null default 'draft',
  chief_complaint text,
  clinical_exam text,
  procedure_done text,
  conduct text,
  guidance text,
  next_step text,
  related_teeth integer[] not null default '{}',
  follow_up_required boolean not null default false,
  follow_up_interval_days integer,
  version_number integer not null default 1,
  signed_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clinical_entries_follow_up_check check (
    follow_up_required = false
    or (follow_up_interval_days is not null and follow_up_interval_days > 0)
  )
);

create index if not exists clinical_entries_clinic_patient_created_idx
  on public.clinical_entries (clinic_id, patient_id, created_at desc);
create index if not exists clinical_entries_appointment_idx
  on public.clinical_entries (appointment_id);
create index if not exists clinical_entries_follow_up_idx
  on public.clinical_entries (clinic_id, follow_up_required)
  where follow_up_required = true and status = 'finalized';

drop trigger if exists clinical_entries_set_updated_at on public.clinical_entries;
create trigger clinical_entries_set_updated_at
  before update on public.clinical_entries
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- clinical_entry_versions (imutáveis)
-- ---------------------------------------------------------------------------
create table if not exists public.clinical_entry_versions (
  id uuid primary key default gen_random_uuid(),
  clinical_entry_id uuid not null references public.clinical_entries (id) on delete cascade,
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  version_number integer not null,
  snapshot_json jsonb not null,
  changed_by uuid references public.profiles (id) on delete set null,
  change_reason text,
  created_at timestamptz not null default now(),
  unique (clinical_entry_id, version_number)
);

create index if not exists clinical_entry_versions_entry_idx
  on public.clinical_entry_versions (clinical_entry_id, version_number);

-- ---------------------------------------------------------------------------
-- odontogram_entries
-- ---------------------------------------------------------------------------
create table if not exists public.odontogram_entries (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  patient_id uuid not null references public.patients (id) on delete restrict,
  tooth_number integer not null check (tooth_number between 11 and 48),
  condition public.tooth_condition not null default 'healthy',
  planned_procedure text,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, patient_id, tooth_number)
);

create index if not exists odontogram_entries_clinic_patient_idx
  on public.odontogram_entries (clinic_id, patient_id);

drop trigger if exists odontogram_entries_set_updated_at on public.odontogram_entries;
create trigger odontogram_entries_set_updated_at
  before update on public.odontogram_entries
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- attachments
-- ---------------------------------------------------------------------------
create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  patient_id uuid not null references public.patients (id) on delete restrict,
  clinical_entry_id uuid references public.clinical_entries (id) on delete set null,
  type public.clinical_attachment_type not null default 'other',
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  file_size integer,
  description text,
  patient_visible boolean not null default false,
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists attachments_clinic_patient_idx
  on public.attachments (clinic_id, patient_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Storage bucket privado
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'clinical-files',
  'clinical-files',
  false,
  10485760,
  array[
    'image/jpeg','image/png','image/webp',
    'application/pdf',
    'image/dicom'
  ]
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.anamneses enable row level security;
alter table public.anamnesis_answers enable row level security;
alter table public.clinical_entries enable row level security;
alter table public.clinical_entry_versions enable row level security;
alter table public.odontogram_entries enable row level security;
alter table public.attachments enable row level security;

-- Anamneses
drop policy if exists anamneses_select on public.anamneses;
create policy anamneses_select on public.anamneses for select to authenticated
  using (public.has_clinic_permission(clinic_id, 'anamnesis.view')
    or public.has_clinical_permission(clinic_id, 'anamnesis.view'));

drop policy if exists anamneses_insert on public.anamneses;
create policy anamneses_insert on public.anamneses for insert to authenticated
  with check (public.has_clinic_permission(clinic_id, 'anamnesis.create')
    or public.has_clinical_permission(clinic_id, 'anamnesis.create'));

drop policy if exists anamneses_update on public.anamneses;
create policy anamneses_update on public.anamneses for update to authenticated
  using (public.has_clinic_permission(clinic_id, 'anamnesis.update')
    or public.has_clinical_permission(clinic_id, 'anamnesis.update'))
  with check (public.has_clinic_permission(clinic_id, 'anamnesis.update')
    or public.has_clinical_permission(clinic_id, 'anamnesis.update'));

drop policy if exists anamneses_delete on public.anamneses;
create policy anamneses_delete on public.anamneses for delete to authenticated
  using (false);

-- Answers
drop policy if exists anamnesis_answers_select on public.anamnesis_answers;
create policy anamnesis_answers_select on public.anamnesis_answers for select to authenticated
  using (public.has_clinic_permission(clinic_id, 'anamnesis.view')
    or public.has_clinical_permission(clinic_id, 'anamnesis.view'));

drop policy if exists anamnesis_answers_write on public.anamnesis_answers;
create policy anamnesis_answers_write on public.anamnesis_answers for all to authenticated
  using (public.has_clinic_permission(clinic_id, 'anamnesis.update')
    or public.has_clinical_permission(clinic_id, 'anamnesis.update'))
  with check (public.has_clinic_permission(clinic_id, 'anamnesis.create')
    or public.has_clinic_permission(clinic_id, 'anamnesis.update')
    or public.has_clinical_permission(clinic_id, 'anamnesis.create')
    or public.has_clinical_permission(clinic_id, 'anamnesis.update'));

-- Clinical entries
drop policy if exists clinical_entries_select on public.clinical_entries;
create policy clinical_entries_select on public.clinical_entries for select to authenticated
  using (public.has_clinic_permission(clinic_id, 'clinical_evolution.view')
    or public.has_clinical_permission(clinic_id, 'clinical_evolution.view'));

drop policy if exists clinical_entries_insert on public.clinical_entries;
create policy clinical_entries_insert on public.clinical_entries for insert to authenticated
  with check (public.has_clinic_permission(clinic_id, 'clinical_evolution.create')
    or public.has_clinical_permission(clinic_id, 'clinical_evolution.create'));

drop policy if exists clinical_entries_update on public.clinical_entries;
create policy clinical_entries_update on public.clinical_entries for update to authenticated
  using (public.has_clinic_permission(clinic_id, 'clinical_evolution.update')
    or public.has_clinical_permission(clinic_id, 'clinical_evolution.update'))
  with check (public.has_clinic_permission(clinic_id, 'clinical_evolution.update')
    or public.has_clinical_permission(clinic_id, 'clinical_evolution.update'));

drop policy if exists clinical_entries_delete on public.clinical_entries;
create policy clinical_entries_delete on public.clinical_entries for delete to authenticated
  using (false);

-- Versions: select only; insert via service; no update/delete
drop policy if exists clinical_entry_versions_select on public.clinical_entry_versions;
create policy clinical_entry_versions_select on public.clinical_entry_versions for select to authenticated
  using (public.has_clinic_permission(clinic_id, 'clinical_evolution.view')
    or public.has_clinical_permission(clinic_id, 'clinical_evolution.view'));

drop policy if exists clinical_entry_versions_insert on public.clinical_entry_versions;
create policy clinical_entry_versions_insert on public.clinical_entry_versions for insert to authenticated
  with check (public.has_clinic_permission(clinic_id, 'clinical_evolution.update')
    or public.has_clinical_permission(clinic_id, 'clinical_evolution.update'));

drop policy if exists clinical_entry_versions_mutate on public.clinical_entry_versions;
create policy clinical_entry_versions_mutate on public.clinical_entry_versions for update to authenticated
  using (false);

drop policy if exists clinical_entry_versions_delete on public.clinical_entry_versions;
create policy clinical_entry_versions_delete on public.clinical_entry_versions for delete to authenticated
  using (false);

-- Odontogram
drop policy if exists odontogram_select on public.odontogram_entries;
create policy odontogram_select on public.odontogram_entries for select to authenticated
  using (public.has_clinic_permission(clinic_id, 'odontogram.view')
    or public.has_clinical_permission(clinic_id, 'odontogram.view'));

drop policy if exists odontogram_write on public.odontogram_entries;
create policy odontogram_write on public.odontogram_entries for all to authenticated
  using (public.has_clinic_permission(clinic_id, 'odontogram.update')
    or public.has_clinical_permission(clinic_id, 'odontogram.update'))
  with check (public.has_clinic_permission(clinic_id, 'odontogram.update')
    or public.has_clinical_permission(clinic_id, 'odontogram.update'));

-- Attachments
drop policy if exists attachments_select on public.attachments;
create policy attachments_select on public.attachments for select to authenticated
  using (public.has_clinic_permission(clinic_id, 'clinical_files.view')
    or public.has_clinical_permission(clinic_id, 'clinical_files.view'));

drop policy if exists attachments_insert on public.attachments;
create policy attachments_insert on public.attachments for insert to authenticated
  with check (public.has_clinic_permission(clinic_id, 'clinical_files.upload')
    or public.has_clinical_permission(clinic_id, 'clinical_files.upload'));

drop policy if exists attachments_delete on public.attachments;
create policy attachments_delete on public.attachments for delete to authenticated
  using (false);

-- Storage policies: path clinic/{clinicId}/patient/{patientId}/clinical/...
drop policy if exists clinical_files_select on storage.objects;
create policy clinical_files_select on storage.objects for select to authenticated
  using (
    bucket_id = 'clinical-files'
    and (storage.foldername(name))[1] = 'clinic'
    and public.has_clinic_permission(((storage.foldername(name))[2])::uuid, 'clinical_files.view')
  );

drop policy if exists clinical_files_insert on storage.objects;
create policy clinical_files_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'clinical-files'
    and (storage.foldername(name))[1] = 'clinic'
    and public.has_clinic_permission(((storage.foldername(name))[2])::uuid, 'clinical_files.upload')
  );
