# Inventory & Costs — Sorria

## Propósito

Conectar **Agenda → Procedimento → Materiais previstos → Estoque → Custo → Evolução → Financeiro**.

O estoque não é um ERP. O procedimento não é só um nome no plano de tratamento.

| Conceito | Responde |
| --- | --- |
| Agenda | Quando |
| Paciente | Quem |
| Procedimento (catálogo) | O quê |
| Ficha técnica | Quanto vou usar |
| Estoque | Quanto tenho |
| Consumo real | Quanto usei *(subfase futura)* |
| Custos | Quanto gastei |
| Financeiro | Quanto cobrei / recebi |
| Evolução | O que aconteceu com o paciente |

## Procedures (catálogo)

Entidade `procedures` — serviço da clínica (Avaliação, Restauração, etc.).

**Distinções obrigatórias:**

- `treatment_item` ≠ catálogo de procedimento
- procedimento planejado no plano ≠ `performed_procedure` (futuro)

Campos principais: nome, categoria, duração padrão, preço padrão (`default_price` / cents no app), ativo/arquivado.

## Inventory items

`inventory_items` — materiais com:

- `purchase_unit` — como se compra (caixa, seringa…)
- `consumption_unit` — como se consome (un, g, ml…)
- `units_per_purchase_unit` — conversão (1 caixa = 100 un; 1 seringa = 4 g)
- `current_quantity` — **sempre em unidade de consumo**
- `average_unit_cost` — custo médio por unidade de consumo

### Compra ≠ consumo

Exemplo: 1 caixa R$ 40 com 100 un → custo/un = R$ 0,40.  
Procedimento usa 2 un → custo = R$ 0,80.

### Gramas

1 seringa R$ 90 com 4 g → R$ 22,50/g. Uso 0,30 g → R$ 6,75.

## Procedure materials (ficha técnica)

`procedure_materials` liga procedimento ↔ item com:

- `standard_quantity`
- `consumption_mode`
- `optional`, `notes`

Cross-clinic: procedure, item e row devem compartilhar `clinic_id` (trigger + service).

## Consumption modes

| Modo | Comportamento |
| --- | --- |
| `per_appointment` | Uma vez no atendimento (ex.: máscara), independente do nº de procedimentos |
| `per_procedure` | Por linha de procedimento realizado |
| `per_unit` | × `quantity` (ex.: 3 restaurações × 0,30 g = 0,90 g) |
| `manual` | Confirmar no atendimento |

## Standard consumption / cost (Subfase 1)

- `calculateProcedureStandardConsumption()`
- `calculateProcedureStandardCost()`
- `calculateAppointmentPlannedConsumption()` — agrega `per_appointment`

Fórmula custo linha: `round(qty × average_unit_cost_cents)`.

**Resultado bruto** = preço padrão − custo padrão.  
**Margem do procedimento** = resultado bruto ÷ preço × 100.  
Não chamar de lucro líquido.

## Compras (Subfase 2)

`inventory_purchases` + `inventory_purchase_items`

Fluxo transacional:

```text
compra → itens → inventory_movements → saldo → custo médio
```

- Snapshot: `units_per_purchase_unit_snapshot` (embalagem daquela compra)
- Servidor recalcula custo unitário; frontend só preview
- Cancelamento: `cancelled_at` + movimento compensatório (`correction`) — nunca delete

### Conversão na compra

2 caixas × 100 un × R$ 80 → +200 un · R$ 0,40/un  
2 seringas × 4 g × R$ 180 → +8 g · R$ 22,50/g

## Estoque inicial

`movement_type = initial_balance`  
Quantidade + custo unitário estimado + observação. Não é compra.

## Movimentações

`inventory_movements` — histórico imutável.

| Campo | Regra |
| --- | --- |
| `quantity_delta` | **+entrada / −saída** (unidade de consumo) |
| `unit_cost_snapshot` | custo no momento do movimento |
| `resulting_quantity` | saldo após o movimento |

Tipos: `purchase`, `initial_balance`, `manual_adjustment`, `loss`, `expiration`, `return`, `correction`, `procedure_consumption` (reservado Subfase 3).

**Nunca** alterar `current_quantity` / `average_unit_cost` pelo formulário de cadastro.

## Ajustes / perdas / vencimentos / devoluções

- Ajuste: informar quantidade contada → delta automático; motivo obrigatório
- Perda / vencimento / devolução: saída com tipo específico
- Correção: novo movimento; não apagar o anterior
- Estoque negativo: exige confirmação explícita + auditoria

## Lotes

`inventory_lots` opcional (`tracks_lot` / `tracks_expiration`).  
Não obrigar lote para descartáveis simples.  
`getExpiringInventoryItems(30|60|90)`.

## Custo médio ponderado (central)

```text
novo = (q_atual × médio_atual + q_entrada × custo_entrada) / (q_atual + q_entrada)
```

Única regra: `weightedAverageUnitCostCents` / `recalculateAverageCost`.  
Atualiza **custo padrão atual** dos procedimentos.  
**Não** altera custo histórico de consumos confirmados (snapshot — Subfase 3).

## Precisão

- Dinheiro: centavos inteiros (`numeric(12,2)` / cents no app)
- Quantidade: até 4 casas (`numeric(14,4)`)
- Custo unitário: arredondado ao centavo na apresentação (ex.: 0,25 g × 22,50 → R$ 5,63)

## Concorrência

Atualização de saldo/médio por item serializada (`withItemLock` no demo; `SELECT … FOR UPDATE` planejado no SQL).

## Valor estimado do estoque

`Σ current_quantity × average_unit_cost`  
Nome: **Valor estimado do estoque** (não patrimônio contábil).  
Requer `inventory.cost_view`.

## Historical cost snapshot

Quando consumo for confirmado (Subfase 3), gravar `unit_cost_snapshot`.  
Não recalcular histórico com custo atual.

## Forecasting (futuro)

Agenda + procedimentos + ficha → necessidade. Previsão ≠ baixa.

## Permissions

`inventory.view` · `create` · `update` · `adjust` · `purchase_create` · `movements_view` · `cost_view`  
(+ procedures / procedure_costs / cost_reports)

## RLS / tenant

Tabelas Subfase 2 com RLS + triggers cross-clinic.  
Clinic A ≠ compra/lote/movimento Clinic B.
