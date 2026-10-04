# V1 — Fluxo de produto do Sorria

**Sorria — Gestão inteligente para consultórios**

Documento da Subfase 10: o V1 deixa de ser um conjunto de módulos e passa a ser um fluxo contínuo da rotina clínica.

## Fluxo principal

```
Agenda
  → Abrir paciente / Iniciar atendimento
  → Procedimentos previstos → realizados
  → Revisar materiais (utilizado = previsto)
  → Confirmar consumo (baixa de estoque)
  → Registrar evolução (rascunho → finalizada)
  → Ver custo real (quando autorizado)
  → Definir valor cobrado
  → Adicionar / vincular financeiro
  → Registrar pagamento (opcional, nunca automático)
  → Concluir atendimento
```

## Princípio

**Simples para usar + robusto por dentro.**

Não: simples por dentro + complicado para usar.

## Navegação V1

**Principal:** Início · Agenda · Pacientes · Estoque · Financeiro  

**Secundário (Mais):** Procedimentos · Relatórios · Configurações

## Telas-chave

| Área | Rota | Papel |
|------|------|--------|
| Home | `/app/home` | O que precisa da atenção hoje + quick actions |
| Agenda | `/app/agenda` | CTA Iniciar / Continuar / Ver atendimento |
| Atendimento | `/app/agenda/atendimento/[id]` | Centro clínico-operacional |
| Paciente | `/app/pacientes/[id]` | Resumo · Evolução · Procedimentos · Financeiro · Documentos |
| Procedimentos | `/app/procedimentos` | Catálogo, ficha técnica, preço e custos |
| Estoque | `/app/estoque` | Itens, reposição, compras, movimentações |
| Financeiro | `/app/financeiro` | Recebido, a receber, vencido, despesas |
| Relatórios | `/app/relatorios` | Decisões (não a Home) |
| Onboarding | `/app/onboarding` | Clínica → procedimentos → materiais → estoque → paciente → consulta |

## Atendimento (centro do fluxo)

Blocos na mesma tela:

1. **Procedimentos** — previstos → realizados; adicionar extra  
2. **Materiais** — utilizado = previsto; confirmar em 1 ação  
3. **Evolução** — contexto pré-preenchido; rascunho / finalizar  
4. **Custos e financeiro** — bloco compacto; pagamento sob demanda  

### Bloqueio vs aviso

**Pode bloquear:** integridade, estoque inconsistente em operação crítica.  

**Só aviso:** financeiro não definido, evolução em rascunho, retorno não definido.

## Diferencial do V1

Para cada procedimento de cada paciente o Sorria sabe:

- o que estava previsto usar  
- o que realmente foi usado  
- quanto custou  
- quanto foi cobrado  
- quanto foi recebido  

Tudo ligado à Agenda e à evolução clínica.

## Segurança

- RLS / `clinic_id` em todas as entidades  
- Permissions granulares (não só role)  
- Separação clínico × financeiro × custos  
- Cross-clinic: zero vazamento  

## Fora do V1

Portal do paciente, Secretária Virtual/IA, convênios/TISS, marketplace, fiscal, CRM/WhatsApp, comissão/folha/contabilidade completa.

## Próximo passo recomendado

Não mais features: **piloto controlado** com dentista em atendimentos reais para medir cliques e atrito.
