# Sorria

**Gestão inteligente para consultórios**

Sistema de gestão odontológica simples e seguro. A clínica é dado configurável da conta — não faz parte da marca.

## Fase atual

**FASE 1 — Usuários, equipe, papéis, permissões e segurança**

Regra estrutural:

> Cadastro administrativo do paciente ≠ prontuário clínico

## Como rodar

```bash
cp .env.example .env.local
npm install
npm run dev
```

Demo: `demo@sorria.app` / `sorria-demo`

Depois do login: **Mais → Equipe** ou **Mais → Permissões**.

## Scripts

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Documentação

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [DATABASE.md](./DATABASE.md)
- [SECURITY.md](./SECURITY.md)
- [ROADMAP.md](./ROADMAP.md)

## Stack

Next.js, TypeScript, Tailwind, Supabase, Zod, React Hook Form, Lucide, date-fns, Recharts
