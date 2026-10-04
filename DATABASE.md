# Database — Sorria

## Migrations

1. `supabase/migrations/20251004000000_fase0_foundation.sql`
2. `supabase/migrations/20251005000000_fase1_authz_equipe.sql`

## Tabelas Fase 1

### `roles`

| Coluna | Tipo | Notas |
| --- | --- | --- |
| id | uuid | PK |
| key | text | unique: owner, dentist, secretary, patient |
| name | text | |
| description | text | |
| is_system | boolean | não apagar pela UI |
| created_at | timestamptz | |

### `permissions`

| Coluna | Tipo | Notas |
| --- | --- | --- |
| id | uuid | PK |
| key | text | unique (ação) |
| name / description | text | |
| category | text | |
| created_at | timestamptz | |

### `role_permissions`

PK composta `(role_id, permission_id)`.

### `clinic_members` (evoluído)

| Coluna | Tipo | Notas |
| --- | --- | --- |
| id | uuid | PK |
| clinic_id | uuid | FK |
| user_id | uuid | FK |
| role_id | uuid | FK → roles |
| status | membership_status | invited/active/suspended/revoked |
| invited_at / joined_at / suspended_at | timestamptz | |
| unique(clinic_id, user_id) | | |

Legado Fase 0 (`role` enum, `is_active`) é migrado e removido nesta migration.

### `audit_logs`

Append-only (sem UPDATE/DELETE via RLS). Sem senhas/tokens/secrets.

## Helpers

- `is_active_clinic_member(clinic_id)`
- `is_clinic_member(clinic_id)` → ativo
- `is_clinic_owner(clinic_id)`
- `has_role(clinic_id, role_key)`
- `has_permission(clinic_id, permission_key)`
- `user_clinic_ids()`
- `count_active_owners(clinic_id)`

## Índices

- `clinic_members(clinic_id, status)`
- `clinic_members(user_id)`
- `clinic_members(role_id)`
- `role_permissions(role_id)` / `(permission_id)`
- `audit_logs(clinic_id, created_at desc)`

## Separação de domínio

Permissões `patients.*` (administrativo) e `clinical_*` / `anamnesis.*` /
`odontogram.*` / `clinical_files.*` são independentes no seed.
