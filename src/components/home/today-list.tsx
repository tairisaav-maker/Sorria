import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { HomeAppointment } from "@/lib/mock/home";

const statusMap = {
  confirmed: { label: "Confirmada", tone: "success" as const },
  waiting: { label: "Aguardando", tone: "warning" as const },
  in_progress: { label: "Em atendimento", tone: "info" as const },
  completed: { label: "Concluída", tone: "neutral" as const },
};

function attendanceCta(item: HomeAppointment) {
  const raw = item.rawStatus ?? item.status;
  if (raw === "completed") {
    return { href: `/app/agenda/atendimento/${item.id}`, label: "Ver atendimento" };
  }
  if (raw === "in_progress") {
    return {
      href: `/app/agenda/atendimento/${item.id}`,
      label: "Continuar atendimento",
    };
  }
  if (
    raw === "arrived" ||
    raw === "confirmed" ||
    raw === "scheduled" ||
    item.status === "waiting" ||
    item.status === "confirmed"
  ) {
    return {
      href: `/app/agenda/atendimento/${item.id}?iniciar=1`,
      label: "Iniciar atendimento",
    };
  }
  return {
    href: `/app/agenda/atendimento/${item.id}`,
    label: "Abrir",
  };
}

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
            O que precisa da sua atenção agora
          </p>
        </div>
        <Link
          href="/app/agenda"
          className="text-sm text-[var(--brand-primary)] hover:underline"
        >
          Agenda
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl bg-[var(--surface-muted)]/70 px-3 py-4 text-sm text-[var(--text-muted)]">
          <p>Agenda livre neste dia.</p>
          <Link
            href="/app/agenda?nova=1"
            className="mt-2 inline-block text-[var(--brand-primary)] hover:underline"
          >
            + Nova consulta
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {items.map((item) => {
            const status =
              statusMap[item.status as keyof typeof statusMap] ??
              statusMap.waiting;
            const cta = attendanceCta(item);
            return (
              <li
                key={item.id}
                className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
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
                    {item.missingProcedures
                      ? " · sem procedimento definido"
                      : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={status.tone}>{status.label}</Badge>
                  <Link
                    href={cta.href}
                    className="inline-flex min-h-10 items-center rounded-xl bg-[var(--brand-primary)] px-3 text-sm font-medium text-white"
                  >
                    {cta.label}
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
