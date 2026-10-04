-- Sorria — Reestruturação Subfase 8
-- Despesas gerais, custo/hora clínica e custo operacional do procedimento.
-- Custeio gerencial simples — NÃO é contabilidade oficial.

insert into public.permissions (key, name, description, category) values
  ('clinic_costs.view', 'Ver custos do consultório', 'Despesas alocáveis, horas e custo/hora', 'finance'),
  ('clinic_costs.manage', 'Configurar custos', 'Horas produtivas, templates e elegibilidade', 'finance'),
  ('operational_costs.view', 'Ver custo/hora operacional', 'Composição e snapshot mensal', 'finance'),
  ('procedure_operational_costs.view', 'Ver custo operacional do procedimento', 'Tempo + materiais + resultado operacional', 'finance'),
  ('expense_categories.manage', 'Gerenciar categorias de despesa', 'Metadados de custeio em despesas', 'finance'),
  ('cost_reports.view', 'Relatórios de custo operacional', 'Cobertura e comparativos operacionais', 'reports')
on conflict (key) do nothing;

select public.grant_permissions('owner', array[
  'clinic_costs.view',
  'clinic_costs.manage',
  'operational_costs.view',
  'procedure_operational_costs.view',
  'expense_categories.manage',
  'cost_reports.view'
]);
select public.grant_permissions('dentist', array[
  'procedure_operational_costs.view',
  'cost_reports.view'
]);
select public.grant_permissions('secretary', array[
  'expense_categories.manage'
]);

-- Metadados de custeio em financial_transactions (reuso — não criar ledger paralelo)
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'financial_transactions'
      and column_name = 'cost_behavior'
  ) then
    alter table public.financial_transactions
      add column cost_behavior text
        check (cost_behavior is null or cost_behavior in ('fixed', 'variable')),
      add column recurrence_type text
        check (recurrence_type is null or recurrence_type in ('recurring', 'one_time')),
      add column allocation_eligible boolean,
      add column reference_month text
        check (reference_month is null or reference_month ~ '^\d{4}-\d{2}$'),
      add column competence_date date;
  end if;
end $$;

create index if not exists financial_transactions_expense_month_idx
  on public.financial_transactions (clinic_id, reference_month)
  where type = 'expense' and cancelled_at is null;

-- Configuração de custeio da clínica
create table if not exists public.clinic_cost_settings (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  calculation_mode text not null default 'manual_productive_hours'
    check (calculation_mode in ('manual_productive_hours', 'schedule_capacity')),
  monthly_productive_hours numeric(8,2)
    check (monthly_productive_hours is null or monthly_productive_hours > 0),
  planned_utilization_percent numeric(5,2)
    check (
      planned_utilization_percent is null
      or (planned_utilization_percent >= 1 and planned_utilization_percent <= 100)
    ),
  include_owner_compensation boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id)
);

-- Templates de despesa recorrente (≠ pagamento realizado)
create table if not exists public.recurring_expense_templates (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  name text not null,
  category text not null,
  amount numeric(12,2) not null check (amount >= 0),
  cost_behavior text not null default 'fixed'
    check (cost_behavior in ('fixed', 'variable')),
  recurrence text not null default 'monthly'
    check (recurrence in ('monthly')),
  allocation_eligible boolean not null default true,
  active boolean not null default true,
  start_date date not null,
  end_date date,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists recurring_expense_templates_clinic_idx
  on public.recurring_expense_templates (clinic_id, active);

-- Snapshot mensal de custo/hora (histórico imutável após criação)
create table if not exists public.clinic_hourly_cost_snapshots (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  reference_month text not null
    check (reference_month ~ '^\d{4}-\d{2}$'),
  allocatable_cost numeric(12,2) not null check (allocatable_cost >= 0),
  productive_hours numeric(8,2) not null check (productive_hours > 0),
  hourly_cost numeric(12,4) not null check (hourly_cost >= 0),
  calculation_method text not null
    check (calculation_method in ('manual_productive_hours', 'schedule_capacity')),
  created_at timestamptz not null default now(),
  unique (clinic_id, reference_month)
);

create index if not exists clinic_hourly_cost_snapshots_clinic_idx
  on public.clinic_hourly_cost_snapshots (clinic_id, reference_month desc);

-- Campos de custeio operacional no procedimento realizado
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'performed_procedures'
      and column_name = 'actual_duration_minutes'
  ) then
    alter table public.performed_procedures
      add column actual_duration_minutes integer
        check (actual_duration_minutes is null or actual_duration_minutes > 0),
      add column duration_source text
        check (
          duration_source is null
          or duration_source in ('actual', 'appointment', 'default', 'manual')
        ),
      add column productive_hour_cost_snapshot numeric(12,4),
      add column allocated_time_cost numeric(12,2),
      add column operational_total_cost numeric(12,2),
      add column operational_result numeric(12,2),
      add column operational_margin_percent numeric(8,2);
  end if;
end $$;

-- Preparação futura (sem complexidade V1): professional_cost_settings stub comentado
-- create table public.professional_cost_settings (...);

alter table public.clinic_cost_settings enable row level security;
alter table public.recurring_expense_templates enable row level security;
alter table public.clinic_hourly_cost_snapshots enable row level security;

create policy clinic_cost_settings_select on public.clinic_cost_settings
  for select to authenticated
  using (
    clinic_id = public.current_clinic_id()
    and (
      public.has_permission('clinic_costs.view')
      or public.has_permission('operational_costs.view')
    )
  );
create policy clinic_cost_settings_write on public.clinic_cost_settings
  for all to authenticated
  using (
    clinic_id = public.current_clinic_id()
    and public.has_permission('clinic_costs.manage')
  )
  with check (
    clinic_id = public.current_clinic_id()
    and public.has_permission('clinic_costs.manage')
  );

create policy recurring_expense_templates_select on public.recurring_expense_templates
  for select to authenticated
  using (
    clinic_id = public.current_clinic_id()
    and public.has_permission('clinic_costs.view')
  );
create policy recurring_expense_templates_write on public.recurring_expense_templates
  for all to authenticated
  using (
    clinic_id = public.current_clinic_id()
    and public.has_permission('clinic_costs.manage')
  )
  with check (
    clinic_id = public.current_clinic_id()
    and public.has_permission('clinic_costs.manage')
  );

create policy clinic_hourly_cost_snapshots_select on public.clinic_hourly_cost_snapshots
  for select to authenticated
  using (
    clinic_id = public.current_clinic_id()
    and (
      public.has_permission('operational_costs.view')
      or public.has_permission('clinic_costs.view')
    )
  );
create policy clinic_hourly_cost_snapshots_insert on public.clinic_hourly_cost_snapshots
  for insert to authenticated
  with check (
    clinic_id = public.current_clinic_id()
    and (
      public.has_permission('clinic_costs.manage')
      or public.has_permission('performed_procedures.complete')
    )
  );
-- Snapshots não são atualizados silenciosamente (histórico imutável).
create policy clinic_hourly_cost_snapshots_no_update on public.clinic_hourly_cost_snapshots
  for update to authenticated
  using (false);

comment on table public.clinic_cost_settings is
  'Configuração de horas produtivas e custeio operacional por clínica (V1: horas manuais).';
comment on table public.recurring_expense_templates is
  'Template recorrente ≠ pagamento. Entra na previsão de custo/hora se não houver despesa do mês.';
comment on table public.clinic_hourly_cost_snapshots is
  'Snapshot mensal de custo/hora. Procedimentos concluídos preservam o valor do mês.';
comment on column public.financial_transactions.allocation_eligible is
  'Se false, a despesa aparece como “Não incluída no custo/hora”.';
comment on column public.performed_procedures.productive_hour_cost_snapshot is
  'Custo/hora do mês de competência no momento da conclusão — não recalcular silencioso.';
