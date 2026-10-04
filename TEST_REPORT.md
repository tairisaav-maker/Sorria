# TEST_REPORT — Sorria V1 (preparação para teste manual)

**Data:** 2026-10-04  
**Branch:** `cursor/teste-completo-v1-1c42`  
**Versão:** 0.11.0-beta  
**Modo:** `NEXT_PUBLIC_DEMO_MODE=true` (development / demo stores em memória)

---

## Ambiente testado

| Item | Valor |
|------|--------|
| Runtime | Next.js 15 · Node local |
| Banco | Stores demo em memória (sem Supabase obrigatório) |
| Clínica A | **Clínica Teste Sorria** |
| Clínica B | Odonto Vida (isolamento) |
| Canal | development + demo — **não** produção comercial |

---

## Build / TypeScript / Lint / Testes

| Gate | Resultado |
|------|-----------|
| TypeScript (`tsc --noEmit`) | ✅ OK |
| Lint (`next lint`) | ✅ OK (0 warnings) |
| Testes (`vitest run`) | ✅ **401** passando (34 arquivos) |
| Build produção (`next build`) | ✅ OK |

---

## ESTADO ATUAL DO SORRIA

### FUNCIONANDO

- Login demo (owner / dentista / secretária / Clinic B) via `/login` + `DEMO_PASSWORD`
- Multi-tenant Clinic A ≠ Clinic B
- Catálogo de procedimentos + ficha técnica (materiais / modos de consumo)
- Estoque, conversão compra→consumo, compras, custo médio ponderado, movimentações
- Agenda + procedimentos planejados no atendimento
- Atendimento: consumo previsto×real, confirmação, baixa, material extra, actual=0
- Evolução clínica (criar / finalizar; secretária sem acesso)
- Financeiro do procedimento: cobrado / recebido / saldo; null ≠ 0
- Pagamentos sem duplicar cobrança
- Previsão Agenda→estoque (sem baixar só por estar na Agenda)
- Reposição + lista de compras (lista ≠ estoque)
- Relatórios operacionais a partir de dados reais do store
- Custo operacional (despesas / horas / custo-hora) — seed Clinic A
- Permissões owner / dentista / secretária
- E2E serviço: paciente→agenda→consumo→evolução→financeiro→pagamento→conclusão

### PARCIAL

- Portal do Paciente e Secretária Virtual: código existe, **fora do foco V1 comercial** (não testar como núcleo)
- Landing / SaaS beta comercial (Subfase 11–12): existe, **fora deste teste operacional**
- Relatórios de margem/preço: dependem de dados gerados no uso; seed não pré-carrega histórico rico
- Login profissional: senha vem de `.env.local` (`DEMO_PASSWORD`); UI só lembra o nome da variável + e-mails de teste

### NÃO IMPLEMENTADO (não inventar agora)

- Checkout / gateway de pagamento SaaS real
- Preços comerciais definitivos
- Provider de e-mail transacional
- IA clínica
- Integração bancária / NF-e / TISS
- Browser E2E (Playwright de produto) — cobertura atual é Vitest de serviços

### COM ERRO

- Nenhum P0 aberto após esta preparação (gates verdes).

### MOCK

- Todo o ambiente de teste usa **demo stores** (dados fictícios em memória). Reiniciar o servidor zera alterações não persistidas em Supabase.
- `/src/lib/mock/home.ts` existe como legado; a Home real usa `buildHomeDashboard` + serviços.

---

## Dados de demonstração (após preparação)

### Clínica

**Clínica Teste Sorria** (Clinic A)

### Usuários de teste

Senha: valor de `DEMO_PASSWORD` em `.env.local` (padrão local: `sorria-demo`).  
**Não** é senha de produção — só modo demo.

| Perfil | E-mail |
|--------|--------|
| Owner / gestora | `demo@sorria.app` (= `DEMO_EMAIL`) |
| Dentista | `carlos.a@clinicademo.sorria.app` |
| Secretária | `mariana.a@clinicademo.sorria.app` |
| Owner Clinic B | `paula@odontovida.app` |

### Pacientes (fictícios)

Mariana Oliveira · João Souza · Ana Martins · Carlos Ferreira · Fernanda Lima  
(+ outros auxiliares de fixture: Marina Costa, Camila Ferreira, etc.)

### Procedimentos

Profilaxia · Restauração pequena · **Restauração média** · Restauração extensa · Clareamento · Avaliação

### Ficha — Restauração média

| Material | Qtd | Modo |
|----------|-----|------|
| Resina A2 | 0,35 g | per_unit |
| Ácido fosfórico | 0,20 ml | per_procedure |
| Adesivo | 0,10 ml | per_procedure |
| Anestésico | 1 tubete | per_procedure |
| Agulha | 1 un | per_procedure |
| Microbrush | 2 un | per_procedure |
| Gaze | 4 un | per_procedure |
| Máscara | 1 un | per_appointment |
| Luva | 2 un | per_appointment |

### Estoque inicial (consumo)

Resina 20 g · Anestésico 50 · Agulha 50 · Microbrush 100 · Gaze 200 · Máscara 100 · Luva 200  
(+ ácido / adesivo)

Conversão: 1 seringa resina = 4 g · 1 caixa luva = 100 un

### Agenda de hoje (planejada)

| Horário | Paciente | Procedimento |
|---------|----------|--------------|
| 09:00 | Mariana Oliveira | Restauração média — dente 16 |
| 10:30 | Ana Martins | Profilaxia |
| 11:15 | João Souza | Restaurações médias — 26 e 27 |

---

## Fluxos funcionando / parciais

| Fluxo | Status |
|-------|--------|
| Login → Home | ✅ |
| Procedimentos + ficha | ✅ |
| Estoque / compra / média | ✅ |
| Agenda → atendimento → consumo | ✅ (com planos seed) |
| Evolução | ✅ |
| Custo procedimento / paciente | ✅ |
| Financeiro + pagamento | ✅ |
| Previsão / reposição / lista | ✅ |
| Relatórios | ✅ (após gerar dados no teste) |
| Custo operacional | ✅ (config seed; validar UI) |
| Portal / Assistente | Parcial / fora do escopo |

---

## Bugs encontrados / corrigidos / abertos

### Corrigidos nesta preparação

- Seed desalinhado do roteiro de teste (pacientes, procedimentos, ficha, estoque, agenda, planos)
- Acesso de teste só para owner — dentista/secretária/Clinic B agora logam com `DEMO_PASSWORD`
- Banner de piloto duplicado no demo (já tratado em commit anterior)

### Abertos (não P0)

| ID | Severidade | Descrição |
|----|------------|-----------|
| B1 | P3 | Home mock legado (`lib/mock/home.ts`) não usado na rota real — ruído de manutenção |
| B2 | P2 | Demo em memória: refresh/restart perde o progresso do teste manual |
| B3 | P3 | UI de login ainda menciona Portal (fora do núcleo V1) |

---

## Segurança

- Isolamento A/B coberto por testes
- Secretária sem evolução clínica
- Dentista sem finance admin / purchase create
- Analytics/pilot sanitizam PHI
- Credenciais demo só com `NEXT_PUBLIC_DEMO_MODE=true`

---

## Mobile / Tablet / Desktop

Preparação focada em seed + gates. Validação visual responsiva do fluxo deve ser feita no checklist manual (§ abaixo). Núcleo de atendimento foi desenhado mobile-first; estoque/relatórios melhores no desktop.

---

## Bloqueios

**Nenhum bloqueio P0 para iniciar o teste manual no modo demo.**

Condições:

1. `npm run dev` com `.env.local` contendo `NEXT_PUBLIC_DEMO_MODE=true`
2. Entrar com `demo@sorria.app` + `DEMO_PASSWORD`
3. Aceitar que dados são fictícios e voláteis (memória)

---

## Como acessar

```bash
cp .env.example .env.local   # se ainda não tiver
# garanta:
# NEXT_PUBLIC_DEMO_MODE=true
# DEMO_EMAIL=demo@sorria.app
# DEMO_PASSWORD=<sua senha local de demo>

npm install
npm run dev
```

Abrir `http://localhost:3000/login` → entrar como owner.

---

## Checklist manual (para você)

### TESTE 1 — Login

- [ ] Abrir `/login`
- [ ] Entrar com owner (`DEMO_EMAIL` + `DEMO_PASSWORD`)
- **Esperado:** Home da Clínica Teste Sorria; banner “Ambiente de demonstração”

### TESTE 2 — Procedimentos e ficha

- [ ] `/app/procedimentos` → abrir **Restauração média**
- **Esperado:** materiais da ficha (resina 0,35 g per_unit, EPI per_appointment, etc.)

### TESTE 3 — Estoque e conversão

- [ ] `/app/estoque` → Resina A2 e Luva
- **Esperado:** Resina ~20 g; Luva 200 un; conversão 1 seringa = 4 g; 1 caixa = 100 un

### TESTE 4 — Agenda Mariana

- [ ] Agenda → consulta Mariana 09:00 → Iniciar atendimento
- [ ] Ver restauração dente 16 prevista + materiais
- [ ] Alterar resina 0,35→0,45 e anestésico 1→2 → Confirmar consumo
- **Esperado:** estoque resina −0,45 g; anestésico −2; uma única movimentação por item

### TESTE 5 — Duplo clique

- [ ] Confirmar consumo novamente
- **Esperado:** sem segunda baixa

### TESTE 6 — Evolução + financeiro Mariana

- [ ] Registrar evolução fictícia e finalizar
- [ ] Valor cobrado R$ 350 → adicionar financeiro → pagar R$ 200
- **Esperado:** cobrado 350 / recebido 200 / saldo 150
- [ ] Pagar +R$ 150 → saldo 0
- **Esperado:** sem cobrança duplicada

### TESTE 7 — João (per_appointment / per_unit)

- [ ] Atendimento João (26 e 27)
- **Esperado previsão:** resina 0,70 g; máscara 1; luva 2 (não 2 máscaras / 4 luvas)
- [ ] Confirmar consumo
- **Esperado:** máscara −1; luva −2

### TESTE 8 — Material extra e zero

- [ ] Em um atendimento: + material não previsto → baixa e custo entram
- [ ] Item previsto com actual_quantity = 0 → sem baixa

### TESTE 9 — Compra e custo médio

- [ ] Compra Resina: 2 seringas, 4 g, R$ 180 total → +8 g; custo/g coerente
- [ ] (Opcional) validar média ponderada 10@20 + 10@30 → 20@25 em cenário controlado

### TESTE 10 — Previsão / reposição

- [ ] Reduzir mentalmente estoque resina vs Agenda futura
- **Esperado:** status Insuficiente sem baixar `current_quantity` só pela Agenda
- [ ] Criar lista de compras → estoque **não** sobe até compra confirmada

### TESTE 11 — Relatórios e custo operacional

- [ ] Relatórios após os atendimentos: procedimentos / materiais / paciente
- [ ] Custos: despesas ~R$ 12.000 e 120 h → custo/hora R$ 100; 45 min → R$ 75

### TESTE 12 — Segurança

- [ ] Login secretária → sem evolução clínica
- [ ] Login dentista → sem área financeira/admin completa
- [ ] Login Clinic B → não vê pacientes/estoque da Clinic A

### TESTE 13 — Null × zero

- [ ] charged_amount vazio = “não definido”
- [ ] charged_amount 0 = sem cobrança (custo permanece)

---

## Prioridade de correção (política)

- **P0/P1:** corrigir nesta fase  
- **P2:** só se atrapalhar o teste  
- **P3/P4:** não implementar automaticamente
