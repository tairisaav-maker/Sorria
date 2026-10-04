-- Sorria — Reestruturação Subfase 1
-- Catálogo de procedures + inventory_items + procedure_materials
-- Sem baixa automática, compras completas ou previsão de agenda.

insert into public.permissions (key, name, description, category) values
  ('procedures.view', 'Ver procedimentos', 'Listar e visualizar catálogo', 'procedures'),
  ('procedures.create', 'Criar procedimentos', 'Criar procedimentos no catálogo', 'procedures'),
  ('procedures.update', 'Editar procedimentos', 'Editar/arquivar procedimentos', 'procedures'),
  ('procedure_costs.view', 'Ver custos de procedimento', 'Ver ficha técnica e custos', 'procedures'),
  ('procedure_costs.update', 'Editar custos de procedimento', 'Editar materiais da ficha', 'procedures'),
  ('procedure_consumption.view', 'Ver consumo', 'Ver consumo previsto/real', 'procedures'),
  ('procedure_consumption.confirm', 'Confirmar consumo', 'Confirmar baixa de materiais', 'procedures'),
  ('inventory.view', 'Ver estoque', 'Listar itens de estoque', 'inventory'),
  ('inventory.create', 'Criar itens de estoque', 'Cadastrar itens', 'inventory'),
  ('inventory.update', 'Editar itens de estoque', 'Atualizar itens', 'inventory'),
  ('inventory.adjust', 'Ajustar estoque', 'Ajustes manuais com motivo', 'inventory'),
  ('inventory.purchase_create', 'Registrar compras', 'Entradas de estoque', 'inventory'),
  ('cost_reports.view', 'Relatórios de custo', 'Indicadores de custo/margem', 'reports')
on conflict (key) do nothing;

select public.grant_permissions('owner', array[
  'procedures.view','procedures.create','procedures.update',
  'procedure_costs.view','procedure_costs.update',
  'procedure_consumption.view','procedure_consumption.confirm',
  'inventory.view','inventory.create','inventory.update','inventory.adjust','inventory.purchase_create',
  'cost_reports.view'
]);
select public.grant_permissions('dentist', array[
  'procedures.view','procedures.create','procedures.update',
  'procedure_costs.view','procedure_consumption.view','procedure_consumption.confirm',
  'inventory.view'
]);
select public.grant_permissions('secretary', array[
  'procedures.view',
  'inventory.view','inventory.create','inventory.update','inventory.purchase_create'
]);

do $$ begin
  if not exists (select 1 from pg_type where typname = 'inventory_unit') then
    create type public.inventory_unit as enum (
      'un','par','caixa','pacote','seringa','tubete','capsula','dose','ml','L','g','kg','rolo','outro'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'consumption_mode') then
    create type public.consumption_mode as enum (
      'per_appointment','per_procedure','per_unit','manual'
    );
  end if;
end $$;

create table if not exists public.procedures (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  name text not null,
  description text,
  category text,
  default_duration_minutes integer check (default_duration_minutes is null or default_duration_minutes > 0),
  default_price numeric(12,2) check (default_price is null or default_price >= 0),
  active boolean not null default true,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create index if not exists procedures_clinic_idx on public.procedures (clinic_id, active, name);

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  name text not null,
  category text,
  purchase_unit public.inventory_unit not null default 'un',
  consumption_unit public.inventory_unit not null default 'un',
  units_per_purchase_unit numeric(14,4) not null default 1 check (units_per_purchase_unit > 0),
  current_quantity numeric(14,4) not null default 0,
  minimum_quantity numeric(14,4),
  average_unit_cost numeric(12,4) not null default 0 check (average_unit_cost >= 0),
  last_purchase_cost numeric(12,4),
  supplier_name text,
  tracks_lot boolean not null default false,
  tracks_expiration boolean not null default false,
  active boolean not null default true,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create index if not exists inventory_items_clinic_idx
  on public.inventory_items (clinic_id, active, name);

create table if not exists public.procedure_materials (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  procedure_id uuid not null references public.procedures (id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items (id),
  standard_quantity numeric(14,4) not null check (standard_quantity >= 0),
  consumption_unit public.inventory_unit not null,
  consumption_mode public.consumption_mode not null default 'per_procedure',
  optional boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (procedure_id, inventory_item_id)
);

create index if not exists procedure_materials_proc_idx
  on public.procedure_materials (clinic_id, procedure_id);

-- Cross-clinic guard: procedure, item and row must share clinic_id
create or replace function public.enforce_procedure_material_tenant()
returns trigger
language plpgsql
as $$
declare
  proc_clinic uuid;
  item_clinic uuid;
begin
  select clinic_id into proc_clinic from public.procedures where id = new.procedure_id;
  select clinic_id into item_clinic from public.inventory_items where id = new.inventory_item_id;
  if proc_clinic is null or item_clinic is null or proc_clinic <> item_clinic or proc_clinic <> new.clinic_id then
    raise exception 'CROSS_CLINIC_REFERENCE';
  end if;
  return new;
end;
$$;

drop trigger if exists procedure_materials_tenant_trg on public.procedure_materials;
create trigger procedure_materials_tenant_trg
  before insert or update on public.procedure_materials
  for each row execute function public.enforce_procedure_material_tenant();

alter table public.procedures enable row level security;
alter table public.inventory_items enable row level security;
alter table public.procedure_materials enable row level security;

create policy procedures_select on public.procedures for select to authenticated
  using (public.has_permission(clinic_id, 'procedures.view'));
create policy procedures_insert on public.procedures for insert to authenticated
  with check (public.has_permission(clinic_id, 'procedures.create'));
create policy procedures_update on public.procedures for update to authenticated
  using (public.has_permission(clinic_id, 'procedures.update'))
  with check (public.has_permission(clinic_id, 'procedures.update'));

create policy inventory_select on public.inventory_items for select to authenticated
  using (public.has_permission(clinic_id, 'inventory.view'));
create policy inventory_insert on public.inventory_items for insert to authenticated
  with check (public.has_permission(clinic_id, 'inventory.create'));
create policy inventory_update on public.inventory_items for update to authenticated
  using (public.has_permission(clinic_id, 'inventory.update'))
  with check (public.has_permission(clinic_id, 'inventory.update'));

create policy procedure_materials_select on public.procedure_materials for select to authenticated
  using (
    public.has_permission(clinic_id, 'procedures.view')
    or public.has_permission(clinic_id, 'procedure_costs.view')
  );
create policy procedure_materials_write on public.procedure_materials for all to authenticated
  using (public.has_permission(clinic_id, 'procedure_costs.update'))
  with check (public.has_permission(clinic_id, 'procedure_costs.update'));

comment on table public.procedures is
  'Catálogo de procedimentos da clínica — distinto de treatment_items (plano do paciente).';
comment on table public.inventory_items is
  'Itens de estoque. current_quantity sempre em unidade de consumo.';
comment on table public.procedure_materials is
  'Ficha técnica: materiais padrão por procedimento.';
