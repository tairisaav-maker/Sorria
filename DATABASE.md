# Database — Sorria

## Migration Fase 0

Arquivo: `supabase/migrations/20251004000000_fase0_foundation.sql`

## Tabelas

### `clinics`

Clínica usuária do sistema. Campo `name` é configurável e **não** faz parte da marca Sorria.

| Coluna | Tipo | Notas |
| --- | --- | --- |
| id | uuid | PK |
| name | text | Nome da clínica |
| slug | text | único, opcional |
| timezone | text | default `America/Sao_Paulo` |
| phone/email/address/city/state | text | opcionais |
| is_active | boolean | |
| created_at / updated_at | timestamptz | |

### `profiles`

1:1 com `auth.users`.

| Coluna | Tipo | Notas |
| --- | --- | --- |
| id | uuid | PK = `auth.users.id` |
| full_name | text | |
| email | text | |
| phone | text | |
| avatar_url | text | |
| created_at / updated_at | timestamptz | |

Trigger `handle_new_user` cria/atualiza o perfil no signup.

### `clinic_members`

Vínculo multi-clínica.

| Coluna | Tipo | Notas |
| --- | --- | --- |
| id | uuid | PK |
| clinic_id | uuid | FK → clinics |
| user_id | uuid | FK → profiles |
| role | clinic_role | `owner`, `dentist`, `secretary`, `staff` |
| is_active | boolean | |
| invited_by | uuid | opcional |
| created_at / updated_at | timestamptz | |
| unique(clinic_id, user_id) | | |

## Helpers

- `is_clinic_member(clinic_id)`
- `is_clinic_owner(clinic_id)`
- `user_clinic_ids()`

## Seed demo

Insere a clínica fictícia `Clínica Demo Sorria` (`11111111-1111-1111-1111-111111111111`).

## Próximas entidades (fora da Fase 0)

patients, appointments, appointment_requests, clinical_records, odontogram, treatment_plans, payments, audit_logs — todas com `clinic_id`.
