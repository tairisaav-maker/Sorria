# Architecture — Sorria

## Visão

Sorria é SaaS multi-clínica. A marca é independente; cada clínica é tenant (`clinic_id`).

## Identidade e autorização (Fase 1)

```text
Auth
  ↓
Profile
  ↓
Clinic Membership (status)
  ↓
Role
  ↓
Permissions
  ↓
Resource/Tenant Check
  ↓
RLS
  ↓
Data
```

### Camadas

1. **UI** — `can()` esconde ações
2. **Server/API** — `requirePermission` / `assertPermission`
3. **PostgreSQL RLS** — impede cross-clinic e escalonamento

### Domínios de paciente

- **Administrativo:** demographics, contact, administrative
- **Clínico:** clinical_record, anamnesis, clinical_evolution, odontogram, clinical_files

Acesso a um domínio **não** implica o outro.

## Estrutura relevante

```text
src/lib/permissions/   # keys, labels, matriz
src/lib/authz/         # can, guards, team-service
src/lib/demo/          # store demo Clinic A/B + papéis
src/app/app/configuracoes/equipe
src/app/app/configuracoes/permissoes
src/app/forbidden
supabase/migrations/
```

## Perfis

| Role | Escopo |
| --- | --- |
| owner | Admin da própria clínica |
| dentist | Profissional + clínico |
| secretary | Administrativo (sem clínico) |
| patient | Reservado (portal futuro) |

## Fora desta fase

Agenda funcional, lista de pacientes, prontuário, financeiro, portal, IA.
