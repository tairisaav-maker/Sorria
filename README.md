# Sorria

**Gestão inteligente para consultórios**

## Fase atual

**FASE 7 — Portal do Paciente**

> Solicitação ≠ Consulta · Paciente ≠ profissional · E-mail igual ≠ vínculo  
> Arquivo do paciente ≠ arquivo liberado · Conhecer UUID ≠ autorização

## Como rodar

```bash
cp .env.example .env.local
npm install
npm run dev
```

### Login profissional (demo)

`demo@sorria.app` / `sorria-demo` → `/app`

### Login Portal do paciente (demo)

`paciente@sorria.app` / `sorria-demo` → `/portal/inicio`

(Mariana Oliveira — Clinic A; também responsável do menor João Pedro.)

Outros: `paciente2@sorria.app`, `revogado@sorria.app` (acesso negado).

## Scripts

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## Docs

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [DATABASE.md](./DATABASE.md)
- [SECURITY.md](./SECURITY.md)
- [ROADMAP.md](./ROADMAP.md)
