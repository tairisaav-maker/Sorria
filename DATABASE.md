# Database — Sorria

## Migrations

1. `20251004000000_fase0_foundation.sql`
2. `20251005000000_fase1_authz_equipe.sql`
3. `20251006000000_fase2_patients.sql`
4. `20251007000000_fase3_agenda.sql`
5. `20251008000000_fase4_prontuario.sql`
6. `20251009000000_fase5_treatments.sql`
7. `20251010000000_fase6_financeiro.sql`

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
