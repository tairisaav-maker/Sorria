-- Sorria FASE 1 — Usuários, equipe, papéis, permissões e segurança
-- Incremental: NÃO remove a migration da Fase 0.
-- Princípios: Deny by default + Least privilege + Defense in depth + Tenant isolation
-- Regra: Administrative Patient Data ≠ Clinical Record Access

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'membership_status') then
    create type public.membership_status as enum (
      'invited',
      'active',
      'suspended',
      'revoked'
    );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Roles (sistema)
-- ---------------------------------------------------------------------------
create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  is_system boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.roles is
  'Papéis do Sorria. Roles de sistema não podem ser apagadas pela interface.';

-- ---------------------------------------------------------------------------
-- Permissions (ações, não telas)
-- ---------------------------------------------------------------------------
create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  category text not null,
  created_at timestamptz not null default now()
);

comment on table public.permissions is
  'Permissões granulares. patients.* administrativo ≠ clinical_* clínico.';

-- ---------------------------------------------------------------------------
-- Role ↔ Permission
-- ---------------------------------------------------------------------------
create table if not exists public.role_permissions (
  role_id uuid not null references public.roles (id) on delete cascade,
  permission_id uuid not null references public.permissions (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);

create index if not exists role_permissions_role_id_idx
  on public.role_permissions (role_id);
create index if not exists role_permissions_permission_id_idx
  on public.role_permissions (permission_id);

-- ---------------------------------------------------------------------------
-- Seed roles
-- ---------------------------------------------------------------------------
insert into public.roles (key, name, description, is_system)
values
  ('owner', 'Proprietária', 'Administração máxima da própria clínica (não é admin da plataforma).', true),
  ('dentist', 'Dentista', 'Acesso profissional e clínico na clínica.', true),
  ('secretary', 'Secretária', 'Acesso administrativo. Sem prontuário clínico por padrão.', true)
on conflict (key) do update
  set name = excluded.name,
      description = excluded.description,
      is_system = excluded.is_system;

-- patient role prepared for future portal — not used in Fase 1 UI
insert into public.roles (key, name, description, is_system)
values ('patient', 'Paciente', 'Reservado para Portal do Paciente (não implementado nesta fase).', true)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Seed permissions
-- ---------------------------------------------------------------------------
insert into public.permissions (key, name, description, category) values
  ('dashboard.view', 'Ver início', 'Visualizar dashboard', 'dashboard'),

  ('appointments.view', 'Ver agenda', 'Visualizar consultas', 'agenda'),
  ('appointments.create', 'Criar consulta', 'Criar consultas', 'agenda'),
  ('appointments.update', 'Atualizar consulta', 'Reagendar/atualizar consultas', 'agenda'),
  ('appointments.cancel', 'Cancelar consulta', 'Cancelar consultas', 'agenda'),
  ('appointment_requests.view', 'Ver solicitações', 'Visualizar solicitações de horário', 'agenda'),
  ('appointment_requests.manage', 'Gerenciar solicitações', 'Propor/gerenciar solicitações', 'agenda'),

  ('patients.demographics.view', 'Ver dados cadastrais', 'Nome, nascimento, responsável etc.', 'patients_admin'),
  ('patients.demographics.create', 'Criar cadastro', 'Criar paciente (dados cadastrais)', 'patients_admin'),
  ('patients.demographics.update', 'Editar cadastro', 'Editar dados cadastrais', 'patients_admin'),
  ('patients.contact.view', 'Ver contato', 'Telefone e e-mail', 'patients_admin'),
  ('patients.contact.update', 'Editar contato', 'Atualizar telefone/e-mail', 'patients_admin'),
  ('patients.administrative.view', 'Ver dados administrativos', 'Informações administrativas do paciente', 'patients_admin'),
  ('patients.administrative.update', 'Editar dados administrativos', 'Atualizar dados administrativos', 'patients_admin'),

  ('clinical_record.view', 'Ver prontuário', 'Acesso ao prontuário clínico', 'clinical'),
  ('clinical_record.create', 'Criar prontuário', 'Criar registros clínicos', 'clinical'),
  ('clinical_record.update', 'Editar prontuário', 'Atualizar prontuário clínico', 'clinical'),
  ('anamnesis.view', 'Ver anamnese clínica', 'Visualizar anamnese', 'clinical'),
  ('anamnesis.create', 'Criar anamnese', 'Registrar anamnese', 'clinical'),
  ('anamnesis.update', 'Editar anamnese', 'Atualizar anamnese', 'clinical'),
  ('clinical_evolution.view', 'Ver evoluções clínicas', 'Visualizar evoluções', 'clinical'),
  ('clinical_evolution.create', 'Criar evolução', 'Registrar evolução', 'clinical'),
  ('clinical_evolution.update', 'Editar evolução', 'Atualizar evolução', 'clinical'),
  ('odontogram.view', 'Ver odontograma', 'Visualizar odontograma', 'clinical'),
  ('odontogram.update', 'Editar odontograma', 'Atualizar odontograma', 'clinical'),
  ('clinical_files.view', 'Ver arquivos clínicos', 'Visualizar arquivos clínicos', 'clinical'),
  ('clinical_files.upload', 'Enviar arquivos clínicos', 'Upload de arquivos clínicos', 'clinical'),

  ('treatments.administrative_view', 'Ver tratamento administrativo', 'Valores/planos em visão administrativa', 'treatments'),
  ('treatments.view', 'Ver tratamentos', 'Visualizar planos de tratamento', 'treatments'),
  ('treatments.create', 'Criar tratamento', 'Criar planos', 'treatments'),
  ('treatments.update', 'Editar tratamento', 'Atualizar planos', 'treatments'),

  ('finance.view_administrative', 'Financeiro administrativo', 'Visão financeira administrativa', 'finance'),
  ('finance.payment_create', 'Registrar pagamento', 'Registrar pagamentos', 'finance'),
  ('finance.view_authorized', 'Financeiro autorizado', 'Visão financeira autorizada ao profissional', 'finance'),

  ('reports.view', 'Ver relatórios', 'Acessar relatórios', 'reports'),

  ('team.view', 'Ver equipe', 'Listar membros da clínica', 'team'),
  ('team.invite', 'Convidar pessoa', 'Convidar membros', 'team'),
  ('team.change_role', 'Alterar função', 'Mudar papel de membros', 'team'),
  ('team.suspend', 'Suspender acesso', 'Suspender membros', 'team'),
  ('team.reactivate', 'Reativar acesso', 'Reativar membros', 'team'),
  ('permissions.manage', 'Gerenciar permissões', 'Administrar matriz de permissões', 'team'),

  ('audit.view', 'Ver auditoria', 'Visualizar trilha de auditoria', 'audit'),
  ('audit.view_sensitive', 'Ver auditoria sensível', 'Eventos sensíveis de autorização', 'audit')
on conflict (key) do update
  set name = excluded.name,
      description = excluded.description,
      category = excluded.category;

-- ---------------------------------------------------------------------------
-- role_permissions helpers
-- ---------------------------------------------------------------------------
create or replace function public.grant_permissions(p_role_key text, p_permission_keys text[])
returns void
language plpgsql
as $$
begin
  insert into public.role_permissions (role_id, permission_id)
  select r.id, p.id
  from public.roles r
  cross join public.permissions p
  where r.key = p_role_key
    and p.key = any (p_permission_keys)
  on conflict do nothing;
end;
$$;

-- Owner: administrativo máximo da clínica (inclui clínico e equipe)
select public.grant_permissions('owner', array[
  'dashboard.view',
  'appointments.view','appointments.create','appointments.update','appointments.cancel',
  'appointment_requests.view','appointment_requests.manage',
  'patients.demographics.view','patients.demographics.create','patients.demographics.update',
  'patients.contact.view','patients.contact.update',
  'patients.administrative.view','patients.administrative.update',
  'clinical_record.view','clinical_record.create','clinical_record.update',
  'anamnesis.view','anamnesis.create','anamnesis.update',
  'clinical_evolution.view','clinical_evolution.create','clinical_evolution.update',
  'odontogram.view','odontogram.update',
  'clinical_files.view','clinical_files.upload',
  'treatments.administrative_view','treatments.view','treatments.create','treatments.update',
  'finance.view_administrative','finance.payment_create','finance.view_authorized',
  'reports.view',
  'team.view','team.invite','team.change_role','team.suspend','team.reactivate','permissions.manage',
  'audit.view','audit.view_sensitive'
]);

-- Dentist: clínico + cadastro; financeiro separado
select public.grant_permissions('dentist', array[
  'dashboard.view',
  'appointments.view','appointments.create','appointments.update',
  'appointment_requests.view','appointment_requests.manage',
  'patients.demographics.view','patients.demographics.create','patients.demographics.update',
  'patients.contact.view',
  'patients.administrative.view',
  'clinical_record.view','clinical_record.create','clinical_record.update',
  'anamnesis.view','anamnesis.create','anamnesis.update',
  'clinical_evolution.view','clinical_evolution.create','clinical_evolution.update',
  'odontogram.view','odontogram.update',
  'clinical_files.view','clinical_files.upload',
  'treatments.view','treatments.create','treatments.update',
  'finance.view_authorized',
  'reports.view'
]);

-- Secretary: administrativo; SEM clínico
select public.grant_permissions('secretary', array[
  'dashboard.view',
  'appointments.view','appointments.create','appointments.update','appointments.cancel',
  'appointment_requests.view','appointment_requests.manage',
  'patients.demographics.view','patients.demographics.create','patients.demographics.update',
  'patients.contact.view','patients.contact.update',
  'patients.administrative.view','patients.administrative.update',
  'treatments.administrative_view',
  'finance.view_administrative','finance.payment_create'
]);

-- ---------------------------------------------------------------------------
-- Evolve clinic_members (Fase 0 → Fase 1)
-- ---------------------------------------------------------------------------
alter table public.clinic_members
  add column if not exists role_id uuid references public.roles (id),
  add column if not exists status public.membership_status,
  add column if not exists invited_at timestamptz,
  add column if not exists joined_at timestamptz,
  add column if not exists suspended_at timestamptz;

-- Backfill role_id from legacy enum column when present
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'clinic_members'
      and column_name = 'role'
  ) then
    update public.clinic_members cm
    set role_id = r.id
    from public.roles r
    where cm.role_id is null
      and r.key = cm.role::text;
  end if;
end $$;

-- Default remaining nulls to secretary (safe least privilege)
update public.clinic_members cm
set role_id = r.id
from public.roles r
where cm.role_id is null
  and r.key = 'secretary';

-- Backfill status from is_active when present
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'clinic_members'
      and column_name = 'is_active'
  ) then
    update public.clinic_members
    set status = case when is_active then 'active'::public.membership_status
                      else 'suspended'::public.membership_status end
    where status is null;
  end if;
end $$;

update public.clinic_members
set status = 'active'
where status is null;

update public.clinic_members
set joined_at = coalesce(joined_at, created_at)
where status = 'active' and joined_at is null;

alter table public.clinic_members
  alter column role_id set not null,
  alter column status set not null,
  alter column status set default 'invited';

-- Drop legacy columns if they exist
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'clinic_members' and column_name = 'role'
  ) then
    alter table public.clinic_members drop column role;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'clinic_members' and column_name = 'is_active'
  ) then
    alter table public.clinic_members drop column is_active;
  end if;
end $$;

-- Drop obsolete enum if unused
do $$
begin
  if exists (select 1 from pg_type where typname = 'clinic_role')
     and not exists (
       select 1 from information_schema.columns
       where udt_name = 'clinic_role'
     ) then
    drop type public.clinic_role;
  end if;
end $$;

create index if not exists clinic_members_status_idx
  on public.clinic_members (clinic_id, status);
create index if not exists clinic_members_role_id_idx
  on public.clinic_members (role_id);

-- ---------------------------------------------------------------------------
-- Audit logs (append-only via RLS)
-- ---------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid references public.clinics (id) on delete set null,
  actor_user_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_clinic_created_idx
  on public.audit_logs (clinic_id, created_at desc);
create index if not exists audit_logs_actor_idx
  on public.audit_logs (actor_user_id);

comment on table public.audit_logs is
  'Trilha de auditoria append-only. Sem senhas/tokens/secrets.';

-- ---------------------------------------------------------------------------
-- Helpers (SECURITY DEFINER protegidos)
-- ---------------------------------------------------------------------------
create or replace function public.is_active_clinic_member(p_clinic_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.clinic_members cm
    where cm.clinic_id = p_clinic_id
      and cm.user_id = auth.uid()
      and cm.status = 'active'
  );
$$;

-- Compat: membership ativo
create or replace function public.is_clinic_member(p_clinic_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_active_clinic_member(p_clinic_id);
$$;

create or replace function public.has_role(p_clinic_id uuid, p_role_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.clinic_members cm
    join public.roles r on r.id = cm.role_id
    where cm.clinic_id = p_clinic_id
      and cm.user_id = auth.uid()
      and cm.status = 'active'
      and r.key = p_role_key
  );
$$;

create or replace function public.is_clinic_owner(p_clinic_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role(p_clinic_id, 'owner');
$$;

create or replace function public.has_permission(p_clinic_id uuid, p_permission_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.clinic_members cm
    join public.role_permissions rp on rp.role_id = cm.role_id
    join public.permissions p on p.id = rp.permission_id
    where cm.clinic_id = p_clinic_id
      and cm.user_id = auth.uid()
      and cm.status = 'active'
      and p.key = p_permission_key
  );
$$;

create or replace function public.user_clinic_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select cm.clinic_id
  from public.clinic_members cm
  where cm.user_id = auth.uid()
    and cm.status = 'active';
$$;

create or replace function public.count_active_owners(p_clinic_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.clinic_members cm
  join public.roles r on r.id = cm.role_id
  where cm.clinic_id = p_clinic_id
    and cm.status = 'active'
    and r.key = 'owner';
$$;

-- ---------------------------------------------------------------------------
-- RLS: roles / permissions (leitura autenticada; escrita só service/migration)
-- ---------------------------------------------------------------------------
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists "roles_select_authenticated" on public.roles;
create policy "roles_select_authenticated"
  on public.roles for select to authenticated
  using (true);

drop policy if exists "permissions_select_authenticated" on public.permissions;
create policy "permissions_select_authenticated"
  on public.permissions for select to authenticated
  using (true);

drop policy if exists "role_permissions_select_authenticated" on public.role_permissions;
create policy "role_permissions_select_authenticated"
  on public.role_permissions for select to authenticated
  using (true);

-- clinic_members policies (replace Fase 0)
drop policy if exists "clinic_members_select_same_clinic" on public.clinic_members;
drop policy if exists "clinic_members_insert_owner" on public.clinic_members;
drop policy if exists "clinic_members_update_owner" on public.clinic_members;
drop policy if exists "clinic_members_delete_owner" on public.clinic_members;

create policy "clinic_members_select_member_or_self"
  on public.clinic_members for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_active_clinic_member(clinic_id)
  );

create policy "clinic_members_insert_owner_with_team_invite"
  on public.clinic_members for insert to authenticated
  with check (
    (
      public.has_permission(clinic_id, 'team.invite')
      and public.is_active_clinic_member(clinic_id)
    )
    or (
      -- bootstrap: primeiro owner da clínica
      user_id = auth.uid()
      and not exists (
        select 1 from public.clinic_members existing
        where existing.clinic_id = clinic_members.clinic_id
      )
    )
  );

create policy "clinic_members_update_team_managers"
  on public.clinic_members for update to authenticated
  using (
    public.has_permission(clinic_id, 'team.change_role')
    or public.has_permission(clinic_id, 'team.suspend')
    or public.has_permission(clinic_id, 'team.reactivate')
  )
  with check (
    public.is_active_clinic_member(clinic_id)
  );

-- DELETE físico bloqueado para membership (usar revoked/suspended)
drop policy if exists "clinic_members_no_delete" on public.clinic_members;
create policy "clinic_members_no_delete"
  on public.clinic_members for delete to authenticated
  using (false);

-- clinics update still owner-only via is_clinic_owner
drop policy if exists "clinics_select_member" on public.clinics;
create policy "clinics_select_member"
  on public.clinics for select to authenticated
  using (
    public.is_active_clinic_member(id)
    or exists (
      select 1 from public.clinic_members cm
      where cm.clinic_id = clinics.id
        and cm.user_id = auth.uid()
        and cm.status in ('invited', 'suspended')
    )
  );

-- audit_logs: insert by members with team/audit actions; select by audit.view; no update/delete
drop policy if exists "audit_logs_select" on public.audit_logs;
create policy "audit_logs_select"
  on public.audit_logs for select to authenticated
  using (
    clinic_id is not null
    and public.has_permission(clinic_id, 'audit.view')
  );

drop policy if exists "audit_logs_insert" on public.audit_logs;
create policy "audit_logs_insert"
  on public.audit_logs for insert to authenticated
  with check (
    clinic_id is not null
    and public.is_active_clinic_member(clinic_id)
    and actor_user_id = auth.uid()
  );

drop policy if exists "audit_logs_no_update" on public.audit_logs;
create policy "audit_logs_no_update"
  on public.audit_logs for update to authenticated
  using (false);

drop policy if exists "audit_logs_no_delete" on public.audit_logs;
create policy "audit_logs_no_delete"
  on public.audit_logs for delete to authenticated
  using (false);

-- profiles select: active same clinic (update Fase 0 policy wording)
drop policy if exists "profiles_select_own_or_same_clinic" on public.profiles;
create policy "profiles_select_own_or_same_clinic"
  on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1
      from public.clinic_members me
      join public.clinic_members other on other.clinic_id = me.clinic_id
      where me.user_id = auth.uid()
        and me.status = 'active'
        and other.user_id = profiles.id
        and other.status in ('invited', 'active', 'suspended')
    )
  );
