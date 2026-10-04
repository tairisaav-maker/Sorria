# Checklist do piloto controlado — Sorria 0.9 Pilot

## Preparação (antes do primeiro atendimento real)

- [ ] Ambiente `pilot` / staging separado do development
- [ ] `NEXT_PUBLIC_DEMO_MODE=false` no piloto
- [ ] Projeto Supabase próprio (não misturar seed demo)
- [ ] Backup / PITR habilitado e procedimento de restore documentado
- [ ] Clínica configurada
- [ ] Profissional configurado
- [ ] Horários configurados
- [ ] 5–10 procedimentos principais cadastrados
- [ ] Materiais associados (fichas técnicas)
- [ ] Estoque inicial (saldo + custo unitário estimado)
- [ ] Conferência física vs Sorria registrada
- [ ] Pacientes iniciais cadastrados
- [ ] Agenda pronta
- [ ] Smoke test: Login → Agenda → Paciente → Procedimento → Estoque → Atendimento → Financeiro
- [ ] RLS / cross-tenant suite verde
- [ ] Botão “Enviar feedback” visível

## Semana 1 — núcleo operacional

- [ ] Agenda usada no dia a dia
- [ ] Pacientes abertos sem atrito
- [ ] Procedimentos realizados no atendimento
- [ ] Consumo confirmado (utilizado = previsto por padrão)
- [ ] Estoque acompanhado (físico × sistema)

## Semana 2 — clínico + financeiro

- [ ] Evolução (rascunho → finalizada)
- [ ] Custo visível para quem tem permissão
- [ ] Valor cobrado definido
- [ ] Pagamento (total / parcial)
- [ ] Saldo confere

## Após dados suficientes

- [ ] Relatórios / reposição / margem / custo operacional
- [ ] Não julgar relatório com 1–2 atendimentos

## Checklist diário (leve)

- [ ] Aplicação disponível (`/api/health`)
- [ ] Sem erros críticos novos
- [ ] Estoque sem inconsistência grave
- [ ] Financeiro sem duplicidade
- [ ] Backups ok

## Prioridade de correção

| Prioridade | Ação |
| --- | --- |
| P0 | Bloqueia atendimento → corrigir já |
| P1 | Erro importante → corrigir no ciclo |
| P2 | Fricção recorrente → medir frequência |
| P3/P4 | Melhoria / ideia → backlog |

## Encerramento do piloto

- [ ] Nenhum bug crítico aberto
- [ ] Estoque com divergências explicáveis
- [ ] Custos conferem em amostras manuais
- [ ] Financeiro (cobrado / recebido / saldo) confiável
- [ ] Fluxo diário sem suporte constante
- [ ] Fricções principais documentadas em PILOT_REPORT.md
- [ ] Decisão: Ciclo A (UX) / B (estoque-custo) / C (comercial) / D (feature validada)
