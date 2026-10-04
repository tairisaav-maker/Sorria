import { Badge } from "@/components/ui/badge";
import type { HomeAppointment } from "@/lib/mock/home";

const statusMap = {
  confirmed: { label: "Confirmada", tone: "success" as const },
  waiting: { label: "Aguardando", tone: "warning" as const },
  in_progress: { label: "Em atendimento", tone: "info" as const },
};

export function TodayList({ items }: { items: HomeAppointment[] }) {
  return (
    <section
      aria-label="Agenda de hoje"
      className="animate-rise rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-4 sm:p-5"
    >
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-lg text-[var(--brand-ink)]">
            Hoje
          </h2>
          <p className="text-sm text-[var(--text-muted)]">
            Atendimentos da agenda de hoje
          </p>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="rounded-xl bg-[var(--surface-muted)]/70 px-3 py-4 text-sm text-[var(--text-muted)]">
          Agenda livre neste dia
        </p>
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {items.map((item) => {
            const status = statusMap[item.status];
            return (
              <li
                key={item.id}
                className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--brand-primary)]">
                    {item.time}
                  </p>
                  <p className="truncate text-sm font-medium text-[var(--text)]">
                    {item.patientName}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {item.procedure}
                  </p>
                </div>
                <Badge tone={status.tone}>{status.label}</Badge>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
