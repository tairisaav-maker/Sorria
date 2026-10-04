# Database — Sorria

## Migrations

1. `20251004000000_fase0_foundation.sql`
2. `20251005000000_fase1_authz_equipe.sql`
3. `20251006000000_fase2_patients.sql`
4. `20251007000000_fase3_agenda.sql`
5. `20251008000000_fase4_prontuario.sql`
6. `20251009000000_fase5_treatments.sql`
7. `20251010000000_fase6_financeiro.sql`
8. `20251011000000_fase7_portal.sql`
9. `20251012000000_fase8_relatorios.sql`

## Fase 6 — Financeiro

### `financial_transactions`

| Coluna | Notas |
| --- | --- |
| type | income \| expense |
| patient_id / treatment_plan_id / appointment_id | opcionais; mesma clínica |
| gross_amount / discount_amount / net_amount | `numeric(12,2)`; net = gross − discount |
| status | derivado: pending / partially_paid / paid / overdue / cancelled |
| due_date | |
| cancelled_at / cancelled_by / cancellation_reason | soft cancel |
| notes | administrativo |

### `payment_installments`

`installment_number`, `amount`, `due_date`, `status` (derivado)  
`unique (financial_transaction_id, installment_number)`

### `payments`

Dinheiro efetivo: `amount`, `paid_at`, `payment_method`  
`client_request_id` único por clínica (idempotência)  
`reversed_at / reversed_by / reversal_reason` — sem DELETE

### Índices

- transactions: clinic+created, clinic+patient, clinic+type, clinic+due
- installments: tx+number, clinic+due
- payments: clinic+paid_at, installment, tx, unique parcial client_request_id

### Arredondamento de parcelas

```text
base = floor(total_cents / n)
parcelas[0..n-2] = base
parcela[n-1] = total_cents - base*(n-1)
```

App demo: centavos inteiros. SQL: `numeric(12,2)`.

## Fase 5 — Tratamentos

`treatment_plans` · `treatment_items` · `treatment_item_teeth` · `treatment_plan_versions`

## Fase 7 — Portal

### `patient_portal_access`

| Coluna | Notas |
| --- | --- |
| clinic_id / patient_id / auth_user_id | vínculo explícito N:N |
| status | invited \| active \| revoked |
| invited_at / activated_at / revoked_at | |

Unique `(clinic_id, patient_id, auth_user_id)`.  
Índices: `auth_user_id+status`, `clinic_id+patient_id+status`.

### `appointment_requests` (evolução)

- `request_type`: new_appointment \| reschedule \| cancellation
- `related_appointment_id` (nullable)

### `record_copy_requests`

status: requested → preparing → available → delivered \| cancelled

### `portal_notifications`

Notificações internas do Portal (sem push externo).

### Helpers RLS

`has_active_portal_access(clinic_id, patient_id)` · `my_portal_patient_ids()`


## Fase 8 — Relatórios

Sem novas tabelas de fatos. Permissões:

- `reports.view`
- `reports.view_schedule`
- `reports.view_patients`
- `reports.view_treatments`
- `reports.view_financial`
- `reports.export`

Agregações no serviço da aplicação (demo) / SQL futuro; sem materialized views nesta fase.
