# Fluxo do procedimento do paciente — Sorria

> Experiência de produto (Subfase 10): ver [V1_PRODUCT_FLOW.md](./V1_PRODUCT_FLOW.md).  
> Centro operacional: `/app/agenda/atendimento/[appointmentId]`.

## Cadeia completa

```text
PROCEDURE (catálogo)
  → APPOINTMENT_PLANNED_PROCEDURE (Agenda / previsto)
  → PERFORMED_PROCEDURE (realizado no paciente)
  → PROCEDURE_CONSUMPTION / APPOINTMENT_CONSUMPTION (previsto × real)
  → inventory_movements (baixa ao confirmar)
  → actual_total_cost (custo real histórico)
  → CLINICAL_ENTRY (evolução vinculada)
  → charged_amount (valor cobrado)
  → performed_procedure_financial_links (N:N)
  → financial_transaction → installments → payments
```

## Conceitos

| Entidade | Significado |
| --- | --- |
| `procedures` | Modelo / catálogo da clínica |
| `appointment_planned_procedures` | Previsto na Agenda |
| `performed_procedures` | Feito naquele paciente |
| `charged_amount` | Quanto foi cobrado (≠ pago) |
| `standard_price_snapshot` | Preço padrão no momento (histórico) |
| `amount_allocated` | Parte da cobrança pertencente ao procedimento |
| `payments` | Dinheiro realmente recebido |

## Valor cobrado × recebido

- Cobrança cria obrigação (`financial_transaction`), **não** pagamento.
- Recebido por procedimento = rateio proporcional de `amount_allocated` sobre pagamentos válidos da transação.
- Estorno recalcula o recebido; custo real **não** muda.

## Antiduplicidade

Não criar cobrança se:

- já existe link financeiro ativo;
- `financial_status = no_charge`;
- `treatment_item` pertence a plano já faturado → `included_in_plan`.

## Evolução

`clinical_entries.performed_procedure_id` — pré-preenche paciente, consulta, procedimento, dente.  
Draft → finalized; correções versionadas.

## Resumo do paciente

- Custo direto = Σ `actual_total_cost` (concluídos)
- Cobrado = Σ `charged_amount` (sem duplicar plano)
- Recebido / saldo / vencido = módulo Financeiro real do paciente
- Resultado bruto associado = cobrado − custo direto (não “lucro do paciente”)
- Custo operacional estimado acumulado = Σ `operational_total_cost` (quando houver snapshot)
- Resultado operacional estimado = cobrado − custo operacional (≠ rentabilidade do paciente)
- Diferença vs preço padrão = cobrado − `standard_price_snapshot` (não chamar automaticamente de desconto)
- NULL cobrado ≠ gratuidade (0)

Relatórios: `/app/relatorios` → Pacientes / Preços e margens. Ver [OPERATIONAL_REPORTS.md](./OPERATIONAL_REPORTS.md), [OPERATIONAL_COSTING.md](./OPERATIONAL_COSTING.md), [PRICING_AND_MARGIN.md](./PRICING_AND_MARGIN.md).

## Permissões

- Custos: `procedure_costs.view` / `reports.procedure_costs_view`
- Custo operacional: `procedure_operational_costs.view`
- Preço e margem: `procedure_pricing.view`
- Financeiro (recebido/saldo): `finance.view_*` / `reports.patient_financial_view`
- Evolução: `clinical_evolution.*`
- Procedimento: `performed_procedures.*`
