# BIBLIOTECA INTELIGENTE DE PROCEDIMENTOS E MATERIAIS

Biblioteca global do Sorria para acelerar o cadastro operacional de procedimentos e materiais. **Não é protocolo clínico.**

## Princípio

```text
Adicionar procedimento → Escolher da biblioteca → Ver materiais sugeridos
→ Revisar → Personalizar se necessário → Salvar no consultório
```

Template Sorria ≠ procedimento da clínica. Importação cria **snapshot** independente.

## Entidades globais

| Entidade | Escopo | Descrição |
|---|---|---|
| `material_templates` | global | Catálogo de materiais comuns |
| `procedure_templates` | global | Modelos de procedimentos por categoria |
| `procedure_template_materials` | global | Ficha sugerida (quantidade/modo) |
| `clinic_procedure_template_preferences` | clínica | Favoritos de templates ainda não importados |

Entidades da clínica (separadas):

- `procedures`
- `inventory_items`
- `procedure_materials`

Campos de vínculo no snapshot:

- `procedures.source_template_id` + `source_template_version`
- `inventory_items.source_material_template_id`
- `procedure_materials.source_material_template_id`
- `procedure_materials.clinically_variable`

## Categorias de procedimentos

Avaliação e prevenção · Dentística · Periodontia · Endodontia · Cirurgia oral · Clareamento / Estética · Prótese · Implantodontia · Odontopediatria · Ortodontia · Outros

## Materiais

Categorias: Descartáveis, Dentística, Anestesia, Endodontia, Periodontia, Cirurgia, Clareamento, Prótese, Implante, Ortodontia, Outros.

Marca **não** é obrigatória no template. Ao importar, a clínica pode criar `Resina composta — Filtek Z350 A2` ou reutilizar item existente.

## clinically_variable

Itens cuja quantidade depende da situação clínica (`anestésicos`, medicamentos, endodontia variável, suturas, etc.):

- `clinically_variable = true`
- frequentemente `consumption_mode = manual`
- UI: **Quantidade a confirmar no atendimento**
- não confirma consumo automático sem revisão

## Consumption modes

`per_appointment` · `per_procedure` · `per_unit` · `manual`

## Preço de referência vs custo real

| Conceito | Origem | Uso |
|---|---|---|
| Preço de referência | `reference_purchase_price_cents` + `reference_price_date` + `reference_source` | Onboarding / estimativa |
| Custo real | compras → custo médio ponderado | Cálculos da clínica |

Ordem: **custo real > referência**. Referência **nunca** vira compra.

Se `reference_price_date` > 180 dias: *Valor de referência — confirme seu preço de compra.*

Material sem preço: **Custo não calculado** (não assume R$ 0).

## Matching de materiais

Ao importar:

1. Match por `source_material_template_id`
2. Match por nome/alias com score alto e **único**
3. Caso ambíguo → perguntar (não unir silenciosamente)
4. Ausente → criar item (se `create_missing_materials`) ou pular

Vários templates que usam Gaze → **um** `inventory_item` Gaze + várias relações `procedure_materials`.

## UX

- Busca fuzzy + aliases (`micro brush` / `aplicador`)
- Chips: Todos · Favoritos · Mais usados · Recentes · categorias
- Cards: nome, categoria, duração, nº materiais, badge Meu procedimento / Modelo Sorria
- Desktop: grid + preview lateral
- Mobile: chips horizontais + bottom sheet
- Atendimento: `+ Procedimento` abre 6–8 mais usados primeiro
- Ações: Usar modelo · Personalizar · Criar personalizado · Duplicar · Arquivar · Favoritar
- Onboarding: multi-seleção → importação em lote

## Versionamento

`template_version` no template global. Procedimentos importados guardam a versão do snapshot. Alterações futuras no global **não** sobrescrevem a clínica. Futuro: aviso “existe versão atualizada”.

## Seed

Idempotente em `src/lib/demo/procedure-library-seed.ts` via `procedure-library-store`.

## API demo

`GET/POST /api/demo/procedure-library`

- `view=library|preview|materials|onboarding_picks|stats`
- actions: `import`, `import_batch`, `favorite`, `quick_create_material`, `duplicate`, `mark_custom`

## Analytics (opcional)

`procedure_library_opened` · `procedure_template_selected` · `procedure_template_imported` · `custom_procedure_created` · `material_quick_created`

Sem dados clínicos desnecessários.

## Limites — não implementar aqui

- recomendação clínica por IA
- protocolo / dosagem / anestesia terapêutica
- diagnóstico
- obrigatoriedade de material clínico
- marketplace / compra automática

## Código

- Types: `src/types/procedure-library.ts`
- Seed: `src/lib/demo/procedure-library-seed.ts`
- Store: `src/lib/demo/procedure-library-store.ts`
- Service: `src/services/procedure-library/index.ts`
- UI: `src/components/procedures/procedure-library-picker.tsx`
- Testes: `src/tests/procedure-library/library.test.ts`
