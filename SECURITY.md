# Security — Sorria

## Princípios

**Deny by default · Least privilege · Defense in depth · Tenant isolation**

## Regra estrutural

**Administrative Patient Data ≠ Clinical Record Access**

Secretária: dados cadastrais/contato/administrativo ✅  
Prontuário/anamnese/evolução/odontograma/arquivos clínicos ❌

## Pacientes (Fase 2)

- Toda operação valida membership + clinic_id + permission
- UUID não autoriza cross-tenant
- `clinic_id` / `created_by` no payload são ignorados ou negados se forjados
- Duplicidade **nunca** consulta outro tenant
- Sem DELETE destrutivo — arquivar preserva histórico
- Audit: `patient.created|updated|status_changed|archived|reactivated`

## Cadeia

```text
Auth → Membership → Clinic → Permission → Patient Tenant Check → RLS → Data
```

## Service role

Nunca no browser. Nunca `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`.
