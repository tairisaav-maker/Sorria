# Sorria Beta — Lançamento comercial (Subfase 12)

**Versão:** 0.11.0-beta  
**Cohort inicial:** `beta_cohort_1`  
**Meta da primeira leva:** 5 a 10 clínicas

## Objetivo

Provar que dentistas entendem o valor do Sorria, usam e pagam — sem adicionar módulos clínicos.

Posicionamento central:

> Saiba quanto cada procedimento realmente custa.

Não posicionar como ERP odontológico completo.

## Público / ICP

- Dentista autônomo e consultório pequeno (1–5 profissionais)
- Administra o próprio consultório, compra materiais, define preços
- Usa planilha / WhatsApp / sistema que não conecta consumo e custo
- Quer gestão sem ERP pesado

**Fora do foco imediato:** redes, franquias, hospitais, dezenas de unidades.

## Fluxos comerciais

| Fluxo | Rota / mecanismo |
|-------|------------------|
| Landing | `/` |
| Como funciona | `/como-funciona` |
| Planos | `/planos` (consome `listPublicPlans()`) |
| Lead | `/conhecer` → `POST /api/demo/commercial` `action=lead` |
| Signup | `/cadastro` (+ invite opcional/obrigatório) |
| Demo | `NEXT_PUBLIC_DEMO_MODE=true` + banner “Ambiente de demonstração” |
| Internal beta | `/internal` (OWNER_A) — saúde, cohort, métricas |

## Beta fechado (invite-only)

```
COMMERCIAL_BETA_INVITE_ONLY=true
```

Códigos seed demo: `SORRIA-BETA`, `SORRIA-DEMO`.  
Sem convite válido → signup bloqueado. Arquitetura continua pronta para signup aberto.

## Ofertas

Possíveis: trial, preço fundador, período especial.  
Valores **não** são inventados nesta fase. Quando usados, registrar no billing (`commercial_offer`, `founder_pricing` em metadata comercial) — nunca `if (email === ...)`.

## Ativação

Clínica ativada quando:

1. Clínica criada  
2. Procedimento cadastrado  
3. Materiais (ficha técnica)  
4. Estoque inicial  
5. Primeiro atendimento concluído  

Checklist na Home — orientação, não gamificação.

## Momentos de valor (analytics)

| Evento | Quando |
|--------|--------|
| `first_procedure_cost_calculated` | Visualiza custo estimado na ficha |
| `first_real_procedure_cost_calculated` | Conclui atendimento com custo real |

Landing: `landing_viewed`, `cta_clicked`, `pricing_viewed`, `lead_submitted`, `signup_started`, `signup_completed`.

**Sem PHI / dados clínicos em eventos.**

## Funil

Lead → Demo → Trial → Ativação → Cliente pagante → Retenção  

Retenção = clínicas que registram atendimentos na semana seguinte (não login isolado).

## E-mails (conteúdo — envio via provider depois)

**Boas-vindas:** “Bem-vindo ao Sorria” — CTA cadastrar primeiro procedimento.  
**Ativação (moderada):** clínica sem procedimento; procedimento sem ficha; ficha sem estoque.  
Nunca enviar dados de pacientes.

## Cancelamento

Simples, sem dark patterns. Feedback opcional de motivo estruturado.

## Critérios de sucesso da cohort

Não só “X cadastros”. Avaliar: entende proposta? completa onboarding? ficha técnica? atendimento? volta a usar? confia nos custos? aceita pagar?

## Aquisição nesta fase

Contatos diretos, demos, indicações, rede profissional.  
**Não** campanhas pagas em massa.
