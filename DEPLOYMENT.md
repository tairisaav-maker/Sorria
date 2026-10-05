# DEPLOYMENT.md

Guia passo a passo de publicação: **[PRODUCTION_SETUP.md](./PRODUCTION_SETUP.md)**  
Domínio: **[DOMAIN_SETUP.md](./DOMAIN_SETUP.md)** · PWA: **[PWA_SETUP.md](./PWA_SETUP.md)**

## Ambientes

| Env | Uso |
| --- | --- |
| development | Demo mode / stores locais · `NEXT_PUBLIC_APP_URL=http://localhost:3000` |
| staging | Preview / staging — **DEMO_MODE=false**, DB Supabase separado |
| production | Clínicas reais — **DEMO_MODE=false**, `https://app.sorria.com.br` |

Cada ambiente: DB, Auth, Storage, secrets e URLs próprios.  
Piloto legado: ver [PILOT_RUNBOOK.md](./PILOT_RUNBOOK.md).

## Alvo de produção

```text
https://app.sorria.com.br
```

Fonte única da URL: `NEXT_PUBLIC_APP_URL` (`src/lib/app-url.ts`).

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

Canal piloto: **Sorria 0.9.0-pilot** (`src/lib/version.ts` / `package.json`).  
Não apresentar como versão comercial final.
