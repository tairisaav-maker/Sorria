# PWA_SETUP.md

# Sorria como aplicativo (PWA)

O Sorria pode ser instalado no celular, tablet e computador **sem App Store / Google Play**.

É uma Progressive Web App: continua atualizando pela web.

---

## O que foi configurado no código

| Item | Onde |
| --- | --- |
| Manifest | `src/app/manifest.ts` → `/manifest.webmanifest` |
| Service Worker | `public/sw.js` |
| Offline | `src/app/offline/page.tsx` |
| Registro SW + install UI | `src/components/pwa/pwa-provider.tsx` |
| Botão Instalar | Configurações → card **Instalar Sorria** |
| Ícones | `public/icons/` (192, 512, maskable, apple-touch, favicons) |

### Manifest (valores)

```text
name:            Sorria
short_name:      Sorria
description:     Gestão inteligente para consultórios
display:         standalone
start_url:       /
theme_color:     #246B73
background_color:#F7F9FA
```

### Service Worker — o que faz / o que NÃO faz

**Faz**

- Precache do shell (`/`, `/offline`, ícones)
- Navegação: network-first; se offline → tela amigável
- Cache de assets estáticos (`/_next/static`, ícones)

**Não faz**

- Não cacheia prontuário, evolução, financeiro, pacientes
- Não permite edição clínica offline
- Não sincroniza dados sensíveis em background nesta fase

### Offline

Texto ao usuário:

> **Você está sem conexão**  
> Verifique sua internet para continuar usando o Sorria.

---

## Desenvolvimento local

O service worker **não** registra em `npm run dev` por padrão (para não atrapalhar o HMR).

Para testar PWA em local:

```text
http://localhost:3000/?pwa=1
```

Em produção (Vercel + HTTPS), o SW registra automaticamente.

---

## Critérios de instalabilidade

Em geral o navegador exige:

1. HTTPS (ou localhost)
2. Manifest válido com `name`, `icons` (192 + 512), `display`, `start_url`
3. Service worker controlando a origem
4. Ícones adequados

---

## Como instalar

### Android (Chrome)

1. Abra `https://app.sorria.com.br` no Chrome
2. Faça login
3. Menu ⋮ → **Instalar aplicativo** / **Adicionar à tela inicial**  
   **ou** use **Configurações → Instalar Sorria** quando o botão aparecer
4. Confirme — o ícone **Sorria** aparece na tela inicial
5. Abra: deve parecer app (standalone), não só uma aba

### iPhone / iPad (Safari)

Safari **não** tem o mesmo botão programático do Chrome.

1. Abra no **Safari** (não só atalho de outro browser)
2. Toque em **Compartilhar**
3. Toque em **Adicionar à Tela de Início**
4. Nome: **Sorria** → Adicionar

No app, em Configurações, o Sorria mostra essa dica quando detecta iOS.

### Computador (Chrome / Edge)

1. Abra o site em HTTPS
2. Ícone de instalação na barra de endereço **ou** menu → Instalar Sorria
3. Ou Configurações → **Instalar Sorria** (quando o evento `beforeinstallprompt` estiver disponível)

### Quando o botão não aparece

- Já está instalado / modo standalone
- Navegador sem suporte ao prompt
- Ainda em HTTP (exceto localhost)
- Critérios do Chrome ainda não satisfeitos

A UI **esconde** o fluxo nativo se não houver suporte; no iOS mostra a instrução curta.

---

## Teste de PWA (checklist)

- [ ] Nome instalado: **Sorria** (não “localhost” / “Vercel App”)
- [ ] Ícone correto
- [ ] `display: standalone`
- [ ] `start_url` correto
- [ ] HTTPS em produção
- [ ] `/manifest.webmanifest` válido
- [ ] Offline mostra a tela amigável
- [ ] Dados clínicos sensíveis **não** ficam em cache persistente do SW

### Navegadores a validar após o deploy

- Chrome desktop
- Chrome Android
- Safari iPhone/iPad
- Edge

---

## Limitações desta fase

- Sem modo offline clínico completo
- Sem push notifications obrigatórias
- Sem publicação em App Store / Google Play
- Futuro: avaliar lojas **depois** de validar o PWA em uso real

---

## Troubleshooting

| Problema | O que checar |
| --- | --- |
| Não instala | HTTPS, manifest, SW registrado (DevTools → Application) |
| Nome errado | `name` / `short_name` no manifest; limpar SW antigo |
| Ícone genérico | cache do SW; ícones em `/icons/` |
| Offline quebrado | precache de `/offline`; navegação network-first |
| Dev estranho | remova SW em Application → Unregister; evite `?pwa=1` no dia a dia |
