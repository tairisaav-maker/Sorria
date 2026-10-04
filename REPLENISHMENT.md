> Fluxo V1: [V1_PRODUCT_FLOW.md](./V1_PRODUCT_FLOW.md)

# Reposição inteligente e lista de compras — Subfase 7

Rota: `/app/estoque/reposicao`  
Princípio: **RECOMENDAR ≠ COMPRAR**. Lista não altera estoque.

## Fórmula (recomendação oficial V1)

```text
necessidade_base     = consumo previsto (Agenda × ficha técnica)
necessidade_total    = necessidade_base + estoque_mínimo
quantidade_a_repor   = max(0, necessidade_total − estoque_útil)
embalagens           = ceil(quantidade_a_repor / units_per_purchase_unit)
quantidade_comprada  = embalagens × units_per_purchase_unit
excedente            = quantidade_comprada − quantidade_a_repor
```

Estoque útil: quando lotes com validade estão consistentes, desconsidera quantidades que vencem antes do fim do horizonte; senão alerta para revisar lotes.

## Horizonte

| Preset | Uso |
| --- | --- |
| 7d (default) | Operacional |
| 15d / 30d | Planejamento |
| custom | Datas livres |

## Status

| Status | Regra |
| --- | --- |
| `critical` | estoque < consumo previsto do período |
| `reorder` | estoque cobre previsto, mas projetado < mínimo |
| `attention` | histórico acima, perto do mínimo, ou sem custo |
| `ok` | adequado |
| `unknown` | embalagem inválida / dados insuficientes |

## Consumo histórico

- Média real = Σ actual / ocorrências confirmadas
- Confiável apenas com **≥ 5** ocorrências (`HISTORICAL_SAMPLE_MIN`)
- Mostra alerta (“X% acima do previsto”) e previsão alternativa
- **Não** altera a quantidade oficial de compra

## Custo estimado

1. Preferir último `cost_per_purchase_unit` de compra válida  
2. Senão: `average_unit_cost × units_per_purchase_unit`  
3. Ausente → não usa R$ 0; marca item sem preço  

Permissão: `inventory.cost_view`. Sem custo: quantidades sim, preços não.

## Cobertura

- Agenda = consultas com procedimentos definidos ÷ elegíveis  
- Fichas = procedimentos previstos com BOM ÷ previstos  

## purchase_lists / purchase_list_items

Snapshots no momento da criação. Status da lista:

`draft` → `ready` → `partially_purchased` → `completed` | `cancelled`

- Criar lista ≠ compra  
- Converter lista → `createInventoryPurchase` (Subfase 2) com vínculo `inventory_purchase_item_id`  
- Compra parcial marca itens e status `partially_purchased`  
- Listas abertas **não** reduzem estoque disponível; podem mostrar “já incluído… ainda não comprado”

## Permissões

| Key | Uso |
| --- | --- |
| `inventory.replenishment_view` | Ver necessidade |
| `inventory.purchase_list_create` | Criar lista |
| `inventory.purchase_list_update` | Editar / atualizar / cancelar / converter |
| `inventory.purchase_create` | Registrar compra real |
| `inventory.cost_view` | Ver estimativas de preço |

## Auditoria

`purchase_list.created` · `purchase_list.updated` · `purchase_list.cancelled` · `purchase_list.converted_to_purchase`

## Serviços

`calculateReplenishmentNeeds` · `calculateRecommendedPackages` · `createPurchaseList` · `updatePurchaseListItem` · `refreshPurchaseList` · `cancelPurchaseList` · `createPurchaseFromPurchaseList` · `getOpenPurchaseLists`

## Limitações (fora do escopo)

Compra automática, marketplace, cotação, pedido eletrônico, aprovação multinível, contas a pagar, IA, multi-local.
