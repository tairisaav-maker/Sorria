# Sorria

**Gestão inteligente para consultórios**

O Sorria é um sistema de gestão odontológica simples, rápido e pensado para a dentista que começa o consultório sozinha. A clínica é um dado configurável da conta — não faz parte da marca do produto.

## Fase atual

**FASE 0 — Fundação**

- Next.js + TypeScript + Tailwind CSS
- Integração Supabase (Auth + schema inicial + RLS)
- Layout profissional (sidebar desktop + bottom nav mobile)
- Login com identidade Sorria
- Home com dados mockados
- Documentação inicial

## Stack

- Next.js / React / TypeScript
- Tailwind CSS
- Supabase (PostgreSQL, Auth, Storage futuro, RLS)
- Zod + React Hook Form
- Lucide, date-fns, Recharts

## Como rodar localmente

```bash
cp .env.example .env.local
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

### Modo demo (sem Supabase)

No `.env.local`:

```env
NEXT_PUBLIC_DEMO_MODE=true
DEMO_EMAIL=demo@sorria.app
DEMO_PASSWORD=sorria-demo
```

Credenciais demo:

- E-mail: `demo@sorria.app`
- Senha: `sorria-demo`

### Modo Supabase

1. Crie um projeto no Supabase
2. Aplique a migration em `supabase/migrations/20251004000000_fase0_foundation.sql`
3. Preencha `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. (Opcional) desative o modo demo

## Scripts

```bash
npm run dev        # desenvolvimento
npm run lint       # ESLint
npm run typecheck  # TypeScript
npm test           # Vitest
npm run build      # build de produção
```

## Identidade

Na tela de login e materiais institucionais:

```text
Sorria
Gestão inteligente para consultórios
```

Dentro do app: **Sorria**.

O nome da clínica aparece apenas como dado da conta (ex.: `Clínica: Clínica Demo Sorria`).

## Documentação

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [DATABASE.md](./DATABASE.md)
- [SECURITY.md](./SECURITY.md)
- [ROADMAP.md](./ROADMAP.md)
