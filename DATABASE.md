# Database — Sorria

## Migrations

1. `20251004000000_fase0_foundation.sql`
2. `20251005000000_fase1_authz_equipe.sql`
3. `20251006000000_fase2_patients.sql`

## Tabela `patients` (Fase 2)

Cadastro **administrativo** apenas. Sem alergias, diagnósticos, evoluções ou odontograma.

| Coluna | Tipo | Notas |
| --- | --- | --- |
| id | uuid | PK |
| clinic_id | uuid | tenant |
| full_name | text | obrigatório |
| preferred_name | text | opcional |
| cpf / cpf_normalized | text | opcional; normalizado só dígitos |
| birth_date | date | idade calculada na app |
| phone / phone_normalized | text | opcional |
| secondary_phone / secondary_phone_normalized | text | opcional |
| email / email_normalized | text | opcional; lower(trim) |
| endereço (postal_code…state) | text | opcional; CEP manual nesta fase |
| guardian_* | text | responsável |
| emergency_contact_* | text | emergência |
| referral_source | text | origem |
| administrative_notes | text | **não clínico** |
| status | patient_status | `active` \| `inactive` \| `archived` |
| created_by | uuid | |
| created_at / updated_at / archived_at | timestamptz | |

### Decisão: colunas normalizadas

Mantidas `cpf_normalized`, `phone_normalized`, `secondary_phone_normalized`, `email_normalized` porque:

- busca aceita valor mascarado ou cru;
- duplicidade precisa de comparação estável;
- índices parciais ficam simples.

Formatação ocorre só na UI.

### Status

Somente cadastrais: **Ativo / Inativo / Arquivado**.

Estados derivados (em tratamento, inadimplente…) virão de outros módulos — não são status manuais.

### Constraints / índices

- Unique parcial `(clinic_id, cpf_normalized)` onde CPF preenchido e status ≠ archived
- `(clinic_id, status)`, `(clinic_id, updated_at desc)`, `(clinic_id, full_name)`
- `(clinic_id, phone_normalized)`, `(clinic_id, email_normalized)` parciais
- GIN trigram em `full_name` e `preferred_name` (extensão `pg_trgm`)

### RLS

- SELECT: membership ativo + `patients.demographics.view`
- INSERT: `patients.demographics.create`
- UPDATE: demographics/contact/administrative update
- DELETE: negado (arquivar via status)

## Tabelas Fase 0/1

Ver migrations anteriores: `clinics`, `profiles`, `clinic_members`, `roles`, `permissions`, `role_permissions`, `audit_logs`.
