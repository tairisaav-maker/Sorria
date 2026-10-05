# PRODUCTION_SETUP.md

# Deploy do Sorria — passo a passo (produção)

Este guia coloca o Sorria online em algo como:

```text
https://app.sorria.com.br
```

Não precisa ser desenvolvedora(o). Siga na ordem.

> Nunca cole chaves reais neste arquivo, no chat ou no GitHub.  
> Use `COLE_AQUI_SUA_CHAVE` como lembrete.

---

## Visão geral

```text
GitHub  →  Vercel  →  Supabase  →  Domínio
```

- **GitHub**: guarda o código
- **Vercel**: publica o site na internet (HTTPS)
- **Supabase**: banco, login e arquivos
- **Domínio**: `app.sorria.com.br`

Ambientes separados (não misturar):

| Ambiente | Uso | Demo mode |
| --- | --- | --- |
| development | Seu computador | `true` |
| staging | Teste online | `false` |
| production | Clínicas reais | `false` |

Cada ambiente tem **projeto Supabase próprio** e **variáveis próprias** na Vercel.

---

## 1. Criar projeto Supabase de produção

1. Abra [https://supabase.com](https://supabase.com) e entre na conta.
2. Clique em **New project**.
3. Nome sugerido: `sorria-production`.
4. Região: preferência Brasil/South America se disponível.
5. Defina uma senha forte do banco (guarde em local seguro — **não** no Git).
6. Aguarde o projeto ficar pronto.

Anote (Dashboard → **Project Settings → API**):

| Variável | Onde copiar |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `anon` `public` |
| `SUPABASE_SERVICE_ROLE_KEY` | `service_role` (**secret**) |

**Regra:** `SUPABASE_SERVICE_ROLE_KEY` **nunca** começa com `NEXT_PUBLIC_`.

---

## 2. Aplicar migrations

No computador, na pasta do projeto Sorria:

```bash
# Instale a CLI do Supabase uma vez (se ainda não tiver)
npm install -g supabase

# Faça login
supabase login

# Vincule ao projeto de produção (ID em Project Settings → General)
supabase link --project-ref COLE_AQUI_O_PROJECT_REF

# Aplique as migrations versionadas
supabase db push
```

As migrations ficam em `supabase/migrations/`.  
Não faça alterações manuais “escondidas” só no Dashboard sem versionar.

Alternativa: SQL Editor do Dashboard → colar e rodar cada arquivo `.sql` **na ordem do nome** (mais antigo primeiro).

---

## 3. Configurar Auth URLs

No Supabase → **Authentication → URL Configuration**:

| Campo | Valor (produção) |
| --- | --- |
| Site URL | `https://app.sorria.com.br` |
| Redirect URLs | `https://app.sorria.com.br/auth/callback` |
| | `https://app.sorria.com.br/login` |
| | `http://localhost:3000/auth/callback` (dev) |
| | `http://localhost:3000/login` (dev) |

Confirmação de e-mail, recuperação de senha e convites usam esses redirects.

---

## 4. Configurar Storage

1. Crie buckets **privados** para documentos clínicos (não públicos).
2. Confirme policies com `clinic_id` / membership.
3. Downloads sensíveis: **signed URLs** temporárias (nunca link público permanente de prontuário).

Detalhes: [SECURITY.md](./SECURITY.md) · [BACKUP_AND_RECOVERY.md](./BACKUP_AND_RECOVERY.md).

---

## 5. Configurar variáveis de ambiente (local de referência)

Arquivo modelo: `.env.example`  
Arquivo real (não commitado): `.env.local`

Produção (valores na Vercel, não no Git):

```text
NEXT_PUBLIC_SUPABASE_URL=COLE_AQUI_SUA_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=COLE_AQUI_SUA_CHAVE
SUPABASE_SERVICE_ROLE_KEY=COLE_AQUI_SUA_CHAVE
NEXT_PUBLIC_APP_URL=https://app.sorria.com.br
NEXT_PUBLIC_DEMO_MODE=false
NEXT_PUBLIC_SORRIA_ENV=production
NEXT_PUBLIC_PILOT_MODE=false
FEATURE_ASSISTANT_ENABLED=false
FEATURE_PORTAL_ENABLED=false
FEATURE_COMMERCIAL_BETA=true
```

---

## 6. Subir repositório no GitHub

### PASSO A — Conta e repositório

1. Abra [https://github.com](https://github.com) e entre (ou crie conta).
2. Clique em **New repository**.
3. Nome sugerido: `sorria`.
4. Deixe **Private**.
5. **Não** marque “Add README” se o código já existe no computador.
6. Crie o repositório e copie a URL (ex.: `https://github.com/SEU_USUARIO/sorria.git`).

### PASSO B — No computador (Cursor / terminal)

Na pasta do projeto:

```bash
git status
git remote -v
```

Se **ainda não** existir `origin`:

```bash
git remote add origin https://github.com/SEU_USUARIO/sorria.git
```

Envie a branch atual (exemplo):

```bash
git push -u origin HEAD
```

Ou, se quiser publicar a branch principal:

```bash
git branch -M main
git push -u origin main
```

Confirme no GitHub que os arquivos apareceram.  
**Não** deve aparecer `.env` / `.env.local`.

---

## 7. Criar projeto na Vercel

1. Abra [https://vercel.com](https://vercel.com) e entre (pode usar login GitHub).
2. **Add New… → Project**.
3. Importe o repositório `sorria`.
4. Framework: **Next.js** (detectado automaticamente).
5. **Ainda não** clique Deploy — configure as env vars primeiro (passo 8).

---

## 8. Adicionar env vars na Vercel

Em **Settings → Environment Variables**, adicione para **Production** (e Staging se quiser):

| Nome | Valor |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `COLE_AQUI_SUA_URL` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `COLE_AQUI_SUA_CHAVE` |
| `SUPABASE_SERVICE_ROLE_KEY` | `COLE_AQUI_SUA_CHAVE` |
| `NEXT_PUBLIC_APP_URL` | `https://app.sorria.com.br` |
| `NEXT_PUBLIC_DEMO_MODE` | `false` |
| `NEXT_PUBLIC_SORRIA_ENV` | `production` |
| `NEXT_PUBLIC_PILOT_MODE` | `false` |
| `FEATURE_ASSISTANT_ENABLED` | `false` |
| `FEATURE_PORTAL_ENABLED` | `false` |
| `FEATURE_COMMERCIAL_BETA` | `true` |
| `NEXT_PUBLIC_SORRIA_CONTACT_EMAIL` | seu e-mail de contato |

Use projetos Supabase **diferentes** para Preview/Staging e Production.

---

## 9. Deploy

1. Na Vercel, clique em **Deploy**.
2. Aguarde o build ficar verde.
3. Abra a URL temporária (`*.vercel.app`).
4. Teste: `https://SEU-PROJETO.vercel.app/api/health` → deve retornar `"status":"ok"`.

Se o build falhar, leia o log na Vercel. Localmente valide antes:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

---

## 10. Configurar domínio

Ver guia completo: [DOMAIN_SETUP.md](./DOMAIN_SETUP.md).

Resumo:

- Site institucional futuro: `sorria.com.br`
- Aplicativo: `app.sorria.com.br`

Na Vercel → **Settings → Domains** → adicione `app.sorria.com.br`.

---

## 11. Configurar DNS

No registrador do domínio (Registro.br, Cloudflare, GoDaddy, etc.):

Siga exatamente os registros que a Vercel mostrar (geralmente `CNAME` para `cname.vercel-dns.com` no subdomínio `app`).

Aguarde a propagação (minutos a poucas horas).

---

## 12. Testar HTTPS

1. Abra `https://app.sorria.com.br` (não use `http://`).
2. O cadeado do navegador deve aparecer.
3. A Vercel emite o certificado automaticamente.

---

## 13. Testar login

1. `https://app.sorria.com.br/login`
2. Entre com um usuário autorizado do projeto Supabase de produção.
3. Deve ir para `/app` (home).
4. Logout e login de novo.
5. Abra um deep link (ex.: `/app/agenda`) sem sessão → deve ir para login e voltar após autenticar.

---

## 14. Testar PWA

Ver [PWA_SETUP.md](./PWA_SETUP.md).

Checklist rápido:

- Nome instalado: **Sorria**
- Ícone correto
- Abre em modo standalone (sem barra de endereço completa)
- Manifest em `/manifest.webmanifest`
- Offline: mensagem amigável (não stack trace)

---

## Checklist manual (pessoa não técnica)

```text
PASSO 1  — Abra github.com e crie o repositório privado "sorria"
PASSO 2  — No Cursor/terminal: conecte o remote e faça git push
PASSO 3  — Abra supabase.com e crie o projeto sorria-production
PASSO 4  — Aplique as migrations (supabase db push)
PASSO 5  — Configure Site URL e Redirect URLs do Auth
PASSO 6  — Abra vercel.com e importe o repositório
PASSO 7  — Cole as variáveis de ambiente (sem NEXT_PUBLIC_ na service role)
PASSO 8  — Deploy e abra /api/health
PASSO 9  — Adicione o domínio app.sorria.com.br e configure o DNS
PASSO 10 — Teste login, agenda e instalação no celular
```

---

## Backup e restore

- Política: [BACKUP_AND_RECOVERY.md](./BACKUP_AND_RECOVERY.md)
- Em produção: ative backups/PITR do plano Supabase contratado
- Restore: sempre em cópia/staging antes de apontar DNS

## Monitoramento

- Health: `GET /api/health` (sem secrets)
- Error tracking externo (Sentry/OTEL): opcional — variáveis comentadas em `.env.example`
- Não instalar serviço pago sem decisão explícita

## Segurança rápida

- RLS + `clinic_id` + membership (ver testes em `src/tests/production/`)
- Service role só no servidor
- Storage clínico privado
- Headers CSP / HSTS em produção (`next.config.ts`)

## Depois do PWA

Avaliar no futuro **App Store** / **Google Play** — **não** nesta etapa.
