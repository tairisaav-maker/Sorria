# Relatórios operacionais — Subfase 6

Rota: `/app/relatorios`  
Foco: **rentabilidade operacional** (materiais + custos diretos + cobrado + recebido).  
Não é DRE, lucro líquido, folha ou fiscal.

Intervalo: **`[start, end)`** no timezone da clínica (`clinics.timezone`).

## Princípios

```text
Preço padrão ≠ Valor cobrado
Valor cobrado ≠ Valor recebido
Custo previsto ≠ Custo real
Resultado bruto ≠ Lucro líquido
Margem do procedimento ≠ Margem líquida da clínica
Clinic A ≠ Clinic B
```

Cadeia:

```text
PROCEDIMENTOS REALIZADOS → CONSUMO REAL → CUSTO REAL
→ VALOR COBRADO → PAGAMENTOS → AGREGAÇÃO → INDICADORES
```

## Permissões

| Chave | Uso |
| --- | --- |
| `reports.view` | Acessar Relatórios |
| `reports.procedure_costs_view` | Custos, resultado bruto, margem |
| `reports.materials_view` | Consumo de materiais (ou `inventory.view`) |
| `reports.patient_financial_view` | Recebido/saldo por paciente |
| `reports.financial_view` | Aba Financeiro operacional |
| `reports.export` | PDF / XLSX / CSV |

Equivalentes reutilizados: `procedure_costs.view`, `cost_reports.view`, `finance.view_*`, `reports.view_financial`.

Secretária: agenda/estoque/financeiro administrativo — **sem** margem/resultado bruto sem `reports.procedure_costs_view`.  
Dentista: procedimentos/consumo — custos/financeiro conforme permission.  
Owner/gestor: permission-based (matriz completa admin).

## Serviços

`src/services/reports/operational/`

| Função | Retorno |
| --- | --- |
| `getOperationalOverview` | Cards da visão geral + comparação período anterior |
| `getProcedurePerformanceReport` | Tabela/ranking por procedimento |
| `getProcedurePerformanceDetail` | Drill-down + série temporal |
| `getMaterialConsumptionReport` | Consumo por material |
| `getMaterialConsumptionDetail` | Usos + compras |
| `getPatientOperationalReport` | Custo/cobrado/recebido/saldo |
| `getFinancialOperationalReport` | Financeiro operacional + série |
| `getCostCoverageReport` | Cobertura de custos |
| `getOperationalBundle` | Pacote UI com capabilities |

Fórmulas: `src/lib/reports/operational-formulas.ts`  
(`grossResult`, `grossMarginPercent`, `plannedVsActual`, `costCoverage`, `periodDeltaPercent`)

## Métricas

### Procedimentos realizados

| Campo | Valor |
| --- | --- |
| Definição | Procedimentos concluídos no período |
| Fonte | `performed_procedures` |
| Fórmula | `status = completed` e `completed_at ∈ período` |
| Permissão | `reports.view` |
| Limitações | Não inclui cancelados/planejados |

### Custo real de materiais

| Campo | Valor |
| --- | --- |
| Definição | Soma dos custos diretos confirmados |
| Fonte | `performed_procedures.actual_total_cost_cents` (ou consumos confirmados) |
| Fórmula | soma onde consumo confirmado e custo não nulo |
| Permissão | `reports.procedure_costs_view` |
| Limitações | Sem ficha/custo unitário → incompleto (não assume R$ 0) |

### Valor cobrado

| Campo | Valor |
| --- | --- |
| Definição | Soma do cobrado nos procedimentos |
| Fonte | `performed_procedures.charged_amount_cents` |
| Fórmula | soma; exclui `no_charge` e `included_in_plan` (evita duplicar plano) |
| Permissão | custos ou financeiro |
| Limitações | ≠ preço padrão; ≠ recebido |

### Valor recebido

| Campo | Valor |
| --- | --- |
| Definição | Pagamentos alocados aos procedimentos / financeiro |
| Fonte | `payments` + alocações |
| Fórmula | `calculateProcedureReceivedAmount` / resumo financeiro; estornos fora |
| Permissão | financeiro |
| Limitações | Nunca usa `charged_amount` como recebido |

### Resultado bruto

| Campo | Valor |
| --- | --- |
| Definição | Cobrado − custos diretos |
| Fórmula | `soma(charged) − soma(actual_total_cost)` |
| Tooltip | Não representa lucro líquido da clínica |
| Permissão | `reports.procedure_costs_view` |

### Resultado considerando recebimentos

| Campo | Valor |
| --- | --- |
| Definição | Recebido alocado − custo real |
| Nome | Resultado considerando recebimentos |
| Limitações | Não chamar de lucro |

### A receber

| Campo | Valor |
| --- | --- |
| Fonte | Serviços financeiros (`getFinancialMetrics` / resumo paciente) |
| Limitações | Considera parcelas, planos, descontos — não só cobrado − pagos |

### Custo médio real (procedimento)

`soma(actual_total_cost) ÷ quantidade com custo completo`

### Valor médio cobrado

`soma(charged) ÷ quantidade cobrada` (exclui sem cobrança da divisão)

### Margem por procedimento

`(resultado_bruto ÷ valor_cobrado) × 100`  
Se cobrado = 0 → não calcula.

### Previsto × real (materiais)

| Campo | Valor |
| --- | --- |
| Fontes | `planned_quantity` / `actual_quantity`, custos planejado/real |
| Diferença | `actual − planned` |
| Percentual | `(actual − planned) ÷ planned × 100` se planned > 0 |
| Linguagem | “X% acima/abaixo do previsto” — **não** “desperdício” |

### Cobertura de custos

| Campo | Valor |
| --- | --- |
| Definição | % concluídos com dados suficientes de custo direto |
| Fórmula | `completos ÷ concluídos × 100` |
| Tooltip | Percentual de procedimentos concluídos com dados suficientes para custo direto |

### Resultado bruto associado (paciente)

`valor cobrado − custo direto`  
Não: “lucro do paciente”. Sem ranking “mais rentáveis”.

## Exportação

PDF · XLSX · CSV — `section=operational`, mesmos filtros de período.  
Auditoria: `report.exported`.

Cabeçalho PDF: Sorria · Gestão inteligente para consultórios · Clínica · Relatório operacional · Período.

XLSX abas (conforme permissão): Resumo · Procedimentos · Materiais · Pacientes · Financeiro.

## Performance

Agregação server-side nos services. Sem materialized views nesta fase. Índices avaliados nos campos de período/clínica; criar só com medição.

## Relação com Subfase 7

Consumo histórico e previsto×real dos relatórios alimentam **alertas** de reposição (`REPLENISHMENT.md`), sem alterar automaticamente fichas ou quantidades de compra.

## Fora do escopo

Custo fixo/hora, rateio de aluguel, impostos, comissão, folha, lucro líquido, DRE, IA, benchmarking entre dentistas, recomendação de preço/clínica.
