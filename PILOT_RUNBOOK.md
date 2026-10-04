# Runbook — Piloto controlado Sorria

## Ambientes

| Env | Uso | Demo mode |
| --- | --- | --- |
| `development` | Dev local / stores | `true` ok |
| `pilot` / `staging` | Clínica piloto | **`false`** |
| `production` | Futuro comercial | `false` |

Variáveis (ver `.env.example`):

```bash
NEXT_PUBLIC_SORRIA_ENV=pilot
NEXT_PUBLIC_PILOT_MODE=true
NEXT_PUBLIC_DEMO_MODE=false
NEXT_PUBLIC_SUPABASE_URL=...   # projeto separado
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...  # server-only
```

**Nunca** misturar banco demo com dados reais da dentista.

## Release do piloto

```text
fix → typecheck → lint → test → build
  → staging/pilot deploy → smoke → liberar uso
```

Não deployar direto sem smoke.

## Smoke test (obrigatório)

1. `GET /api/health` → status ok (ou degraded com avisos claros)
2. Login profissional
3. Agenda — ver dia / criar consulta
4. Paciente — abrir perfil
5. Procedimento — ficha de materiais
6. Estoque — item + ajuste com motivo
7. Atendimento — consumo → evolução → financeiro → concluir

## Instrumentação

Eventos de produto em `/api/demo/pilot` (demo) — sem texto clínico, CPF ou evolução.

Exemplos: `appointment.started`, `procedure_consumption.confirmed`, `clinical_entry.finalized`, `payment.created`.

Erros: `captureException` / `logEvent` em `src/lib/observability.ts` (sanitiza secrets e campos clínicos).

## Feedback

Botão flutuante **Enviar feedback** → Bug / Dificuldade / Sugestão + impacto.

Contexto automático: rota, versão, user/clinic IDs internos. Sem PHI da tela.

Painel: `/app/piloto`

## Estoque

- Inicial: **saldo inicial + custo unitário estimado** (não reconstruir compras antigas).
- Divergência: usar **Ajustar estoque** com motivo — nunca editar saldo no banco.
- Conferência periódica físico × Sorria; registrar diferença.

## Ficha técnica

Após amostras reais, a tela do procedimento mostra **Previsto × utilizado**.  
Se |delta| ≥ 25% com ≥ 3 amostras → sugere **Revisar ficha**. A dentista decide.

## Backup

Antes do piloto e antes de mudanças estruturais:

1. Snapshot / PITR do projeto Supabase do piloto
2. Documentar restore em [BACKUP_AND_RECOVERY.md](./BACKUP_AND_RECOVERY.md)
3. Testar restore em cópia, não no banco vivo

## Migrations

Qualquer mudança de schema: migration versionada. Sem ALTER manual em produção/piloto.

## Segurança contínua

- Manter clínica fictícia B para cross-tenant
- Reexecutar RLS / permissions / isolation a cada release
- Uma clínica piloto **não** autoriza enfraquecer multi-tenant

## Correções durante o piloto

1. Reproduzir  
2. Teste (obrigatório em cálculos)  
3. Corrigir  
4. Regressão  
5. Changelog `0.9.x`

## Entrevistas (fora do sistema)

1. O que foi mais fácil?  
2. O que mais atrasou?  
3. Informação procurada e não encontrada?  
4. Momento de “pensar demais” no clique?  
5. Confiança no estoque?  
6. Confiança no custo?  
7. Usaria todos os dias?  
8. **Se o Sorria sumisse amanhã, do que sentiria falta?**
