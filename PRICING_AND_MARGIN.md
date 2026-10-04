> Fluxo V1: [V1_PRODUCT_FLOW.md](./V1_PRODUCT_FLOW.md)

# Pricing & Margin — Sorria (Subfase 9)

Análise de **preço padrão × valor cobrado × custo direto × custo operacional × recebido**.

**Calcular ≠ recomendar automaticamente.** O Sorria mostra matemática; o usuário decide o preço.

## Dois níveis

| Nível | Entidade | Foco |
| --- | --- | --- |
| Procedimento padrão | `procedures` | Preço atual, custo padrão, margem estimada |
| Procedimento realizado | `performed_procedures` | Snapshot, cobrado, custos reais, margem do caso |

## Conceitos

| Termo | Campo / regra |
| --- | --- |
| Preço padrão | `default_price` atual do catálogo |
| Preço snapshot | `standard_price_snapshot` no momento do registro |
| Valor cobrado | `charged_amount` (NULL = não definido; 0 = sem cobrança) |
| Diferença | `charged − snapshot` (não chamar automaticamente de desconto) |
| Custo direto | `actual_total_cost` |
| Custo operacional | `operational_total_cost` (Subfase 8) |
| Recebido | Pagamentos válidos + alocações (≠ cobrado) |
| Break-even | = custo operacional (receita = custo; ≠ preço ideal) |
| Margem agregada | `sum(result) / sum(charged)` — não média simples de % |

## Simulações

- Por preço simulado
- Por margem desejada: `price = cost / (1 − margem)` (margem &lt; 100%)
- Por resultado desejado: `price = cost + resultado`
- Por diferença % ou R$ sobre o padrão

Simulação **não** altera `default_price`. Só “Atualizar preço padrão” com confirmação e permission.

## Histórico

`procedure_price_history` — alteração de preço do catálogo.  
Procedimentos realizados e planos já apresentados/aceitos **não** mudam.

## Alertas (não dramáticos)

- Abaixo do custo direto
- Abaixo do custo operacional
- Margem reduzida
- Preço padrão abaixo do custo operacional estimado
- Valor ainda não definido

## Relatórios

Aba **Preços e margens** em `/app/relatorios`:

- Tabela agregada por procedimento
- Filtro abaixo do custo operacional
- Cobertura da análise (`pricing_coverage`)
- Export CSV / XLSX / PDF (sem custos se sem permission)

## Permissions

| Key | Uso |
| --- | --- |
| `procedure_pricing.view` | Ver margens / análises |
| `procedure_pricing.manage` | Gestão de precificação |
| `procedures.update_price` | Alterar preço padrão |
| `reports.pricing_view` | Aba e export de preços |

Secretária: pode ver/informar preço cobrado conforme config; **sem** margem/custo operacional por padrão.

## Services

- `src/services/procedure-pricing/`
- `src/services/reports/pricing/`
- Fórmulas: `src/lib/pricing/formulas.ts`

## Limitações

Sem: IA de preço, alteração automática de tabela, benchmarking, impostos, comissão, DRE, preço dinâmico.
