# Security — Sorria

## Princípios

**Deny by default · Least privilege · Defense in depth · Tenant isolation**

## Regra estrutural

**Administrative Patient Data ≠ Clinical Record Access**

Ter `patients.demographics.*` / `patients.contact.*` / `patients.administrative.*`
**não** concede `clinical_record.*`, `anamnesis.*`, `clinical_evolution.*`,
`odontogram.*` ou `clinical_files.*`.

A secretária, por padrão, tem acesso administrativo e **não** tem acesso clínico.

## Cadeia de autorização

```text
Auth → Profile → Clinic Membership (ativo) → Role → Permissions
  → Resource/Tenant check → RLS → Data
```

Camada de aplicação: `can(user, permission, context)`  
Guards: `requireAuth()`, `requireClinic()`, `requirePermission()`  
Banco: helpers + RLS

Nunca espalhar `role === "secretary"` pela UI/API.

## Papel no vínculo, não no profile

```text
Auth User → Profile → clinic_members.role_id → roles → role_permissions → permissions
```

O mesmo usuário pode ser `owner` na Clínica A e `dentist` na Clínica B.

## Owner

- Máximo administrativo **da própria clínica**
- Não é admin global da plataforma
- Sem bypass de tenant / RLS
- Service role nunca no navegador (`NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` proibido)

## Controles da Fase 1

- Membership com status: `invited | active | suspended | revoked`
- Roles de sistema: `owner`, `dentist`, `secretary` (+ `patient` reservado)
- Permissões granulares seedadas
- Audit logs append-only
- Clínica não pode ficar sem owner ativo
- Convite não cria owner pelo formulário
- Escalonamento para owner negado na UI/API de equipe

## Service role

- Somente server-side
- Nunca para contornar RLS em operações normais
- Nunca enviada ao client

## Checklist produção

- [ ] Desativar `NEXT_PUBLIC_DEMO_MODE`
- [ ] Aplicar migrations Fase 0 + Fase 1
- [ ] Revisar policies após novas tabelas
- [ ] Rotacionar chaves Supabase
