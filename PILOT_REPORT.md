# PILOT_REPORT — Sorria

## Contexto

Preparação do **piloto controlado** do V1 (versão **0.9.0-pilot**).  
Objetivo: uso real por uma dentista para medir simplicidade e confiabilidade de consumo, estoque, custo e financeiro — **sem novos módulos**.

## Período

A preencher no início/fim do piloto:

- Início: _YYYY-MM-DD_
- Fim previsto: _YYYY-MM-DD_
- Semana 1 foco: Agenda · Pacientes · Procedimentos · Consumo · Estoque
- Semana 2 foco: Evolução · Custo · Cobrado · Financeiro
- Depois: Relatórios · Reposição · Margem · Custo operacional

## Usuários participantes

| Papel | Quem | Observações |
| --- | --- | --- |
| Dentista piloto | _nome_ | Uso diário do atendimento |
| Apoio (se houver) | _nome_ | Agenda / financeiro |

## Ambiente

| Item | Valor |
| --- | --- |
| Versão | 0.9.0-pilot |
| Env | pilot / staging |
| Demo mode | deve ser `false` |
| Supabase | projeto separado |
| Backup | _status_ |

## Fluxos testados

- [ ] Agenda → iniciar atendimento
- [ ] Procedimento previsto → realizado
- [ ] Consumo (1 clique quando = previsto)
- [ ] Material extra
- [ ] Evolução rascunho → finalizada
- [ ] Valor cobrado + financeiro
- [ ] Pagamento parcial / total
- [ ] Concluir atendimento
- [ ] Cadeia Paciente → Consulta → Procedimento → Materiais → Custo → Evolução → Cobrança → Pagamento

## Atendimentos registrados

_Preencher durante o piloto. Ver métricas em `/app/piloto`._

| Semana | Atendimentos | Procedimentos |
| --- | --- | --- |
| 1 | | |
| 2 | | |
| 3+ | | |

## Bugs

| ID | Descrição | Prioridade | Status |
| --- | --- | --- | --- |
| | | P0–P4 | aberto/corrigido |

## Fricções

| Fluxo | Sintoma | Frequência | Decisão |
| --- | --- | --- | --- |
| | | | |

## Sugestões

_Backlog — não viram feature automática._

## Divergências de estoque

| Item | Físico | Sorria | Diff | Explicação | Ajuste com motivo? |
| --- | --- | --- | --- | --- | --- |
| | | | | | |

## Divergências de custo

| Procedimento | Manual | Sistema | OK? |
| --- | --- | --- | --- |
| | | | |

## Problemas financeiros

| Caso | Cobrado | Recebido | Saldo | OK? |
| --- | --- | --- | --- | --- |
| | | | | |

## Métricas de uso (produto)

Fonte: `getPilotCoverageMetrics` / `/app/piloto`

| Métrica | Valor |
| --- | --- |
| Atendimentos concluídos | |
| Procedimentos | |
| % consumo confirmado | |
| % evolução registrada | |
| % financeiro definido | |
| % custo completo | |
| Feedbacks | |
| Erros críticos | |

## Decisões tomadas

_Durante o piloto:_

## Itens para próximo ciclo

Somente após evidência:

- **CICLO A** — Polir UX  
- **CICLO B** — Corrigir modelo estoque/custos  
- **CICLO C** — Preparar comercialização  
- **CICLO D** — Feature realmente validada  

## Estado na preparação (pré-piloto)

### Problemas classificados

| Item | Classe |
| --- | --- |
| APP_VERSION desalinhada do package (corrigido → 0.9.0-pilot) | atrapalhava |
| Sem feedback in-app | atrapalhava piloto |
| Sem métricas de cobertura do fluxo | atrapalhava |
| Sem checklist/painel de piloto | atrapalhava |
| Termos/Privacidade placeholder jurídico | pode esperar (comercial) |
| Portal / Assistente no código | pode esperar (fora do núcleo) |
| Demo stores ≠ Supabase real | bloqueia se piloto usar DEMO_MODE |
| Push Git sem remote neste ambiente | atrapalha entrega remota, não o piloto clínico |

### Correções / preparações feitas

- Versão **0.9.0-pilot** + canal pilot
- Env `NEXT_PUBLIC_SORRIA_ENV` / `PILOT_MODE` + avisos em health
- Instrumentação de eventos sem PHI
- Feedback rápido (bug / fricção / sugestão)
- Painel `/app/piloto` (checklist + cobertura)
- Previsto × utilizado na ficha do procedimento
- Docs: este relatório, PILOT_CHECKLIST, PILOT_RUNBOOK
- Testes de piloto + regressão V1

### Critérios de sucesso (relembrar)

- Sem bug crítico aberto  
- Estoque com diferenças explicáveis  
- Custos conferem em amostras  
- Financeiro confiável  
- Fluxo diário sem suporte constante  
- Valor percebido (pergunta “do que sentiria falta?”)
