-- Sorria — Reestruturação Subfase 7
-- Reposição inteligente + listas de compras.
-- RECOMENDAR ≠ COMPRAR. Lista não altera estoque.

insert into public.permissions (key, name, description, category) values
  ('inventory.replenishment_view', 'Ver reposição', 'Necessidade de reposição e alertas', 'inventory'),
  ('inventory.purchase_list_create', 'Criar lista de compras', 'Montar lista a partir da reposição', 'inventory'),
  ('inventory.purchase_list_update', 'Editar lista de compras', 'Atualizar, cancelar ou converter lista', 'inventory')
on conflict (key) do nothing;

select public.grant_permissions('owner', array[
  'inventory.replenishment_view',
  'inventory.purchase_list_create',
  'inventory.purchase_list_update'
]);
select public.grant_permissions('dentist', array[
  'inventory.replenishment_view'
]);
select public.grant_permissions('secretary', array[
  'inventory.replenishment_view',
  'inventory.purchase_list_create',
  'inventory.purchase_list_update'
]);

do $$ begin
  if not exists (select 1 from pg_type where typname = 'purchase_list_status') then
    create type public.purchase_list_status as enum (
      'draft',
      'ready',
      'partially_purchased',
      'completed',
      'cancelled'
    );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'purchase_list_item_status') then
    create type public.purchase_list_item_status as enum (
      'pending',
      'purchased',
      'skipped',
      'cancelled'
    );
  end if;
end $$;

create table if not exists public.purchase_lists (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  status public.purchase_list_status not null default 'draft',
  estimated_total numeric(12,2),
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists purchase_lists_clinic_idx
  on public.purchase_lists (clinic_id, status);
create index if not exists purchase_lists_clinic_created_idx
  on public.purchase_lists (clinic_id, created_at desc);

create table if not exists public.purchase_list_items (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  purchase_list_id uuid not null references public.purchase_lists (id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items (id),
  item_name_snapshot text not null,
  forecast_quantity numeric(14,4) not null default 0,
  minimum_quantity_snapshot numeric(14,4),
  current_quantity_snapshot numeric(14,4) not null,
  recommended_consumption_quantity numeric(14,4) not null default 0,
  recommended_purchase_packages numeric(14,4) not null default 0,
  selected_purchase_packages numeric(14,4) not null default 0,
  selected boolean not null default true,
  purchase_unit public.inventory_unit not null,
  consumption_unit public.inventory_unit not null,
  units_per_purchase_unit_snapshot numeric(14,4) not null
    check (units_per_purchase_unit_snapshot > 0),
  estimated_unit_purchase_cost numeric(12,4),
  estimated_total_cost numeric(12,2),
  status public.purchase_list_item_status not null default 'pending',
  notes text,
  inventory_purchase_item_id uuid references public.inventory_purchase_items (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists purchase_list_items_list_idx
  on public.purchase_list_items (purchase_list_id);
create index if not exists purchase_list_items_item_idx
  on public.purchase_list_items (clinic_id, inventory_item_id);
create index if not exists purchase_list_items_purchase_link_idx
  on public.purchase_list_items (inventory_purchase_item_id)
  where inventory_purchase_item_id is not null;

alter table public.purchase_lists enable row level security;
alter table public.purchase_list_items enable row level security;

create policy purchase_lists_tenant on public.purchase_lists
  for all using (
    clinic_id = public.current_clinic_id()
    and public.has_permission('inventory.replenishment_view')
  )
  with check (
    clinic_id = public.current_clinic_id()
    and (
      public.has_permission('inventory.purchase_list_create')
      or public.has_permission('inventory.purchase_list_update')
    )
  );

create policy purchase_list_items_tenant on public.purchase_list_items
  for all using (
    clinic_id = public.current_clinic_id()
    and public.has_permission('inventory.replenishment_view')
  )
  with check (
    clinic_id = public.current_clinic_id()
    and (
      public.has_permission('inventory.purchase_list_create')
      or public.has_permission('inventory.purchase_list_update')
    )
  );

-- Custos: leitura de estimated_* filtrada na aplicação (permission inventory.cost_view).
-- RLS não mascara colunas; API/demo omite valores sem permissão.
