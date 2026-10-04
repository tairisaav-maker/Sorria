# Changelog

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
