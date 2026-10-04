# Sorria

**Gestão inteligente para consultórios**

## Fase atual

**FASE 9 — Secretária Virtual**

> Assistente administrativa permissionada  
> IA ≠ banco · Tool ≠ permissão · Prévia ≠ execução · Sem IA clínica

## Como rodar

```bash
cp .env.example .env.local
npm install
npm run dev
```

### Login profissional (demo)

`demo@sorria.app` / `sorria-demo` → `/app`

Secretária Virtual: `/app/assistente`  
Relatórios: **Mais → Relatórios** ou `/app/relatorios`

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
- [REPORTS.md](./REPORTS.md) — definições de métricas
- [ASSISTANT.md](./ASSISTANT.md) — Secretária Virtual
- [ROADMAP.md](./ROADMAP.md)
