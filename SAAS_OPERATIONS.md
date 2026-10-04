# SAAS_OPERATIONS — Sorria

Operação do produto como SaaS (Subfase 11).  
Billing SaaS ≠ Financeiro do consultório.

## Signup

1. `POST /api/demo/saas` action `signup` → conta  
2. Cookie `pro:<userId>:`  
3. `/cadastro/clinica` → cria clínica + membership owner + trial  

Owner **não** recebe `clinical_access` automático.

## Clinic creation

Campos mínimos: nome, telefone/cidade opcionais, timezone, plano inicial.  
Onboarding: Clínica → Procedimentos → Materiais → Estoque → Agenda (pulável).  
Momento de valor: custo estimado na ficha do procedimento.

## Memberships & convites

- Convite: token hasheado, expira 7 dias, single-use (`clinic_invitations`)  
- Aceite valida e-mail  
- Usuário pode ter memberships em várias clínicas  
- Switch: servidor valida membership; cookie atualizado  

## Planos & entitlements

| Domínio | Responsabilidade |
| --- | --- |
| Plan | Features e limites |
| Subscription | Clínica ↔ plano + status |
| Payment/webhook | Provider confirma pagamento |
| Permission | O que o usuário pode fazer |

`hasEntitlement(ctx, key, permission?)`  
`checkPlanLimit(clinicId, limit)`  
Não usar `if plan === "pro"` na UI.

Placeholders: **Starter** / **Pro** — preços sob consulta.

## Trial

`trial_days` por plano (seed: 14).  
Expiração → status `expired` → **modo restrito**:

- login ok  
- billing/export/visualização  
- bloqueio de novas mutações comerciais  
- **dados preservados**

## Assinatura UI

`/app/configuracoes/assinatura` — plano, status, uso, upgrade/downgrade, cancel_at_period_end.

## Billing provider

Interface `BillingProvider` em `src/lib/billing/provider.ts`.  
Implementação atual: `DemoBillingProvider`.  
Webhook: assinatura `x-sorria-billing-secret` / `DEMO_BILLING_WEBHOOK_SECRET`.  
Idempotência: unique `(provider, provider_event_id)`.

**Checkout redirect não ativa plano.**

## Cancelamento / encerramento

- Cancelamento: `cancel_at_period_end`  
- Encerramento: soft (`ENCERRAR`) — sem hard delete; retenção jurídica pendente  

## Support & internal

- `/app/ajuda` — primeiros passos  
- Feedback flutuante (piloto)  
- `/internal` — busca clínica + status assinatura (sem PHI); demo restrito a OWNER_A  

## Emails transacionais (padrão)

Confirmação de conta · convite · reset senha · eventos de assinatura.  
Marca: **Sorria — Gestão inteligente para consultórios**.  
Sem dados clínicos no e-mail.

## Backup / incidentes

Ver [BACKUP_AND_RECOVERY.md](./BACKUP_AND_RECOVERY.md) e [PRODUCTION_READINESS.md](./PRODUCTION_READINESS.md).

## Analytics (produto)

`signup_completed` · `clinic_created` · onboarding · first procedure/inventory/patient/appointment · subscription_*  

North star sugerida: clínicas com atendimentos completos na semana (métrica de produto, não receita).

## Ambientes

| Env | DEMO_MODE | Notas |
| --- | --- | --- |
| development | true | stores |
| pilot/staging | false | Supabase próprio |
| production | false | secrets próprios |
