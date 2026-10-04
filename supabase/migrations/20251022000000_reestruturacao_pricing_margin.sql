-- Sorria — Reestruturação Subfase 9
-- Preço, margem e comparação preço padrão × cobrado × custo.
-- CALCULAR ≠ RECOMENDAR AUTOMATICAMENTE.

insert into public.permissions (key, name, description, category) values
  ('procedure_pricing.view', 'Ver preços e margens', 'Análise de preço, margem e break-even', 'finance'),
  ('procedure_pricing.manage', 'Gerenciar precificação', 'Simulações persistidas e gestão de tabela', 'finance'),
  ('procedures.update_price', 'Atualizar preço padrão', 'Alterar default_price com histórico', 'procedures'),
  ('reports.pricing_view', 'Relatório de preços e margens', 'Aba Preços e margens nos relatórios', 'reports')
on conflict (key) do nothing;

select public.grant_permissions('owner', array[
  'procedure_pricing.view',
  'procedure_pricing.manage',
  'procedures.update_price',
  'reports.pricing_view'
]);
select public.grant_permissions('dentist', array[
  'procedure_pricing.view',
  'reports.pricing_view'
]);

-- Histórico de preço padrão do catálogo
create table if not exists public.procedure_price_history (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  procedure_id uuid not null references public.procedures (id) on delete cascade,
  price numeric(12,2) not null check (price >= 0),
  valid_from timestamptz not null,
  valid_until timestamptz,
  changed_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create index if not exists procedure_price_history_proc_idx
  on public.procedure_price_history (clinic_id, procedure_id, valid_from desc);

create or replace function public.enforce_procedure_price_history_tenant()
returns trigger language plpgsql as $$
declare
  proc_clinic uuid;
begin
  select clinic_id into proc_clinic from public.procedures where id = new.procedure_id;
  if proc_clinic is null or proc_clinic <> new.clinic_id then
    raise exception 'CROSS_CLINIC_REFERENCE';
  end if;
  return new;
end;
$$;

drop trigger if exists procedure_price_history_tenant_trg on public.procedure_price_history;
create trigger procedure_price_history_tenant_trg
  before insert or update on public.procedure_price_history
  for each row execute function public.enforce_procedure_price_history_tenant();

alter table public.procedure_price_history enable row level security;

create policy procedure_price_history_select on public.procedure_price_history
  for select to authenticated
  using (
    clinic_id = public.current_clinic_id()
    and (
      public.has_permission('procedure_pricing.view')
      or public.has_permission('procedures.update_price')
      or public.has_permission('reports.pricing_view')
    )
  );

create policy procedure_price_history_insert on public.procedure_price_history
  for insert to authenticated
  with check (
    clinic_id = public.current_clinic_id()
    and (
      public.has_permission('procedures.update_price')
      or public.has_permission('procedure_pricing.manage')
    )
  );

-- Histórico não é reescrito silenciosamente
create policy procedure_price_history_no_update on public.procedure_price_history
  for update to authenticated
  using (false);

comment on table public.procedure_price_history is
  'Histórico de preço padrão do catálogo. Performed procedures usam standard_price_snapshot.';
comment on column public.performed_procedures.standard_price_snapshot is
  'Preço padrão no momento do registro — não muda com alteração do catálogo.';
