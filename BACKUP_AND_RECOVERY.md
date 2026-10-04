# BACKUP_AND_RECOVERY.md

## O que é copiado

Em produção (Supabase / PostgreSQL gerenciado):

- Banco: schemas `public` + `auth` (conforme plano Supabase)
- Storage buckets privados (exames, documentos, exports)
- Secrets: **fora** do backup de DB — gerenciados no provedor de secrets / dashboard

## Frequência

Depende do plano da infraestrutura (PITR / daily backups do Supabase).  
Documente aqui o plano contratado da equipe antes do go-live.

**Não declare RPO/RTO que a infraestrutura não garante.**

## Restore

1. Pausar writes na aplicação (maintenance).
2. Restaurar snapshot/PITR no projeto staging ou projeto dedicado de restore.
3. Validar: login, uma clínica demo, paciente, agenda, um pagamento, RLS smoke.
4. Só então promover / apontar DNS se for disaster recovery real.

## Responsáveis

- Eng. on-call: restore + validação técnica  
- Owner produto: comunicação a clínicas afetadas  

## Teste de restore

Backup **não testado** não é suficiente. Agendar restore em staging ao menos uma vez por ciclo de release maior.

## Disaster recovery (básico)

| Cenário | Ação |
| --- | --- |
| App indisponível | Redeploy; health `/api/health` |
| DB indisponível | Status Supabase; restore PITR |
| Migration quebrada | Rollback código; restore pré-migration se necessário |
| Segredo vazou | Rotacionar keys; invalidar sessions; auditar acessos |
| Storage | Recriar policies; re-sync se necessário |

Ver também [OPERATIONS.md](./OPERATIONS.md) e [DEPLOYMENT.md](./DEPLOYMENT.md).
