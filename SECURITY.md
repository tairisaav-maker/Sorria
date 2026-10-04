# Security — Sorria

## Princípios

**Deny by default · Least privilege · Defense in depth · Tenant isolation**

## Regra estrutural

**Administrative Patient Data ≠ Clinical Record Access**

Secretária: dados cadastrais + agenda administrativa ✅  
Prontuário/anamnese/evolução/odontograma/arquivos clínicos ❌

## Agenda (Fase 3)

- `appointments.view|create|update|cancel`
- `appointment_requests.view|manage`
- Checks via `can()` / `requirePermission` — não espalhar role checks na UI
- `patient_id` e `professional_id` validados no tenant (membership ativo + papel adequado)
- Cross-clinic: UUID conhecido de outra clínica → not found / denied (sem revelar existência)
- Usuário suspenso: membership inativo → negado
- Conflitos de horário validados no servidor (não só na UI)
- Aprovação de solicitação revalida disponibilidade (race condition)
- Audit (sem dados excessivamente sensíveis):
  - `appointment.created|rescheduled|status_changed|cancelled`
  - `appointment_request.created|reviewed|proposed|approved|rejected|cancelled`

## Cadeia

```text
Auth → Membership → Clinic → Permission → Tenant Check → RLS → Data
```

## Service role

Nunca no browser. Nunca `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`.
