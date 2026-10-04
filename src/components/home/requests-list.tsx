import { Badge } from "@/components/ui/badge";
import type { HomeRequest } from "@/lib/mock/home";

export function RequestsList({ items }: { items: HomeRequest[] }) {
  return (
    <section
      aria-label="Solicitações de horário"
      className="animate-rise rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-4 sm:p-5"
    >
      <div className="mb-4">
        <h2 className="font-[family-name:var(--font-display)] text-lg text-[var(--brand-ink)]">
          Solicitações
        </h2>
        <p className="text-sm text-[var(--text-muted)]">
          Pedidos do paciente — nunca viram consulta automática
        </p>
      </div>

      <ul className="space-y-3">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-start justify-between gap-3 rounded-xl bg-[var(--surface-muted)]/70 px-3 py-3"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-[var(--text)]">
                {item.patientName}
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                Prefere: {item.preferredWindow}
              </p>
              <p className="mt-1 text-[11px] text-[var(--text-subtle)]">
                {item.createdLabel}
              </p>
            </div>
            <Badge tone={item.status === "pending" ? "warning" : "info"}>
              {item.status === "pending" ? "Pendente" : "Proposta enviada"}
            </Badge>
          </li>
        ))}
      </ul>
    </section>
  );
}
