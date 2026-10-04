import type { AuthzContext } from "@/lib/authz/can";
import { can } from "@/lib/authz/can";
import { getInventoryStore } from "@/lib/demo/inventory-store";
import { listPatients } from "@/services/patients/queries";

export type GlobalSearchHit = {
  type: "patient" | "procedure" | "inventory";
  id: string;
  label: string;
  href: string;
  subtitle?: string;
};

/** Busca simples V1 — paciente, procedimento e item de estoque. */
export function globalSearch(
  ctx: AuthzContext,
  query: string,
  limit = 8,
): GlobalSearchHit[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  const hits: GlobalSearchHit[] = [];

  if (can(ctx, "patients.demographics.view").allowed) {
    try {
      const patients = listPatients(ctx, {
        page: 1,
        pageSize: 20,
        status: "active",
        query: q,
      });
      for (const p of patients.items) {
        hits.push({
          type: "patient",
          id: p.id,
          label: p.full_name,
          href: `/app/pacientes/${p.id}`,
          subtitle: p.phone ?? undefined,
        });
        if (hits.length >= limit) return hits;
      }
    } catch {
      /* ignore */
    }
  }

  const inv = getInventoryStore();

  if (can(ctx, "procedures.view").allowed) {
    for (const p of inv.procedures) {
      if (p.clinic_id !== ctx.clinicId || !p.active) continue;
      if (!p.name.toLowerCase().includes(q)) continue;
      hits.push({
        type: "procedure",
        id: p.id,
        label: p.name,
        href: `/app/procedimentos/${p.id}`,
        subtitle: "Procedimento",
      });
      if (hits.length >= limit) return hits;
    }
  }

  if (can(ctx, "inventory.view").allowed) {
    for (const item of inv.inventoryItems) {
      if (item.clinic_id !== ctx.clinicId || item.archived_at || !item.active)
        continue;
      if (!item.name.toLowerCase().includes(q)) continue;
      hits.push({
        type: "inventory",
        id: item.id,
        label: item.name,
        href: `/app/estoque?item=${item.id}`,
        subtitle: `Estoque · ${item.current_quantity} ${item.consumption_unit}`,
      });
      if (hits.length >= limit) return hits;
    }
  }

  return hits;
}
