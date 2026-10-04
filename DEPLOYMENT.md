# DEPLOYMENT.md

## Ambientes

| Env | Uso |
| --- | --- |
| development | Demo mode / stores locais |
| staging | Migrations + E2E + smoke |
| production | Clínicas reais — **sem seed demo** |

Cada ambiente: DB, Auth, Storage, secrets e URLs próprios.

## Pipeline

```text
code → typecheck → lint → test → build → migrations (staging)
  → smoke → approve → migrations (production) → deploy app
```

**Não deployar** com TypeScript, lint crítico, build, migrations ou testes críticos falhando.

## Migrations

- Ordem em `supabase/migrations/`
- Nunca reescrever migration já aplicada
- Destrutivas: backup + staging + plano de rollback

## Variáveis

Ver `.env.example` — separar `NEXT_PUBLIC_*` de server-only.  
`SUPABASE_SERVICE_ROLE_KEY` e API keys de IA **nunca** no browser.

## Feature flags

- `FEATURE_ASSISTANT_ENABLED`
- `FEATURE_PORTAL_ENABLED`
- + flags por clínica (`feature_flags` JSON)

## Smoke pós-deploy

1. `GET /api/health` → ok  
2. Login profissional  
3. Home + Agenda  
4. Um paciente  
5. Secretária Virtual (se flag on) — falha de IA não derruba Agenda  

## Versionamento

Produto: **Sorria 1.0.0** (`src/lib/version.ts` / `package.json`).
