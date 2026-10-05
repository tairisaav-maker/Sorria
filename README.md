# Sorria

**Gestão inteligente para consultórios**

## Versão

**0.14.0-beta** — Pronto para publicação online + PWA instalável

> App em `https://app.sorria.com.br` (após configurar GitHub → Vercel → Supabase → DNS).  
> [PRODUCTION_SETUP.md](./PRODUCTION_SETUP.md) · [DOMAIN_SETUP.md](./DOMAIN_SETUP.md) · [PWA_SETUP.md](./PWA_SETUP.md)

## Como rodar

```bash
cp .env.example .env.local
npm install
npm run dev
```

### Login profissional (demo / teste V1)

Senha: `DEMO_PASSWORD` em `.env.local` (padrão local `sorria-demo`).

| Perfil | E-mail |
|--------|--------|
| Owner | `demo@sorria.app` |
| Dentista | `carlos.a@clinicademo.sorria.app` |
| Secretária | `mariana.a@clinicademo.sorria.app` |

Clínica de teste: **Clínica Teste Sorria**. Checklist: [TEST_REPORT.md](./TEST_REPORT.md)

Núcleo: Agenda · Pacientes · Estoque · Financeiro

- Procedimentos (catálogo): `/app/procedimentos`
- Atendimento / consumo / financeiro do procedimento: `/app/agenda/atendimento/[id]`
- Paciente → aba Procedimentos (custo, cobrado, recebido, saldo)
- Estoque: `/app/estoque` · Reposição · Previsão · Compras · Movimentações
- Onboarding: `/app/onboarding`
- Configurações: `/app/configuracoes`
- Custos do consultório: `/app/financeiro/custos` (despesas, horas produtivas, custo/hora, simuladores)
- Preço e custos na ficha do procedimento: `/app/procedimentos/[id]`
- Relatórios operacionais: `/app/relatorios` (visão geral · procedimentos · materiais · pacientes · financeiro · preços e margens)
- Secretária Virtual (secundário): `/app/assistente`

### Login Portal (demo)

`paciente@sorria.app` / `sorria-demo` → `/portal/inicio`  
(Portal despriorizado no V1 comercial — código preservado.)

## Scripts

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Deploy do Sorria

```text
GitHub → Vercel → Supabase → Domínio (app.sorria.com.br)
```

Guia completo (passo a passo, inclusive para quem não programa):

1. [PRODUCTION_SETUP.md](./PRODUCTION_SETUP.md) — Supabase produção, env vars, Vercel, checklist
2. [DOMAIN_SETUP.md](./DOMAIN_SETUP.md) — DNS `sorria.com.br` / `app.sorria.com.br`
3. [PWA_SETUP.md](./PWA_SETUP.md) — instalar no celular / tablet / PC

Variáveis: veja `.env.example`.  
`SUPABASE_SERVICE_ROLE_KEY` **nunca** com prefixo `NEXT_PUBLIC_`.

Antes de publicar:

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

## Docs

- [PRODUCTION_SETUP.md](./PRODUCTION_SETUP.md) · [DOMAIN_SETUP.md](./DOMAIN_SETUP.md) · [PWA_SETUP.md](./PWA_SETUP.md)
- [PROCEDURE_LIBRARY.md](./PROCEDURE_LIBRARY.md) — biblioteca inteligente de procedimentos e materiais
- [V1_PRODUCT_FLOW.md](./V1_PRODUCT_FLOW.md) — fluxo integrado do V1
- [PILOT_RUNBOOK.md](./PILOT_RUNBOOK.md) · [PILOT_CHECKLIST.md](./PILOT_CHECKLIST.md) · [PILOT_REPORT.md](./PILOT_REPORT.md)
- [COMMERCIAL_BETA.md](./COMMERCIAL_BETA.md) · [GO_TO_MARKET.md](./GO_TO_MARKET.md) · [SALES_DEMO.md](./SALES_DEMO.md) · [PRICING_RESEARCH.md](./PRICING_RESEARCH.md)
- [SAAS_OPERATIONS.md](./SAAS_OPERATIONS.md) · [PRODUCTION_READINESS.md](./PRODUCTION_READINESS.md)
- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [DATABASE.md](./DATABASE.md)
- [SECURITY.md](./SECURITY.md)
- [SECURITY_MATRIX.md](./SECURITY_MATRIX.md)
- [INVENTORY_AND_COSTS.md](./INVENTORY_AND_COSTS.md)
- [PATIENT_PROCEDURE_FLOW.md](./PATIENT_PROCEDURE_FLOW.md)
- [REPORTS.md](./REPORTS.md)
- [OPERATIONAL_REPORTS.md](./OPERATIONAL_REPORTS.md)
- [OPERATIONAL_COSTING.md](./OPERATIONAL_COSTING.md)
- [PRICING_AND_MARGIN.md](./PRICING_AND_MARGIN.md)
- [REPLENISHMENT.md](./REPLENISHMENT.md)
- [ASSISTANT.md](./ASSISTANT.md)
- [BACKUP_AND_RECOVERY.md](./BACKUP_AND_RECOVERY.md)
- [DEPLOYMENT.md](./DEPLOYMENT.md)
- [OPERATIONS.md](./OPERATIONS.md)
- [CHANGELOG.md](./CHANGELOG.md)
- [docs/produto](./docs/produto/README.md)
- [ROADMAP.md](./ROADMAP.md)
