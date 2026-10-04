# Roadmap — Sorria

## Concluído

### FASE 0 — Fundação

- Next.js + TypeScript + Tailwind
- Supabase clients + auth
- Schema inicial clinics/profiles/clinic_members
- Login + shell + Home mock
- Docs iniciais

### FASE 1 — Usuários, equipe, papéis, permissões e segurança

- Roles / permissions / role_permissions
- Membership com status
- `can()` + guards
- RLS helpers (`has_permission`, etc.)
- Audit logs
- UI Equipe + Permissões
- Separação administrativo × clínico no modelo
- Testes de autorização (incl. cross-clinic e secretary sem clínico)

## Próximo

### FASE 2 — (aguardando definição)

Provável: agenda e solicitações de horário, ou pacientes administrativos — conforme nova instrução.

## Depois

1. Agenda / solicitações
2. Pacientes (cadastro administrativo)
3. Prontuário / anamnese / evoluções
4. Odontograma
5. Plano de tratamento
6. Financeiro
7. Relatórios / exportações
8. Secretária Virtual
9. Portal do Paciente

## Fora da V1

- Teleconsulta, marketplace, app nativo, diagnóstico/prescrição por IA
