> Fluxo V1: [V1_PRODUCT_FLOW.md](./V1_PRODUCT_FLOW.md)

# Operational Costing — Sorria (Subfase 8)

Custeio gerencial simples para consultórios. **Não é contabilidade oficial.**

## Separação obrigatória

| Camada | O que é | Exemplo |
| --- | --- | --- |
| **Custo direto do procedimento** | Materiais + custos diretamente atribuíveis | Resina, luva, laboratório do caso |
| **Custo operacional indireto** | Tempo de cadeira × custo/hora | 50 min × R$ 120/h |
| **Despesa geral da clínica** | Manter a operação | Aluguel, energia, software, equipe |

O Sorria **não soma tudo sem critério**.

## Fórmula do procedimento

```text
Materiais utilizados
+ Custos diretos específicos
+ Custo operacional do tempo (minutos × custo/minuto)
= Custo operacional estimado do procedimento

Resultado operacional estimado = Valor cobrado − Custo operacional estimado
Margem operacional estimada = Resultado ÷ Cobrado × 100
  (se cobrado = 0 → margem = —)
```

**Não chamar de lucro líquido.** Usar: custo direto, custo operacional estimado, resultado operacional estimado, margem operacional estimada.

## Despesas

Reutiliza `financial_transactions` com `type = expense` + metadados:

- `cost_behavior`: `fixed` | `variable` (Fixa / Variável)
- `recurrence_type`: `recurring` | `one_time`
- `allocation_eligible`: se entra no custo/hora
- `reference_month` / `competence_date`: competência (preferida para custeio mensal)
- Pagamento: via `payments.paid_at` (template ≠ pago)

Despesas com `allocation_eligible = false` aparecem como **Não incluídas no custo/hora**.

### Templates recorrentes

`recurring_expense_templates` — previsão mensal (ex.: Aluguel R$ 3.000).  
**Não** geram pagamento automático nem entram em “valor pago”.

## Horas produtivas

Tabela `clinic_cost_settings`:

- V1: `calculation_mode = manual_productive_hours` (ex.: 120 h/mês)
- Futuro: `schedule_capacity` (grade da Agenda × taxa de utilização)

Sem horas configuradas → **dados insuficientes** (nunca R$ 0/h inventado).

## Custo/hora

```text
despesas alocáveis do mês ÷ horas clínicas produtivas do mês
custo/minuto = custo/hora ÷ 60  (precisão interna)
```

Snapshot mensal em `clinic_hourly_cost_snapshots`.  
Ao concluir procedimento: grava `productive_hour_cost_snapshot` no `performed_procedures`.

**Alterar aluguel hoje não muda procedimento de seis meses atrás.**

## Duração

Preferência: `actual_duration_minutes` → timestamps início/fim → duração da consulta → duração padrão.  
`duration_source`: `actual` | `appointment` | `default` | `manual`.

## Competência

Procedimento concluído em outubro usa custo/hora de outubro.  
Cadastro tardio de despesa de outubro **não** recalcula histórico automaticamente nesta fase.

## Taxa de cartão

Nesta fase **não** entra na fórmula operacional principal (pode ser custo financeiro do recebimento). Laboratório/comissões já ligados ao procedimento continuam como `direct_cost` — sem double-count via custo/hora.

## UI

- `/app/financeiro/custos` — Custos do consultório
- Simulador de custo/hora (cenário; não salva sozinho)
- Simulação de preço (matemática; nunca “preço recomendado pelo Sorria”)
- Ficha do procedimento: estimativa operacional padrão

## Permissions

| Key | Uso típico |
| --- | --- |
| `clinic_costs.view` / `.manage` | Owner/gestor |
| `operational_costs.view` | Custo/hora |
| `procedure_operational_costs.view` | Dentista (procedimento) |
| `expense_categories.manage` | Secretária pode metadados/despesas |
| `cost_reports.view` | Relatórios operacionais |

Secretária registra despesas se autorizada; **não** vê custo/hora/margem por padrão.

## Services

- `src/services/clinic-costs/`
- `src/services/operational-costs/`
- `src/services/procedure-operational-costs/`

## Relação com Subfase 9

O custo operacional alimenta a análise de **preço e margem** (`PRICING_AND_MARGIN.md`): break-even, simulações e alertas “abaixo do custo operacional”, sem recomendar preço automaticamente.

## Limitações V1

Sem: DRE fiscal, tributos, folha completa, depreciação, multi-cadeira, preço dinâmico, IA de precificação, recálculo histórico automático, custo/hora por profissional (arquitetura preparada).
