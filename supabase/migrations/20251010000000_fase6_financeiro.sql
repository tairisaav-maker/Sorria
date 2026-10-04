-- Sorria FASE 6 — Financeiro V1
-- Plano ≠ Obrigação · Parcela ≠ Pagamento · Aceite ≠ Receita
-- Valores: numeric(12,2) — nunca float

insert into public.permissions (key, name, description, category)
values
  ('finance.transaction_create', 'Criar lançamento', 'Criar receitas/obrigações financeiras', 'finance'),
  ('finance.transaction_update', 'Atualizar lançamento', 'Atualizar ou cancelar lançamentos', 'finance'),
  ('finance.payment_reverse', 'Estornar pagamento', 'Estornar pagamentos com motivo', 'finance'),
  ('finance.expense_create', 'Criar despesa', 'Registrar despesas da clínica', 'finance'),
  ('finance.export', 'Exportar financeiro', 'Exportar PDF/XLSX/CSV financeiros', 'finance')
on conflict (key) do update
  set name = excluded.name,
      description = excluded.description;

select public.grant_permissions('owner', array[
  'finance.view_administrative','finance.transaction_create','finance.transaction_update',
  'finance.payment_create','finance.payment_reverse','finance.expense_create','finance.export'
]);

select public.grant_permissions('secretary', array[
  'finance.view_administrative','finance.transaction_create',
  'finance.payment_create','finance.payment_reverse','finance.expense_create','finance.export'
]);

-- Dentista mantém apenas finance.view_authorized (já concedido) — sem financeiro geral.

do $$ begin
  if not exists (select 1 from pg_type where typname = 'financial_transaction_type') then
    create type public.financial_transaction_type as enum ('income', 'expense');
  end if;
  if not exists (select 1 from pg_type where typname = 'financial_status') then
    create type public.financial_status as enum (
      'pending','partially_paid','paid','overdue','cancelled'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'payment_method') then
    create type public.payment_method as enum (
      'pix','cash','debit_card','credit_card','bank_transfer','other'
    );
  end if;
end $$;

create table if not exists public.financial_transactions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  patient_id uuid references public.patients (id) on delete restrict,
  treatment_plan_id uuid references public.treatment_plans (id) on delete set null,
  appointment_id uuid references public.appointments (id) on delete set null,

  type public.financial_transaction_type not null,
  description text not null,
  category text,

  gross_amount numeric(12, 2) not null check (gross_amount >= 0),
  discount_amount numeric(12, 2) not null default 0 check (discount_amount >= 0),
  net_amount numeric(12, 2) not null check (net_amount >= 0),

  status public.financial_status not null default 'pending',
  due_date date,
  notes text,

  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles (id) on delete set null,
  cancellation_reason text,

  constraint financial_transactions_discount_le_gross check (discount_amount <= gross_amount),
  constraint financial_transactions_net_consistent check (
    net_amount = gross_amount - discount_amount
  )
);

create index if not exists financial_transactions_clinic_created_idx
  on public.financial_transactions (clinic_id, created_at desc);
create index if not exists financial_transactions_clinic_patient_idx
  on public.financial_transactions (clinic_id, patient_id);
create index if not exists financial_transactions_clinic_type_idx
  on public.financial_transactions (clinic_id, type);
create index if not exists financial_transactions_clinic_due_idx
  on public.financial_transactions (clinic_id, due_date);

drop trigger if exists financial_transactions_set_updated_at on public.financial_transactions;
create trigger financial_transactions_set_updated_at
  before update on public.financial_transactions
  for each row execute function public.set_updated_at();

create table if not exists public.payment_installments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  financial_transaction_id uuid not null references public.financial_transactions (id) on delete cascade,
  installment_number integer not null check (installment_number > 0),
  amount numeric(12, 2) not null check (amount >= 0),
  due_date date not null,
  status public.financial_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (financial_transaction_id, installment_number)
);

create index if not exists payment_installments_tx_idx
  on public.payment_installments (financial_transaction_id, installment_number);
create index if not exists payment_installments_clinic_due_idx
  on public.payment_installments (clinic_id, due_date);

drop trigger if exists payment_installments_set_updated_at on public.payment_installments;
create trigger payment_installments_set_updated_at
  before update on public.payment_installments
  for each row execute function public.set_updated_at();

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  financial_transaction_id uuid not null references public.financial_transactions (id) on delete restrict,
  payment_installment_id uuid references public.payment_installments (id) on delete restrict,

  amount numeric(12, 2) not null check (amount > 0),
  paid_at timestamptz not null,
  payment_method public.payment_method not null,
  notes text,

  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  client_request_id text,

  reversed_at timestamptz,
  reversed_by uuid references public.profiles (id) on delete set null,
  reversal_reason text
);

create unique index if not exists payments_clinic_client_request_uidx
  on public.payments (clinic_id, client_request_id)
  where client_request_id is not null;

create index if not exists payments_clinic_paid_idx
  on public.payments (clinic_id, paid_at desc);
create index if not exists payments_installment_idx
  on public.payments (payment_installment_id);
create index if not exists payments_tx_idx
  on public.payments (financial_transaction_id);

alter table public.financial_transactions enable row level security;
alter table public.payment_installments enable row level security;
alter table public.payments enable row level security;

create or replace function public.can_view_finance(p_clinic_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_clinic_permission(p_clinic_id, 'finance.view_administrative')
      or public.has_clinic_permission(p_clinic_id, 'finance.view_authorized');
$$;

drop policy if exists financial_transactions_select on public.financial_transactions;
create policy financial_transactions_select on public.financial_transactions for select to authenticated
  using (public.can_view_finance(clinic_id));

drop policy if exists financial_transactions_insert on public.financial_transactions;
create policy financial_transactions_insert on public.financial_transactions for insert to authenticated
  with check (
    public.has_clinic_permission(clinic_id, 'finance.transaction_create')
    or public.has_clinic_permission(clinic_id, 'finance.expense_create')
  );

drop policy if exists financial_transactions_update on public.financial_transactions;
create policy financial_transactions_update on public.financial_transactions for update to authenticated
  using (
    public.has_clinic_permission(clinic_id, 'finance.transaction_update')
    or public.has_clinic_permission(clinic_id, 'finance.payment_create')
  )
  with check (
    public.has_clinic_permission(clinic_id, 'finance.transaction_update')
    or public.has_clinic_permission(clinic_id, 'finance.payment_create')
  );

drop policy if exists financial_transactions_delete on public.financial_transactions;
create policy financial_transactions_delete on public.financial_transactions for delete to authenticated
  using (false);

drop policy if exists payment_installments_select on public.payment_installments;
create policy payment_installments_select on public.payment_installments for select to authenticated
  using (public.can_view_finance(clinic_id));

drop policy if exists payment_installments_write on public.payment_installments;
create policy payment_installments_write on public.payment_installments for all to authenticated
  using (
    public.has_clinic_permission(clinic_id, 'finance.transaction_create')
    or public.has_clinic_permission(clinic_id, 'finance.transaction_update')
    or public.has_clinic_permission(clinic_id, 'finance.payment_create')
  )
  with check (
    public.has_clinic_permission(clinic_id, 'finance.transaction_create')
    or public.has_clinic_permission(clinic_id, 'finance.transaction_update')
    or public.has_clinic_permission(clinic_id, 'finance.payment_create')
  );

drop policy if exists payments_select on public.payments;
create policy payments_select on public.payments for select to authenticated
  using (public.can_view_finance(clinic_id));

drop policy if exists payments_insert on public.payments;
create policy payments_insert on public.payments for insert to authenticated
  with check (public.has_clinic_permission(clinic_id, 'finance.payment_create'));

drop policy if exists payments_update on public.payments;
create policy payments_update on public.payments for update to authenticated
  using (public.has_clinic_permission(clinic_id, 'finance.payment_reverse'))
  with check (public.has_clinic_permission(clinic_id, 'finance.payment_reverse'));

drop policy if exists payments_delete on public.payments;
create policy payments_delete on public.payments for delete to authenticated
  using (false);
