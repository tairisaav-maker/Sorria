# Fluxo do procedimento do paciente — Sorria

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
- Cobrado = Σ `charged_amount`
- Recebido / saldo / vencido = módulo Financeiro real do paciente

## Permissões

- Custos: `procedure_costs.view`
- Financeiro (recebido/saldo): `finance.view_*`
- Evolução: `clinical_evolution.*`
- Procedimento: `performed_procedures.*`
