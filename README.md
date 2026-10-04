# Sorria

**Gestão inteligente para consultórios**

## Versão

**1.0.0** — FASE 10 (produção / onboarding / polimento)

> Segurança ≠ esconder botão · UUID ≠ autorização · Demo ≠ produção · IA ≠ banco

## Como rodar

```bash
cp .env.example .env.local
npm install
npm run dev
```

### Login profissional (demo)

`demo@sorria.app` / `sorria-demo` → `/app`

- Onboarding: `/app/onboarding`
- Configurações: `/app/configuracoes`
- Secretária Virtual: `/app/assistente`
- Relatórios: `/app/relatorios`

### Login Portal (demo)

`paciente@sorria.app` / `sorria-demo` → `/portal/inicio`

## Scripts

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Docs

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [DATABASE.md](./DATABASE.md)
- [SECURITY.md](./SECURITY.md)
- [SECURITY_MATRIX.md](./SECURITY_MATRIX.md)
- [REPORTS.md](./REPORTS.md)
- [ASSISTANT.md](./ASSISTANT.md)
- [BACKUP_AND_RECOVERY.md](./BACKUP_AND_RECOVERY.md)
- [DEPLOYMENT.md](./DEPLOYMENT.md)
- [OPERATIONS.md](./OPERATIONS.md)
- [CHANGELOG.md](./CHANGELOG.md)
- [docs/produto](./docs/produto/README.md)
- [ROADMAP.md](./ROADMAP.md)
