# Changelog

## 1.3.0 — 2026-10-04

### Added
- **Subfase 3:** `performed_procedures`, `procedure_consumptions`, `appointment_consumptions`
- Snapshot da ficha, consumo previsto×real, material extra/substituto
- Baixa idempotente, rateio per_appointment, correção com histórico
- Custo/resultado bruto/margem por procedimento do paciente
- UI atendimento + aba Procedimentos no paciente; evolução e financeiro sem cobrança duplicada

## 1.2.0 — 2026-10-04

### Added
- **Subfase 2:** compras, purchase items (snapshot de conversão), movimentos, lotes
- Estoque inicial, ajuste por contagem, perda, vencimento, devolução, correção
- Custo médio ponderado aplicado nas entradas; cancelamento de compra com reversão
- UI `/app/estoque/compras`, `/movimentacoes`, detalhe do item; card Estoque na Home
- Permissões `inventory.movements_view`, `inventory.cost_view`

### Changed
- Cadastro de item não altera mais saldo nem custo médio (somente movimentos)

## 1.1.0 — 2026-10-04

### Changed
- **Reestruturação do produto (Subfase 1):** núcleo Agenda → Procedimento → Materiais → Estoque → Custo
- Navegação principal: Início, Agenda, Pacientes, Estoque, Financeiro; Portal/Assistente despriorizados

### Added
- Catálogo `procedures` + ficha `procedure_materials` + `inventory_items`
- Permissions/RLS; services; UI `/app/procedimentos`, `/app/estoque`
- Cálculo de consumo/custo padrão (centavos); modos per_appointment/per_procedure/per_unit/manual
- [INVENTORY_AND_COSTS.md](./INVENTORY_AND_COSTS.md)

### Not yet (próximas subfases)
- Compras, movimentos, custo médio ponderado aplicado
- Baixa automática / consumo real / previsão da agenda

## 1.0.0 — 2026-10-04

### Added
- Fases 0–9: fundação, authz, pacientes, agenda, prontuário, tratamentos, financeiro, portal, relatórios, Secretária Virtual
- FASE 10: onboarding retomável, configurações (clínica/agenda/perfil/segurança), checklist na Home
- Health check, security headers/CSP, rate limit de login, error/404 pages
- Feature flags (assistant/portal), observabilidade abstrata, versão 1.0.0
- Docs: SECURITY_MATRIX, BACKUP_AND_RECOVERY, DEPLOYMENT, OPERATIONS, produto

### Security
- RLS auditado nas entidades tenant; isolation cross-clinic testado
- Service role ausente do client bundle
- Placeholders Termos/Privacidade (revisão jurídica pendente)

### Notes
- Cobrança SaaS do Sorria **não** implementada
- IA clínica / WhatsApp / convênios fora do núcleo imediato
