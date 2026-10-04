# Sorria

**Gestão inteligente para consultórios**

## Fase atual

**FASE 8 — Relatórios e Indicadores**

> Dado → contexto → decisão  
> Plano aceito ≠ Receita · Resultado do período ≠ lucro líquido · Paciente ativo ≠ atendido

## Como rodar

```bash
cp .env.example .env.local
npm install
npm run dev
```

### Login profissional (demo)

`demo@sorria.app` / `sorria-demo` → `/app`

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
- [ROADMAP.md](./ROADMAP.md)
