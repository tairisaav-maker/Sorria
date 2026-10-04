import Link from "next/link";

export type ChecklistItem = {
  key: string;
  label: string;
  done: boolean;
  href: string;
};

export function SetupChecklist({
  items,
  dismissHref,
}: {
  items: ChecklistItem[];
  dismissHref?: string;
}) {
  const pending = items.filter((i) => !i.done).length;
  if (pending === 0) return null;

  return (
    <section
      className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/95 p-4 sm:p-5 animate-rise"
      aria-labelledby="setup-checklist-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2
            id="setup-checklist-title"
            className="font-[family-name:var(--font-display)] text-lg text-[var(--brand-ink)]"
          >
            Configure seu Sorria
          </h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            O que precisa da minha atenção para começar — {pending} pendência(s).
          </p>
        </div>
        {dismissHref ? (
          <Link
            href={dismissHref}
            className="text-xs font-medium text-[var(--text-muted)] underline-offset-2 hover:underline"
          >
            Continuar depois
          </Link>
        ) : null}
      </div>
      <ul className="mt-4 space-y-2">
        {items.map((item) => (
          <li key={item.key}>
            <Link
              href={item.href}
              className="flex items-center gap-3 rounded-xl px-2 py-2 text-sm transition-colors hover:bg-[var(--surface-muted)]/70"
            >
              <span
                className={
                  item.done
                    ? "flex size-6 items-center justify-center rounded-full bg-[var(--success-soft)] text-xs font-semibold text-[var(--success)]"
                    : "flex size-6 items-center justify-center rounded-full border border-[var(--border)] text-xs text-[var(--text-subtle)]"
                }
                aria-hidden
              >
                {item.done ? "✓" : "○"}
              </span>
              <span
                className={
                  item.done
                    ? "text-[var(--text-muted)] line-through"
                    : "font-medium text-[var(--text)]"
                }
              >
                {item.label}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
