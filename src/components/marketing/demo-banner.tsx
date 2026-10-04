import { APP_VERSION } from "@/lib/version";
import { isPilotMode } from "@/lib/pilot/env";

/** Banner obrigatório no ambiente de demonstração (dados fictícios). */
export function DemoBanner() {
  const demo = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  if (!demo || isPilotMode()) return null;
  return (
    <div
      role="status"
      className="border-b border-[var(--info)]/30 bg-[var(--info-soft)] px-4 py-2 text-center text-xs text-[var(--brand-ink)] sm:text-sm"
    >
      Ambiente de demonstração — dados fictícios. Sorria {APP_VERSION}.
    </div>
  );
}
