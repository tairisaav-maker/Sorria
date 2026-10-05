import { can, type AuthzContext } from "@/lib/authz/can";
import { assertPermission } from "@/lib/authz/guards";
import { getInventoryStore } from "@/lib/demo/inventory-store";
import { getPerformedStore } from "@/lib/demo/performed-procedures-store";
import { getStandardOperationalEstimate } from "@/services/procedure-operational-costs";
import { listProcedures } from "@/services/procedures";

export type QuickSimulationContext = {
  mode: "catalog" | "performed";
  procedure_id: string;
  procedure_name: string;
  performed_procedure_id: string | null;
  patient_name: string | null;
  tooth_number: number | null;
  default_price_cents: number | null;
  /** Custo direto (materiais) — null se sem permissão ou sem dados */
  direct_cost_cents: number | null;
  /** Custo operacional estimado — null se incompleto/sem permissão */
  operational_cost_cents: number | null;
  operational_incomplete: boolean;
  materials_without_cost: number;
  can_view_costs: boolean;
  can_view_operational: boolean;
  can_update_price: boolean;
  disclaimer: string;
};

function canSimulate(ctx: AuthzContext) {
  return (
    can(ctx, "procedure_pricing.simulate").allowed ||
    can(ctx, "procedure_pricing.view").allowed
  );
}

export function listSimulationProcedures(ctx: AuthzContext) {
  if (!canSimulate(ctx) && !can(ctx, "procedures.view").allowed) {
    assertPermission(ctx, "procedure_pricing.simulate");
  }
  return listProcedures(ctx)
    .slice()
    .sort((a, b) => {
      if (a.favorited !== b.favorited) return a.favorited ? -1 : 1;
      if (b.use_count !== a.use_count) return b.use_count - a.use_count;
      if ((b.last_used_at ?? "") !== (a.last_used_at ?? "")) {
        return (b.last_used_at ?? "").localeCompare(a.last_used_at ?? "");
      }
      return a.name.localeCompare(b.name, "pt-BR");
    })
    .map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      default_price_cents: p.default_price_cents,
      favorited: p.favorited,
      use_count: p.use_count,
      last_used_at: p.last_used_at,
    }));
}

export function getQuickSimulationContext(
  ctx: AuthzContext,
  opts: {
    procedureId?: string | null;
    performedProcedureId?: string | null;
  },
): QuickSimulationContext {
  if (!canSimulate(ctx)) {
    assertPermission(ctx, "procedure_pricing.simulate");
  }

  const canCosts = can(ctx, "procedure_costs.view").allowed;
  const canOps =
    can(ctx, "procedure_operational_costs.view").allowed ||
    can(ctx, "operational_costs.view").allowed ||
    can(ctx, "procedure_pricing.view").allowed;
  const canUpdate =
    can(ctx, "procedures.update_price").allowed ||
    can(ctx, "procedure_pricing.manage").allowed;

  if (opts.performedProcedureId) {
    const row = getPerformedStore().performedProcedures.find(
      (p) => p.id === opts.performedProcedureId,
    );
    if (!row || row.clinic_id !== ctx.clinicId) {
      throw new Error("PERFORMED_PROCEDURE_NOT_FOUND");
    }
    const direct =
      canCosts || canOps
        ? (row.actual_total_cost_cents ?? row.planned_total_cost_cents)
        : null;
    const operational =
      canOps ? (row.operational_total_cost_cents ?? null) : null;

    return {
      mode: "performed",
      procedure_id: row.procedure_id,
      procedure_name: row.procedure_name_snapshot,
      performed_procedure_id: row.id,
      patient_name: null,
      tooth_number: row.tooth_number,
      default_price_cents:
        row.charged_amount_cents ?? row.standard_price_snapshot_cents,
      direct_cost_cents: direct,
      operational_cost_cents: operational,
      operational_incomplete: operational == null && canOps,
      materials_without_cost: 0,
      can_view_costs: canCosts || canOps,
      can_view_operational: canOps,
      can_update_price: false, // performed sim não altera preço padrão automaticamente
      disclaimer:
        "Simulação deste atendimento — não altera cadastros nem cobranças.",
    };
  }

  const procedureId = opts.procedureId;
  if (!procedureId) throw new Error("PROCEDURE_ID_REQUIRED");
  const proc = getInventoryStore().procedures.find(
    (p) => p.id === procedureId && p.clinic_id === ctx.clinicId,
  );
  if (!proc) throw new Error("PROCEDURE_NOT_FOUND");

  let direct: number | null = null;
  let operational: number | null = null;
  let incomplete = false;
  let withoutCost = 0;

  if (canCosts || canOps) {
    const est = getStandardOperationalEstimate(ctx, procedureId);
    direct = canCosts || canOps ? est.materials_cost_cents : null;
    if (canOps) {
      operational = est.operational_total_cents;
      incomplete = est.insufficient_data || operational == null;
    }
    const mats = getInventoryStore().procedureMaterials.filter(
      (m) => m.procedure_id === procedureId && m.clinic_id === ctx.clinicId,
    );
    for (const m of mats) {
      const item = getInventoryStore().inventoryItems.find(
        (i) => i.id === m.inventory_item_id,
      );
      if (item && item.average_unit_cost_cents <= 0 && !m.optional) {
        withoutCost += 1;
      }
    }
  }

  return {
    mode: "catalog",
    procedure_id: proc.id,
    procedure_name: proc.name,
    performed_procedure_id: null,
    patient_name: null,
    tooth_number: null,
    default_price_cents: proc.default_price_cents,
    direct_cost_cents: direct,
    operational_cost_cents: operational,
    operational_incomplete: incomplete,
    materials_without_cost: withoutCost,
    can_view_costs: canCosts || canOps,
    can_view_operational: canOps,
    can_update_price: canUpdate,
    disclaimer:
      "Simulação — não altera cadastros. Estimativa baseada nos custos configurados.",
  };
}

export {
  computeDiscountedPrice,
  computePriceForMargin,
  computeQuickSimulation,
} from "@/lib/pricing/quick-simulate";
