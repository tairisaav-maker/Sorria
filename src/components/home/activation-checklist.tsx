import Link from "next/link";
import type { ActivationMilestone } from "@/services/commercial";

/**
 * Checklist comercial de ativação — orientação, não gamificação.
 */
export function ActivationChecklist({
  milestones,
  activated,
}: {
  milestones: ActivationMilestone[];
  activated: boolean;
}) {
  if (activated) return null;
  const pending = milestones.filter((m) => !m.done).length;

  return (
    <section
      className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/95 p-4 sm:p-5 animate-rise"
      aria-labelledby="activation-checklist-title"
    >
      <h2
        id="activation-checklist-title"
        className="font-[family-name:var(--font-display)] text-lg text-[var(--brand-ink)]"
      >
        Primeiros passos
      </h2>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        O primeiro passo é cadastrar um procedimento que você realiza com
        frequência. {pending} pendência(s).
      </p>
      <ul className="mt-4 space-y-2">
        {milestones.map((item) => (
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
                {item.done ? "✓" : ""}
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
