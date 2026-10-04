# Production Readiness — Sorria

Checklist da Subfase 11 (SaaS). Marcar com evidência real.

## Auth & sessão

- [x] Login demo + contas SaaS (`/cadastro`)
- [x] Sessão com cookie `pro:user:clinic` (demo)
- [ ] Auth Supabase em staging/production (ops)
- [ ] Verificação de e-mail obrigatória em produção

## Multi-tenant

- [x] `clinic_id` em recursos
- [x] Membership validada no servidor
- [x] Clinic switcher (multi-clínica)
- [x] Suite cross-tenant / RLS migrations

## Permissions & entitlements

- [x] Permissions granulares (can/assertPermission)
- [x] `hasEntitlement` = plano AND permission
- [x] Limites `checkPlanLimit` (profissionais / staff)
- [x] Modo restrito sem apagar dados

## Billing

- [x] `subscription_plans` / entitlements / `clinic_subscriptions`
- [x] Abstração `BillingProvider` (demo)
- [x] Webhook autenticado + idempotente (`billing_events`)
- [ ] Provedor de pagamento real (decisão de produto)
- [ ] Preços comerciais finais (não inventados)

## Storage

- [ ] Bucket policies auditadas em staging
- [ ] Signed URLs tenant-scoped
- [x] Princípio: nenhum arquivo clínico público

## Backups

- [x] Política documentada ([BACKUP_AND_RECOVERY.md](./BACKUP_AND_RECOVERY.md))
- [ ] Restore test executado em ambiente seguro (resultado abaixo)

### Restore test

| Data | Ambiente | Resultado | Responsável |
| --- | --- | --- | --- |
| _pendente_ | staging | | |

## Observabilidade

- [x] Health `/api/health` + SaaS health
- [x] Logging sanitizado (sem PHI)
- [x] Feedback / eventos piloto
- [ ] Error tracking externo (Sentry/OTEL) configurado em staging

## CI / ambientes

- [x] typecheck · lint · test · build
- [x] development / pilot / staging / production documentados
- [ ] CI pipeline hospedado (GitHub Actions etc.)
- [ ] Staging smoke pós-deploy

## Legal / compliance

- [x] Placeholders Termos/Privacidade com aviso de revisão
- [ ] Revisão jurídica profissional
- [ ] Política formal de retenção / encerramento de conta

## Branding

- [x] Apenas Sorria (sem Coesio)

## Piloto

- [x] Preparação do piloto (0.9)
- [ ] Piloto executado com dentista real e P0/P1 zerados

## Classificação sugerida (atualizar com evidência)

Ver entrega Subfase 11 — tipicamente **PRONTO PARA BETA FECHADO** até piloto + billing provider + restore test.
