# Sorria

**Gestão inteligente para consultórios**

## Versão

**0.11.0-beta** — Beta comercial (landing, lead, demo, ativação) · preços definitivos pendentes

> Saiba quanto cada procedimento realmente custa.  
> Agenda → Atendimento → Procedimento → Consumo → Estoque → Evolução → Custo → Financeiro  
> [COMMERCIAL_BETA.md](./COMMERCIAL_BETA.md) · [GO_TO_MARKET.md](./GO_TO_MARKET.md) · [SALES_DEMO.md](./SALES_DEMO.md)

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

## Docs

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
