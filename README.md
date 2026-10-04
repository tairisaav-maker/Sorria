# Sorria

**Gestão inteligente para consultórios**

## Versão

**1.7.0** — Reestruturação Subfase 7 (Reposição inteligente e lista de compras)

> Agenda → Procedimento → Materiais → Estoque → Custo → Evolução → Financeiro  
> Segurança ≠ esconder botão · UUID ≠ autorização · Demo ≠ produção · IA ≠ banco

## Como rodar

```bash
cp .env.example .env.local
npm install
npm run dev
```

### Login profissional (demo)

`demo@sorria.app` / `sorria-demo` → `/app`

Núcleo: Agenda · Pacientes · Estoque · Financeiro

- Procedimentos (catálogo): `/app/procedimentos`
- Atendimento / consumo / financeiro do procedimento: `/app/agenda/atendimento/[id]`
- Paciente → aba Procedimentos (custo, cobrado, recebido, saldo)
- Estoque: `/app/estoque` · Reposição · Previsão · Compras · Movimentações
- Onboarding: `/app/onboarding`
- Configurações: `/app/configuracoes`
- Relatórios operacionais: `/app/relatorios` (visão geral · procedimentos · materiais · pacientes · financeiro)
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

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [DATABASE.md](./DATABASE.md)
- [SECURITY.md](./SECURITY.md)
- [SECURITY_MATRIX.md](./SECURITY_MATRIX.md)
- [INVENTORY_AND_COSTS.md](./INVENTORY_AND_COSTS.md)
- [PATIENT_PROCEDURE_FLOW.md](./PATIENT_PROCEDURE_FLOW.md)
- [REPORTS.md](./REPORTS.md)
- [OPERATIONAL_REPORTS.md](./OPERATIONAL_REPORTS.md)
- [REPLENISHMENT.md](./REPLENISHMENT.md)
- [ASSISTANT.md](./ASSISTANT.md)
- [BACKUP_AND_RECOVERY.md](./BACKUP_AND_RECOVERY.md)
- [DEPLOYMENT.md](./DEPLOYMENT.md)
- [OPERATIONS.md](./OPERATIONS.md)
- [CHANGELOG.md](./CHANGELOG.md)
- [docs/produto](./docs/produto/README.md)
- [ROADMAP.md](./ROADMAP.md)
