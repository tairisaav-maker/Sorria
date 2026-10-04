# OPERATIONS.md

## Ambientes

development · staging · production — ver DEPLOYMENT.md

## Deploy / migrations

Ver DEPLOYMENT.md. Health: `/api/health` (application healthy ≠ AI available).

## Backup / restore

Ver BACKUP_AND_RECOVERY.md.

## Secrets

- Dashboard Supabase / secret manager  
- Rotação imediata em vazamento  
- Sem secrets em commits, fixtures ou screenshots  

## Monitoring / erros

- `src/lib/observability.ts` — abstração; plugar Sentry/OTel  
- Logs sem senha/token/CPF/prontuário completo  
- Erros de UI: código curto (correlation id), sem stack  

## Incidentes

1. Classificar impacto (auth / dados / disponibilidade)  
2. Mitigar (flag off assistant, maintenance)  
3. Comunicar  
4. Postmortem breve  

## Demo vs produção

Demo: `NEXT_PUBLIC_DEMO_MODE=true` + stores em memória.  
Produção: modo demo **off**; sem pacientes fictícios automáticos.
