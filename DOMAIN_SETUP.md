# DOMAIN_SETUP.md

# Domínio do Sorria

## Estrutura desejada

| Host | Uso |
| --- | --- |
| `sorria.com.br` | Site público / marketing (futuro) |
| `app.sorria.com.br` | **Aplicação** (login, agenda, clínica) |
| `www.sorria.com.br` | Opcional — redirecionar para `sorria.com.br` |

Nesta etapa o foco é **`app.sorria.com.br`**.

A URL pública da aplicação vem **somente** de:

```text
NEXT_PUBLIC_APP_URL=https://app.sorria.com.br
```

Não hardcode o domínio no código.

---

## 1. Comprar / ter o domínio

Exemplo de registradores:

- Registro.br
- Cloudflare Registrar
- GoDaddy
- Namecheap

Anote onde está o **DNS** (às vezes diferente de onde comprou).

---

## 2. Adicionar domínio na Vercel

1. Projeto Sorria na Vercel → **Settings → Domains**
2. Adicione: `app.sorria.com.br`
3. A Vercel mostra os registros DNS necessários (copie exatamente)

Produção deve responder **somente via HTTPS** (a Vercel cuida do certificado).

---

## 3. Registros DNS típicos

### Subdomínio do app (`app`)

Na maioria dos casos a Vercel pede:

| Tipo | Nome / Host | Valor / Destino |
| --- | --- | --- |
| `CNAME` | `app` | `cname.vercel-dns.com` |

Alguns painéis pedem o host completo `app.sorria.com.br` em vez de só `app`.

### Apex (`sorria.com.br`) — site futuro

Quando for publicar o site institucional:

| Tipo | Nome | Valor |
| --- | --- | --- |
| `A` | `@` | IP que a Vercel indicar **ou** |
| `CNAME` / ALIAS / ANAME | `@` | conforme o provedor e a Vercel |

Ou mantenha o apex apontando para uma landing estática até criar o site.

### WWW (opcional)

| Tipo | Nome | Valor |
| --- | --- | --- |
| `CNAME` | `www` | `cname.vercel-dns.com` (ou redirect para apex) |

---

## 4. Por provedor (orientação geral)

### Registro.br

1. Entre em **DNS** do domínio
2. Adicione o `CNAME` `app` → valor indicado pela Vercel
3. Salve e aguarde propagação

### Cloudflare

1. DNS → **Add record**
2. Type `CNAME`, Name `app`, Target `cname.vercel-dns.com`
3. Proxy: pode começar **DNS only** (cinza) até validar; depois pode ativar proxy laranja se desejado
4. SSL/TLS: modo **Full (strict)** quando usar proxy

### GoDaddy / similares

1. DNS Management
2. Add `CNAME` host `app` apontando para o valor da Vercel
3. Remova registros conflitantes no mesmo host `app`

---

## 5. Auth e domínio

Após o DNS ficar verde na Vercel, atualize o Supabase:

- **Site URL** = `https://app.sorria.com.br`
- **Redirect URLs** incluem `https://app.sorria.com.br/auth/callback`

E na Vercel:

```text
NEXT_PUBLIC_APP_URL=https://app.sorria.com.br
```

Redeploy se alterar variáveis.

---

## 6. Checklist

- [ ] `app.sorria.com.br` adicionado na Vercel
- [ ] DNS `CNAME` (ou registro pedido) publicado
- [ ] Status “Valid” / certificado OK
- [ ] `https://app.sorria.com.br` abre (não `http://`)
- [ ] `/login` funciona
- [ ] `/api/health` responde ok
- [ ] Supabase Auth URLs atualizadas
- [ ] `NEXT_PUBLIC_APP_URL` = URL final

---

## 7. Staging (recomendado)

Antes de produção, use:

- URL Vercel Preview, **ou**
- `staging.sorria.com.br` com projeto Supabase de staging

Mesma lógica de DNS + env vars, valores diferentes.
