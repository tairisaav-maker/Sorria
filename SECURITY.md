# Security — Sorria

## Princípios

**Deny by default · Least privilege · Defense in depth · Tenant isolation**

## Regras estruturais

```text
Administrativo ≠ Clínico
Agenda ≠ Prontuário
Rascunho ≠ Registro finalizado
Correção ≠ Sobrescrita silenciosa
Owner administrativo ≠ acesso clínico universal
Arquivo privado ≠ URL pública
```

## Prontuário (Fase 4)

Permissões: `clinical_record.*`, `anamnesis.*`, `clinical_evolution.*`, `odontogram.*`, `clinical_files.*`

- Secretária: clínico **NEGADO** (sem badges/contadores clínicos)
- Dentista: clínico conforme matriz
- Owner: administrativo; clínico somente com `clinical_access`
- Cross-clinic: UUID/path conhecidos → not found
- Storage: bucket privado; signed URL temporária; path tenant-bound
- Evolução finalizada: sem update silencioso; correção versionada
- Audit: ações de anamnese/evolução/odontograma/arquivo **sem** dump completo do conteúdo clínico

## Cadeia

```text
Auth → Membership → Clinic → Permission (+ clinical_access) → Tenant Check → RLS → Data/Storage
```
