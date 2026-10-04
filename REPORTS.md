# Relatórios — Definições de métricas (FASE 8)

Intervalo padrão: **`[start, end)`** no timezone da clínica (`America/Sao_Paulo` no demo).

> Relatórios operacionais de rentabilidade (Subfase 6): ver [OPERATIONAL_REPORTS.md](./OPERATIONAL_REPORTS.md).  
> UI padrão em `/app/relatorios`; indicadores clássicos em `?classic=1`.

## Visão geral

| Nome | Fonte | Fórmula / timestamp | Permissão |
| --- | --- | --- | --- |
| Consultas concluídas | `appointments` | `status=completed` e `start_at ∈ período` | `reports.view_schedule` |
| Pacientes novos | `patients` | `created_at ∈ período` | `reports.view_patients` |
| Planos aceitos | `treatment_plans` | `accepted_at ∈ período` | `reports.view_treatments` |
| Valor recebido | `payments` | soma `amount` com `paid_at ∈ período`, não estornado, tx receita | `reports.view_financial` |

## Agenda

| Nome | Fonte | Fórmula | Observações |
| --- | --- | --- | --- |
| Consultas no período | appointments | `start_at ∈ período` | Preferência operacional: horário da consulta |
| Concluídas | appointments | `status=completed` | |
| Cancelamentos | appointments | `status=cancelled` | Status final das consultas do período |
| Faltas | appointments | `status=no_show` | |
| Taxa de comparecimento | — | `concluídas ÷ (concluídas + faltas) × 100` | Cancelamentos fora |
| Taxa de falta | — | `faltas ÷ (concluídas + faltas) × 100` | |
| Ocupação | — | **não calculada** | Sem horários de atendimento modelados |

## Pacientes

| Nome | Fonte | Fórmula | Observações |
| --- | --- | --- | --- |
| Pacientes novos | patients.created_at | contagem no período | ≠ primeira consulta |
| Cadastrados como ativos | patients.status=active | estoque atual | ≠ atendidos |
| Origem | referral_source | contagem nos novos do período | Inclui **Não informado** |
| Retornos pendentes | clinical entries + agenda | `follow_up_required` + sem consulta futura válida | Paciente único; secretária vê só “contato para agendamento” |

## Tratamentos

| Nome | Fonte | Fórmula | Observações |
| --- | --- | --- | --- |
| Apresentados | presented_at | no período | |
| Aceitos | accepted_at | no período | |
| Recusados | rejected_at | no período | |
| Aguardando decisão | status=presented | estoque atual | |
| Taxa de aceitação | — | `aceitos ÷ (aceitos + recusados)` | Aguardando fora |
| Valor apresentado | treatment_plan_versions | total do snapshot apresentado | Não usa versão atual alterada |
| Valor aceito | versão aceita | total do snapshot aceito | ≠ valor recebido |

## Financeiro

| Nome | Fonte | Fórmula | Observações |
| --- | --- | --- | --- |
| Valor recebido | payments | pagos válidos no período | ≠ plano aceito |
| A receber | installments | saldo aberto atual | Estoque |
| Valor vencido | installments | saldo com `due_date < hoje` (TZ clínica) | Saldo, não valor original |
| Despesas registradas | payments de expense | paid_at no período | |
| Resultado do período | — | recebido − despesas | **Não** é lucro líquido |
| Pacientes com parcelas vencidas | — | pacientes únicos saldo vencido > 0 | |

## Exportação

Formatos: PDF · XLSX · CSV. Respeitam período, clínica, seção e permissões.  
Auditoria: `report.exported` (sem dump do arquivo).

## Princípios

```text
Plano aceito ≠ Receita recebida
Valor apresentado ≠ Valor aceito
Valor aceito ≠ Valor recebido
Valor vencido = saldo vencido
Resultado do período ≠ lucro líquido contábil
Paciente ativo ≠ paciente atendido
Clinic A ≠ Clinic B
```
