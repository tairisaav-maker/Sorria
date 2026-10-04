import Link from "next/link";

export function QuickActions({
  canCreateAppointment,
  canCreatePatient,
  canPurchase,
  canPayment,
}: {
  canCreateAppointment: boolean;
  canCreatePatient: boolean;
  canPurchase: boolean;
  canPayment: boolean;
}) {
  const actions = [
    canCreateAppointment
      ? { href: "/app/agenda?nova=1", label: "+ Nova consulta" }
      : null,
    canCreatePatient
      ? { href: "/app/pacientes/novo", label: "+ Novo paciente" }
      : null,
    canPurchase
      ? { href: "/app/estoque/compras?nova=1", label: "+ Registrar compra" }
      : null,
    canPayment
      ? { href: "/app/financeiro?novo=pagamento", label: "+ Registrar pagamento" }
      : null,
  ].filter(Boolean) as Array<{ href: string; label: string }>;

  if (actions.length === 0) return null;

  return (
    <section
      aria-label="Ações rápidas"
      className="flex flex-wrap gap-2 animate-rise"
    >
      {actions.map((a) => (
        <Link
          key={a.href}
          href={a.href}
          className="inline-flex min-h-11 items-center rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 px-3 text-sm font-medium text-[var(--brand-ink)] hover:bg-[var(--surface-muted)]/70"
        >
          {a.label}
        </Link>
      ))}
    </section>
  );
}
