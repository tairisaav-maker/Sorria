# Database — Sorria

## Migrations

1. `20251004000000_fase0_foundation.sql`
2. `20251005000000_fase1_authz_equipe.sql`
3. `20251006000000_fase2_patients.sql`
4. `20251007000000_fase3_agenda.sql`
5. `20251008000000_fase4_prontuario.sql`
6. `20251009000000_fase5_treatments.sql`

## Fase 5 — Planos de tratamento

### `treatment_plans`

| Coluna | Notas |
| --- | --- |
| clinic_id / patient_id | Tenant + paciente (mesma clínica) |
| title, description, notes | `notes` = interno (não expor ao paciente) |
| status | draft / presented / accepted / in_progress / completed / rejected |
| version_number | Incrementa em revisão material |
| subtotal_amount / total_amount | `numeric(12,2)` — nunca float |
| discount_type / discount_value | percent \| fixed |
| valid_until | Opcional; vencido ≠ recusado |
| presented_by / presented_at | |
| accepted_at / accepted_version | Aceite amarra à versão |
| rejected_at / rejection_reason | Motivo opcional |
| archived_at | Soft archive futuro |

### `treatment_items`

Procedimento, quantidade, `unit_price`/`total_price` (`numeric(12,2)`), status, `sort_order`,  
`source_odontogram_entry_id`, `source_clinical_entry_id` (validados: mesma clínica + paciente).

### `treatment_item_teeth`

M:N item ↔ dentes FDI (`tooth_number` 11–48).  
Procedimento pode ter 0, 1 ou N dentes.

### `treatment_plan_versions`

Snapshot imutável na apresentação: itens, valores, desconto, total, responsável, data.  
`unique (treatment_plan_id, version_number)`.

### Índices

- `treatment_plans (clinic_id, patient_id, created_at desc)`
- `treatment_plans (clinic_id, status)`
- `treatment_items (treatment_plan_id, sort_order)`
- `treatment_items (clinic_id, patient_id)`

### Estratégia monetária no app demo

Demo store usa centavos inteiros (`*_cents`). SQL usa `numeric(12,2)`. Conversão na borda.

## Fase 4 — Prontuário

### `clinic_members.clinical_access`

Opt-in de acesso clínico. Owner sem flag não acessa prontuário.

### `anamneses` / `anamnesis_answers` / `clinical_entries` / `clinical_entry_versions` / `odontogram_entries` / `attachments`

Ver migrations Fase 4. Storage privado `clinical-files`.
