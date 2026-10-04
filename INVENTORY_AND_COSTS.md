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

## Average cost (preparado)

V1 preferirá **custo médio ponderado**:

```text
(q_atual × custo_médio + q_entrada × custo_entrada) / (q_atual + q_entrada)
```

Implementação de compras/movimentos = **Subfase 2**.

## Historical cost snapshot

Quando consumo for confirmado (futuro), gravar `unit_cost_snapshot`.  
Não recalcular histórico com custo atual.

## Stock movements (futuro)

Tipos: purchase, procedure_consumption, manual_adjustment, loss, expiration, return, correction.  
Nunca alterar `current_quantity` sem movimento.

## Forecasting (futuro)

Agenda futura + procedimentos + ficha → necessidade.  
Previsão ≠ baixa. Sem procedimento definido → não adivinhar.

## Permissions

`procedures.*`, `procedure_costs.*`, `procedure_consumption.*`, `inventory.*`, `cost_reports.view`

## RLS / tenant

Todas as tabelas com `clinic_id` + policies por permission.  
Clinic A jamais acessa procedure/inventory/consumo/compra de Clinic B.
