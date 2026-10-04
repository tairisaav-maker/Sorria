-- Sorria — Reestruturação Subfase 2
-- Compras, movimentações, lotes, custo médio ponderado.
-- Sem baixa automática por procedimento.

insert into public.permissions (key, name, description, category) values
  ('inventory.movements_view', 'Ver movimentações', 'Histórico de entradas/saídas', 'inventory'),
  ('inventory.cost_view', 'Ver custos de estoque', 'Custo médio e valor estimado', 'inventory')
on conflict (key) do nothing;

select public.grant_permissions('owner', array[
  'inventory.movements_view', 'inventory.cost_view',
  'inventory.adjust', 'inventory.purchase_create'
]);
select public.grant_permissions('dentist', array[
  'inventory.view', 'inventory.movements_view'
]);
select public.grant_permissions('secretary', array[
  'inventory.movements_view', 'inventory.cost_view',
  'inventory.adjust', 'inventory.purchase_create'
]);

do $$ begin
  if not exists (select 1 from pg_type where typname = 'inventory_movement_type') then
    create type public.inventory_movement_type as enum (
      'purchase',
      'initial_balance',
      'manual_adjustment',
      'loss',
      'expiration',
      'return',
      'correction',
      'procedure_consumption'
    );
  end if;
end $$;

create table if not exists public.inventory_purchases (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  supplier_name text,
  invoice_number text,
  purchase_date date not null,
  notes text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancelled_by uuid references auth.users (id),
  cancellation_reason text
);

create index if not exists inventory_purchases_clinic_idx
  on public.inventory_purchases (clinic_id, purchase_date desc);

create table if not exists public.inventory_purchase_items (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  inventory_purchase_id uuid not null references public.inventory_purchases (id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items (id),
  purchase_quantity numeric(14,4) not null check (purchase_quantity > 0),
  purchase_unit public.inventory_unit not null,
  units_per_purchase_unit_snapshot numeric(14,4) not null check (units_per_purchase_unit_snapshot > 0),
  consumption_quantity_received numeric(14,4) not null check (consumption_quantity_received > 0),
  total_cost numeric(12,2) not null check (total_cost >= 0),
  cost_per_purchase_unit numeric(12,4) not null check (cost_per_purchase_unit >= 0),
  cost_per_consumption_unit numeric(12,4) not null check (cost_per_consumption_unit >= 0),
  lot_number text,
  expiration_date date,
  created_at timestamptz not null default now()
);

create index if not exists inventory_purchase_items_purchase_idx
  on public.inventory_purchase_items (inventory_purchase_id);
create index if not exists inventory_purchase_items_item_idx
  on public.inventory_purchase_items (clinic_id, inventory_item_id);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items (id),
  movement_type public.inventory_movement_type not null,
  -- +entrada / -saída (sempre em unidade de consumo)
  quantity_delta numeric(14,4) not null,
  unit_cost_snapshot numeric(12,4),
  resulting_quantity numeric(14,4),
  reference_type text,
  reference_id uuid,
  reason text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  constraint inventory_movements_no_zero check (quantity_delta <> 0)
);

create index if not exists inventory_movements_clinic_idx
  on public.inventory_movements (clinic_id, created_at desc);
create index if not exists inventory_movements_item_idx
  on public.inventory_movements (inventory_item_id, created_at desc);

create table if not exists public.inventory_lots (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items (id),
  lot_number text,
  expiration_date date,
  quantity_received numeric(14,4) not null check (quantity_received > 0),
  quantity_remaining numeric(14,4) not null,
  unit_cost numeric(12,4) not null check (unit_cost >= 0),
  source_purchase_item_id uuid references public.inventory_purchase_items (id),
  created_at timestamptz not null default now()
);

create index if not exists inventory_lots_item_idx
  on public.inventory_lots (inventory_item_id, expiration_date);
create index if not exists inventory_lots_clinic_exp_idx
  on public.inventory_lots (clinic_id, expiration_date);

-- Cross-clinic guards
create or replace function public.enforce_purchase_item_tenant()
returns trigger language plpgsql as $$
declare
  purchase_clinic uuid;
  item_clinic uuid;
begin
  select clinic_id into purchase_clinic from public.inventory_purchases where id = new.inventory_purchase_id;
  select clinic_id into item_clinic from public.inventory_items where id = new.inventory_item_id;
  if purchase_clinic is null or item_clinic is null
     or purchase_clinic <> item_clinic or purchase_clinic <> new.clinic_id then
    raise exception 'CROSS_CLINIC_REFERENCE';
  end if;
  return new;
end;
$$;

drop trigger if exists inventory_purchase_items_tenant_trg on public.inventory_purchase_items;
create trigger inventory_purchase_items_tenant_trg
  before insert or update on public.inventory_purchase_items
  for each row execute function public.enforce_purchase_item_tenant();

create or replace function public.enforce_movement_tenant()
returns trigger language plpgsql as $$
declare
  item_clinic uuid;
begin
  select clinic_id into item_clinic from public.inventory_items where id = new.inventory_item_id;
  if item_clinic is null or item_clinic <> new.clinic_id then
    raise exception 'CROSS_CLINIC_REFERENCE';
  end if;
  return new;
end;
$$;

drop trigger if exists inventory_movements_tenant_trg on public.inventory_movements;
create trigger inventory_movements_tenant_trg
  before insert or update on public.inventory_movements
  for each row execute function public.enforce_movement_tenant();

alter table public.inventory_purchases enable row level security;
alter table public.inventory_purchase_items enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.inventory_lots enable row level security;

create policy inventory_purchases_select on public.inventory_purchases for select to authenticated
  using (public.has_permission(clinic_id, 'inventory.view'));
create policy inventory_purchases_insert on public.inventory_purchases for insert to authenticated
  with check (public.has_permission(clinic_id, 'inventory.purchase_create'));
create policy inventory_purchases_update on public.inventory_purchases for update to authenticated
  using (public.has_permission(clinic_id, 'inventory.purchase_create'))
  with check (public.has_permission(clinic_id, 'inventory.purchase_create'));

create policy inventory_purchase_items_select on public.inventory_purchase_items for select to authenticated
  using (public.has_permission(clinic_id, 'inventory.view'));
create policy inventory_purchase_items_write on public.inventory_purchase_items for all to authenticated
  using (public.has_permission(clinic_id, 'inventory.purchase_create'))
  with check (public.has_permission(clinic_id, 'inventory.purchase_create'));

create policy inventory_movements_select on public.inventory_movements for select to authenticated
  using (
    public.has_permission(clinic_id, 'inventory.movements_view')
    or public.has_permission(clinic_id, 'inventory.view')
  );
create policy inventory_movements_insert on public.inventory_movements for insert to authenticated
  with check (
    public.has_permission(clinic_id, 'inventory.adjust')
    or public.has_permission(clinic_id, 'inventory.purchase_create')
  );

create policy inventory_lots_select on public.inventory_lots for select to authenticated
  using (public.has_permission(clinic_id, 'inventory.view'));
create policy inventory_lots_write on public.inventory_lots for all to authenticated
  using (
    public.has_permission(clinic_id, 'inventory.purchase_create')
    or public.has_permission(clinic_id, 'inventory.adjust')
  )
  with check (
    public.has_permission(clinic_id, 'inventory.purchase_create')
    or public.has_permission(clinic_id, 'inventory.adjust')
  );

comment on table public.inventory_purchases is
  'Compras de estoque. Cancelamento gera movimentos compensatórios — nunca delete.';
comment on table public.inventory_movements is
  'Histórico imutável. quantity_delta: +entrada / -saída em unidade de consumo.';
comment on column public.inventory_purchase_items.units_per_purchase_unit_snapshot is
  'Snapshot da conversão no momento da compra.';
