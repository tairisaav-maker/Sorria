# Sorria

**Gestão inteligente para consultórios**

## Fase atual

**FASE 4 — Prontuário clínico**

> Administrativo ≠ Clínico · Rascunho ≠ Finalizado · Correção ≠ Sobrescrita  
> Owner administrativo ≠ acesso clínico universal

## Como rodar

```bash
cp .env.example .env.local
npm install
npm run dev
```

Demo: `demo@sorria.app` / `sorria-demo`  
(Dra. Ana = proprietária **com** `clinical_access` — também atende.)

Navegação: **Agenda** · **Pacientes → Prontuário** · **Solicitações** · **Equipe**

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
- [ROADMAP.md](./ROADMAP.md)
