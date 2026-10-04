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

- [ ] **AÇÃO:** Abrir `/login` → entrar com `DEMO_EMAIL` + `DEMO_PASSWORD`  
  **RESULTADO ESPERADO:** Home da **Clínica Teste Sorria**; banner “Ambiente de demonstração”

### TESTE 2 — Pacientes

- [ ] **AÇÃO:** Abrir `/app/pacientes`  
  **RESULTADO ESPERADO:** Mariana Oliveira, João Souza, Ana Martins, Carlos Ferreira, Fernanda Lima (fictícios)

### TESTE 3 — Procedimento + ficha

- [ ] **AÇÃO:** `/app/procedimentos` → **Restauração média**  
  **RESULTADO ESPERADO:** Resina 0,35 g `per_unit`; ácido 0,20 ml; adesivo 0,10 ml; anestésico 1; agulha 1; microbrush 2; gaze 4; máscara 1 `per_appointment`; luva 2 `per_appointment`

### TESTE 4 — Estoque + conversão

- [ ] **AÇÃO:** `/app/estoque` → Resina A2 e Luva  
  **RESULTADO ESPERADO:** Resina ~20 g (1 seringa = 4 g); Luva 200 un (1 caixa = 100 un)

### TESTE 5 — Atendimento Mariana (fluxo principal)

- [ ] **AÇÃO:** Agenda → Mariana 09:00 → Iniciar → ver restauração dente 16 + materiais  
  **RESULTADO ESPERADO:** previsto resina 0,35 g e anestésico 1
- [ ] **AÇÃO:** Alterar para resina 0,45 g e anestésico 2 → Confirmar consumo  
  **RESULTADO ESPERADO:** estoque resina −0,45 g; anestésico −2; 1 movimentação por item
- [ ] **AÇÃO:** Clicar Confirmar consumo de novo  
  **RESULTADO ESPERADO:** sem segunda baixa
- [ ] **AÇÃO:** Evolução fictícia → finalizar → cobrar R$ 350 → pagar R$ 200 → concluir  
  **RESULTADO ESPERADO:** cobrado 350 / recebido 200 / saldo 150; evolução não sobrescreve em silêncio
- [ ] **AÇÃO:** Pagar +R$ 150  
  **RESULTADO ESPERADO:** saldo 0; sem cobrança duplicada

### TESTE 6 — João (per_appointment + per_unit)

- [ ] **AÇÃO:** Atendimento João (dentes 26 e 27) → ver previsão  
  **RESULTADO ESPERADO:** resina 0,70 g; máscara 1; luva 2 (não −2 máscaras / −4 luvas)
- [ ] **AÇÃO:** Confirmar consumo  
  **RESULTADO ESPERADO:** máscara −1; luva −2

### TESTE 7 — Material extra e zero

- [ ] **AÇÃO:** + Adicionar material não previsto → confirmar  
  **RESULTADO ESPERADO:** baixa + custo + histórico
- [ ] **AÇÃO:** Item previsto com quantidade real 0 → confirmar  
  **RESULTADO ESPERADO:** sem baixa desse item

### TESTE 8 — Compra e custo médio

- [ ] **AÇÃO:** Compra Resina 2 seringas × 4 g, R$ 180  
  **RESULTADO ESPERADO:** +8 g; custo/g coerente com a média ponderada
- [ ] **AÇÃO (opcional):** cenário 10 g @ R$ 20 + 10 g @ R$ 30  
  **RESULTADO ESPERADO:** 20 g @ R$ 25/g

### TESTE 9 — Previsão / reposição / lista

- [ ] **AÇÃO:** Comparar estoque baixo vs necessidade da Agenda  
  **RESULTADO ESPERADO:** “Insuficiente”; `current_quantity` **não** muda só por estar na Agenda
- [ ] **AÇÃO:** Criar lista de compras  
  **RESULTADO ESPERADO:** lista ≠ aumento de estoque (só compra confirmada altera)

### TESTE 10 — Relatórios + custo operacional

- [ ] **AÇÃO:** Relatórios após os atendimentos  
  **RESULTADO ESPERADO:** quantidade, custo médio, cobrado, previsto×utilizado (dados reais, não mock)
- [ ] **AÇÃO:** `/app/financeiro/custos`  
  **RESULTADO ESPERADO:** ~R$ 12.000 / 120 h → R$ 100/h; 45 min → R$ 75

### TESTE 11 — Null × zero e gratuito

- [ ] **AÇÃO:** procedimento sem valor informado (`null`)  
  **RESULTADO ESPERADO:** “Valor ainda não definido”
- [ ] **AÇÃO:** `charged_amount = 0`  
  **RESULTADO ESPERADO:** “Sem cobrança”; custo permanece; sem fatura

### TESTE 12 — Segurança

- [ ] **AÇÃO:** Login secretária  
  **RESULTADO ESPERADO:** sem evolução clínica
- [ ] **AÇÃO:** Login dentista  
  **RESULTADO ESPERADO:** sem financeiro/admin completo
- [ ] **AÇÃO:** Login Clinic B (`paula@odontovida.app`)  
  **RESULTADO ESPERADO:** nunca vê dados da Clínica Teste Sorria

### TESTE 13 — Mobile / tablet / desktop

- [ ] **Mobile:** Agenda → Atendimento → Consumo → Evolução → Financeiro usáveis  
- [ ] **Tablet:** fluxo Mariana completo  
- [ ] **Desktop:** Estoque, Compras, Relatórios, Configurações

---

## Prioridade de correção (política)

- **P0/P1:** corrigir nesta fase  
- **P2:** só se atrapalhar o teste  
- **P3/P4:** não implementar automaticamente
