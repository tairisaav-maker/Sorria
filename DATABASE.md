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
10. `20251013000000_fase9_assistente.sql`
11. `20251014000000_fase10_producao.sql`
12. `20251015000000_reestruturacao_procedures_inventory.sql`
13. `20251016000000_reestruturacao_inventory_purchases.sql`
14. `20251017000000_reestruturacao_performed_procedures.sql`
15. `20251018000000_reestruturacao_appointment_planned_procedures.sql`
16. `20251019000000_reestruturacao_patient_procedure_finance.sql`
17. `20251020000000_reestruturacao_replenishment.sql`
18. `20251021000000_reestruturacao_operational_costing.sql`
19. `20251022000000_reestruturacao_pricing_margin.sql`
20. `20251023000000_subfase11_saas_billing.sql` — planos, entitlements, assinaturas, billing_events, convites

## Reestruturação Subfase 5 — Procedimento ↔ evolução ↔ financeiro

### `clinical_entries.performed_procedure_id`

Vínculo opcional evolução → procedimento realizado (mesmo paciente/clínica).

### `performed_procedures.financial_status` / `charge_note`

`pending_charge` | `charged` | `no_charge` | `included_in_plan`

### `performed_procedure_financial_links`

N:N procedimento ↔ `financial_transactions` com `amount_allocated`.  
Rateio de pagamentos é analítico (proporcional); pagamento continua na parcela.

## Reestruturação Subfase 4 — Procedimentos previstos / previsão

### `appointment_planned_procedures`

Procedimento previsto na Agenda (≠ performed). Índices em `appointment_id`, `procedure_id`, `(clinic_id, patient_id)`. Trigger `enforce_planned_procedure_tenant` bloqueia cross-clinic e paciente diferente da consulta.

### `performed_procedures.appointment_planned_procedure_id`

Link opcional planned → performed (conversão idempotente).

Previsão de materiais é **dinâmica** (sem tabela de snapshot de forecast); saldo físico não é reservado.

## Reestruturação Subfase 3 — Procedimento do paciente

### `performed_procedures`

Instância por paciente/consulta; snapshots de preço e custos; `treatment_item_id` opcional.

### `procedure_consumptions`

Snapshot exclusivo da ficha; previsto/real; `unit_cost_snapshot`; link a `inventory_movement`.

### `appointment_consumptions`

Materiais `per_appointment` — uma baixa física; custo rateado.

## Reestruturação Subfase 2 — Compras / Movimentos

### `inventory_purchases` / `inventory_purchase_items`

Compra com snapshot de conversão; cancelamento soft + movimentos compensatórios.

### `inventory_movements`

Histórico imutável; `quantity_delta` +/− em unidade de consumo; tipo inclui `procedure_consumption` (reservado).

### `inventory_lots`

Lotes/validades opcionais; ligados a purchase items quando aplicável.

## Reestruturação Subfase 1 — Procedures / Inventory

### `procedures`

Catálogo da clínica (≠ `treatment_items`). Preço `numeric(12,2)`; app usa centavos.

### `inventory_items`

Compra ≠ consumo: `purchase_unit`, `consumption_unit`, `units_per_purchase_unit`.  
`current_quantity` e `average_unit_cost` na unidade de consumo.

### `procedure_materials`

Ficha técnica: `standard_quantity`, `consumption_mode` (`per_appointment` | `per_procedure` | `per_unit` | `manual`).  
Trigger `enforce_procedure_material_tenant` bloqueia refs cross-clinic.

### RLS

Policies por `has_permission` (`procedures.*`, `inventory.*`, `procedure_costs.*`).

## Fase 9 — Secretária Virtual

### `assistant_threads` / `assistant_messages` / `assistant_action_plans`

- Tenant (`clinic_id`) + dono (`user_id`); RLS com `assistant.use`
- Action plans: status + `expires_at` (TTL); confirmação explícita antes de mutar

## Fase 10 — Produção

### `clinics` (extensão)

- `trade_name`, `logo_url`, `status`, `slot_minutes`, `hours_json`, `feature_flags`, `onboarding_json`

### `profiles` (extensão)

- `professional_name`, `cro`, `cro_uf`, `specialty`

### Índices

- `patients (clinic_id, created_at desc)`
- `appointments (clinic_id, start_at)`

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


## Subfase 9 — Preço e margem

Migration: `20251022000000_reestruturacao_pricing_margin.sql`

- `procedure_price_history` — preço padrão do catálogo com `valid_from` / `valid_until`
- Trigger cross-clinic: `procedure_id` deve ser da mesma clínica
- RLS: `procedure_pricing.view` / `procedures.update_price` / `reports.pricing_view`
- Histórico imutável (sem UPDATE); performed usa `standard_price_snapshot`
- Detalhes: [PRICING_AND_MARGIN.md](./PRICING_AND_MARGIN.md)

## Subfase 8 — Custeio operacional

Migration: `20251021000000_reestruturacao_operational_costing.sql`

- Metadados em `financial_transactions`: `cost_behavior`, `recurrence_type`, `allocation_eligible`, `reference_month`, `competence_date`
- `clinic_cost_settings` — horas produtivas / modo de cálculo (unique por clínica)
- `recurring_expense_templates` — previsão mensal (≠ pagamento)
- `clinic_hourly_cost_snapshots` — custo/hora mensal imutável após criação
- `performed_procedures`: `actual_duration_minutes`, `duration_source`, `productive_hour_cost_snapshot`, `allocated_time_cost`, `operational_total_cost`, `operational_result`, `operational_margin_percent`
- RLS: `clinic_id` + `clinic_costs.*` / `operational_costs.view` / `performed_procedures.complete` (insert snapshot)
- Detalhes: [OPERATIONAL_COSTING.md](./OPERATIONAL_COSTING.md)

## Subfase 7 — Reposição / listas de compras

Migration: `20251020000000_reestruturacao_replenishment.sql`

- `purchase_lists` — rascunho/pronta/parcial/concluída/cancelada; snapshots de período
- `purchase_list_items` — snapshots de estoque/mínimo/previsão/embalagem/preço; link opcional `inventory_purchase_item_id`
- RLS por `clinic_id` + `inventory.replenishment_view` / `purchase_list_*`
- Índices: `clinic_id+status`, `purchase_list_id`, `inventory_item_id`

Lista **não** altera `inventory_items.current_quantity`. Só a compra real (Subfase 2) move estoque.

## Fase 8 / Subfase 6 — Relatórios

Sem novas tabelas de fatos nem materialized views. Permissões:

- `reports.view`
- `reports.view_schedule`
- `reports.view_patients`
- `reports.view_treatments`
- `reports.view_financial`
- `reports.procedure_costs_view`
- `reports.materials_view`
- `reports.patient_financial_view`
- `reports.financial_view`
- `reports.export`

Agregações no serviço da aplicação (demo) / SQL futuro sobre:

- `performed_procedures` (`clinic_id`, `procedure_id`, `patient_id`, `completed_at`)
- `procedure_consumptions` (`inventory_item_id`, `confirmed_at`)
- `payments` (`paid_at`, exclui `reversed_at`)

Índices: criar somente após medição de performance.
