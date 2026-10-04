-- Sorria — Reestruturação Subfase 5
-- Procedimento do paciente ↔ evolução ↔ valor cobrado ↔ financeiro (N:N)

-- Vínculo evolução → procedimento realizado
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'clinical_entries'
      and column_name = 'performed_procedure_id'
  ) then
    alter table public.clinical_entries
      add column performed_procedure_id uuid
        references public.performed_procedures (id);
  end if;
end $$;

create index if not exists clinical_entries_performed_procedure_idx
  on public.clinical_entries (performed_procedure_id)
  where performed_procedure_id is not null;

-- Status financeiro do procedimento + observação de cobrança
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'performed_procedures'
      and column_name = 'financial_status'
  ) then
    alter table public.performed_procedures
      add column financial_status text not null default 'pending_charge'
        check (financial_status in (
          'pending_charge', 'charged', 'no_charge', 'included_in_plan'
        )),
      add column charge_note text;
  end if;
end $$;

create index if not exists performed_procedures_completed_idx
  on public.performed_procedures (clinic_id, completed_at desc)
  where completed_at is not null;

-- N:N procedimento ↔ cobrança
create table if not exists public.performed_procedure_financial_links (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics (id) on delete cascade,
  performed_procedure_id uuid not null references public.performed_procedures (id) on delete cascade,
  financial_transaction_id uuid not null references public.financial_transactions (id) on delete cascade,
  amount_allocated numeric(12,2) not null check (amount_allocated >= 0),
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled_at timestamptz,
  unique (performed_procedure_id, financial_transaction_id)
);

create index if not exists pp_fin_links_procedure_idx
  on public.performed_procedure_financial_links (performed_procedure_id)
  where cancelled_at is null;
create index if not exists pp_fin_links_transaction_idx
  on public.performed_procedure_financial_links (financial_transaction_id)
  where cancelled_at is null;

create or replace function public.enforce_pp_financial_link_tenant()
returns trigger language plpgsql as $$
declare
  pp_clinic uuid;
  pp_patient uuid;
  tx_clinic uuid;
  tx_patient uuid;
begin
  select clinic_id, patient_id into pp_clinic, pp_patient
    from public.performed_procedures where id = new.performed_procedure_id;
  select clinic_id, patient_id into tx_clinic, tx_patient
    from public.financial_transactions where id = new.financial_transaction_id;
  if pp_clinic is null or tx_clinic is null
     or pp_clinic <> new.clinic_id or tx_clinic <> new.clinic_id
     or (tx_patient is not null and pp_patient <> tx_patient) then
    raise exception 'CROSS_CLINIC_REFERENCE';
  end if;
  return new;
end;
$$;

drop trigger if exists pp_financial_links_tenant_trg on public.performed_procedure_financial_links;
create trigger pp_financial_links_tenant_trg
  before insert or update on public.performed_procedure_financial_links
  for each row execute function public.enforce_pp_financial_link_tenant();

create or replace function public.enforce_clinical_entry_performed_tenant()
returns trigger language plpgsql as $$
declare
  pp_clinic uuid;
  pp_patient uuid;
begin
  if new.performed_procedure_id is null then
    return new;
  end if;
  select clinic_id, patient_id into pp_clinic, pp_patient
    from public.performed_procedures where id = new.performed_procedure_id;
  if pp_clinic is null or pp_clinic <> new.clinic_id or pp_patient <> new.patient_id then
    raise exception 'CROSS_CLINIC_REFERENCE';
  end if;
  return new;
end;
$$;

drop trigger if exists clinical_entries_performed_tenant_trg on public.clinical_entries;
create trigger clinical_entries_performed_tenant_trg
  before insert or update on public.clinical_entries
  for each row execute function public.enforce_clinical_entry_performed_tenant();

alter table public.performed_procedure_financial_links enable row level security;

create policy pp_fin_links_select on public.performed_procedure_financial_links
  for select to authenticated
  using (
    public.has_permission(clinic_id, 'performed_procedures.view')
    and (
      public.has_permission(clinic_id, 'finance.view_authorized')
      or public.has_permission(clinic_id, 'finance.view_administrative')
    )
  );
create policy pp_fin_links_insert on public.performed_procedure_financial_links
  for insert to authenticated
  with check (
    public.has_permission(clinic_id, 'performed_procedures.update')
    and public.has_permission(clinic_id, 'finance.transaction_create')
  );
create policy pp_fin_links_update on public.performed_procedure_financial_links
  for update to authenticated
  using (public.has_permission(clinic_id, 'performed_procedures.update'))
  with check (public.has_permission(clinic_id, 'performed_procedures.update'));

comment on table public.performed_procedure_financial_links is
  'Alocação N:N procedimento realizado ↔ cobrança (amount_allocated). Rateio de pagamentos é analítico.';
