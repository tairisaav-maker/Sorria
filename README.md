# Sorria

**Gestão inteligente para consultórios**

## Versão

**1.3.0** — Reestruturação Subfase 3 (Consumo real por paciente)

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
- Atendimento / consumo: `/app/agenda/atendimento/[id]`
- Estoque: `/app/estoque` · Compras · Movimentações
- Onboarding: `/app/onboarding`
- Configurações: `/app/configuracoes`
- Relatórios: `/app/relatorios`
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
- [REPORTS.md](./REPORTS.md)
- [ASSISTANT.md](./ASSISTANT.md)
- [BACKUP_AND_RECOVERY.md](./BACKUP_AND_RECOVERY.md)
- [DEPLOYMENT.md](./DEPLOYMENT.md)
- [OPERATIONS.md](./OPERATIONS.md)
- [CHANGELOG.md](./CHANGELOG.md)
- [docs/produto](./docs/produto/README.md)
- [ROADMAP.md](./ROADMAP.md)
