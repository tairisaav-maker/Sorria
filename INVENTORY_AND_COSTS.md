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

## Performed procedure (Subfase 3)

`performed_procedures` = execução em paciente específico (≠ catálogo).

Snapshot ao criar: ficha → `procedure_consumptions` (exclusivos) + `appointment_consumptions` (`per_appointment`).

### Consumo previsto × real

- UI pré-preenche `actual = planned` (não confirma sozinho)
- Confirmação → baixa `procedure_consumption` + custos
- Idempotente (`consumption_confirmed`)
- Extra / substituição: baixa só o item real
- Correção: movimentos compensatórios; histórico preservado

### Material compartilhado e rateio

Uma máscara no atendimento = **1 baixa física**.  
Custo rateado igualmente entre procedimentos ativos do appointment.  
Rateio ≠ segunda baixa.

### Custo histórico

`unit_cost_snapshot` no momento da confirmação.  
Custo médio futuro do estoque **não** altera procedimento antigo.

### Preço

`standard_price_snapshot` ≠ `charged_amount` do paciente.  
`charged_amount = 0` → margem `—` (sem divisão por zero).  
Valor cobrado ≠ pagamento; plano já faturado não gera cobrança duplicada.

### Hierarquia

Material → Procedimento realizado → Consulta → Paciente → Período

## Valor cobrado + financeiro (Subfase 5)

- `charged_amount` no `performed_procedure` (histórico com `standard_price_snapshot`)
- Links N:N `performed_procedure_financial_links.amount_allocated`
- Recebido por procedimento = rateio proporcional dos pagamentos válidos
- Evolução: `clinical_entries.performed_procedure_id`
- Ver [PATIENT_PROCEDURE_FLOW.md](./PATIENT_PROCEDURE_FLOW.md)

## Relatórios operacionais (Subfase 6)

Agrega consumo real → custo real → cobrado → recebido.

- Resultado bruto = cobrado − custo direto (≠ lucro líquido)
- Previsto × real por material/procedimento; linguagem “acima do previsto”, não “desperdício”
- Cobertura de custos = % concluídos com custo completo
- Material sem custo unitário válido → `custo incompleto` (não R$ 0)
- Ver [OPERATIONAL_REPORTS.md](./OPERATIONAL_REPORTS.md)

## Procedimentos previstos (Subfase 4)

`appointment_planned_procedures` ≠ catálogo (`procedures`) ≠ realizado (`performed_procedures`).

- Pertence ao mesmo `patient_id` da consulta
- Múltiplos por appointment
- `cancelled_at` remove da previsão (soft)
- Motivo da consulta sozinho **não** gera materiais

## Previsão de materiais (Subfase 4)

Serviço central: `forecastMaterialNeeds(clinicId, start, end, professionalId?)`

Fluxo:

```text
appointment elegível (scheduled|confirmed|arrived)
  → planned procedures ativos
  → calculateProcedureMaterialRequirements (ficha atual)
  → consolidar por item
  → projected_remaining = current − forecast
  → status: sufficient | low_after_forecast | insufficient | unknown
```

### Agregação por modo

| Modo | Regra na previsão |
| --- | --- |
| `per_appointment` | 1× por consulta (mesmo com N procedimentos) |
| `per_procedure` | 1× por planned procedure |
| `per_unit` | × `quantity` |
| `manual` | usa padrão como **Estimativa** (`unknown` se só houver manuais) |

### Estoque projetado / risco

- Previsão **não** reserva e **não** baixa `current_quantity`
- Cancelada / concluída / no_show → fora da previsão futura
- `arrived` com consumo já confirmado → fora (já é Subfase 3)
- Ficha atualizada afeta só consultas futuras (dinâmico)
- Ao iniciar atendimento: snapshot real via conversão → Subfase 3

### Conversão planned → performed

`convertPlannedProceduresToPerformedProcedures` — idempotente via `appointment_planned_procedure_id`.

### UI

`/app/estoque/previsao` · indicador na Agenda · card Home (7 dias) · drill-down por paciente

### Custo estimado

Requer `inventory.forecast_cost_view` ou `procedure_costs.view`.  
Sempre rotulado **Estimado** (≠ custo real confirmado).

## Permissions

`appointment_planned_procedures.view|create|update`  
`inventory.forecast_view` · `inventory.forecast_cost_view`  
`performed_procedures.*` · `procedure_consumption.*` · `procedure_costs.view`  
`inventory.*` (view/create/update/adjust/purchase/movements/cost)

## RLS / tenant

Clinic A ≠ planned/performed/consumo/compra/lote/forecast B.  
Patient/appointment/procedure/item devem ser da mesma clínica.
