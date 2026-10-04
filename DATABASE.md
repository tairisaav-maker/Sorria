# Database — Sorria

## Migrations

1. `20251004000000_fase0_foundation.sql`
2. `20251005000000_fase1_authz_equipe.sql`
3. `20251006000000_fase2_patients.sql`
4. `20251007000000_fase3_agenda.sql`

## Fase 3 — Agenda

### `appointment_requests`

Solicitação de horário. Nunca vira consulta automaticamente.

| Coluna | Tipo | Notas |
| --- | --- | --- |
| id | uuid | PK |
| clinic_id | uuid | tenant |
| patient_id | uuid | FK patients |
| requested_date | date | opcional |
| preferred_period | enum | morning / afternoon / evening |
| reason / custom_reason / notes | text | motivo ≠ diagnóstico |
| status | enum | new…cancelled |
| proposed_start_at / proposed_end_at | timestamptz | preenchidos na proposta |
| proposed_professional_id | uuid | |
| reviewed_by / reviewed_at | | |
| rejection_reason | text | |
| created_at / updated_at / cancelled_at | | |

### `appointments`

Consulta definitiva da agenda.

| Coluna | Tipo | Notas |
| --- | --- | --- |
| id | uuid | PK |
| clinic_id / patient_id / professional_id | uuid | tenant + FKs |
| appointment_request_id | uuid | nullable — vínculo opcional |
| start_at / end_at | timestamptz | `end_at > start_at` |
| reason / status / notes | | |
| estimated_value | numeric | opcional |
| created_by | uuid | |
| cancelled_at / cancellation_reason / cancelled_by | | |

**Canceladas não bloqueiam horário** (exclusão de overlap ignora `cancelled`).

### `appointment_status_history`

| Coluna | Tipo |
| --- | --- |
| id | uuid |
| appointment_id / clinic_id | uuid |
| from_status / to_status | enum |
| changed_by / reason | |
| created_at | timestamptz |

Alterações de horário/profissional também vão para `audit_logs` (`appointment.rescheduled`).

### Constraints / índices

- Check `end_at > start_at`
- Exclusion gist (quando disponível) para overlap por `(clinic_id, professional_id)` em status ≠ cancelled
- Índices: `(clinic_id, start_at)`, `(clinic_id, professional_id, start_at)`, `(clinic_id, patient_id)`, `(clinic_id, status)`
- Requests: `(clinic_id, status, created_at desc)`, `(patient_id)`

### RLS

Todas as três tabelas:

- auth obrigatório
- membership ativo na clínica
- permission apropriada (`appointments.*` / `appointment_requests.*`)
- isolamento por `clinic_id`

## Tabelas anteriores

Ver migrations Fase 0–2: `clinics`, `profiles`, `clinic_members`, `roles`, `permissions`, `patients`, `audit_logs`.
