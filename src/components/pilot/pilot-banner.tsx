import { APP_CHANNEL, APP_VERSION } from "@/lib/version";
import { isPilotMode, pilotEnvWarnings } from "@/lib/pilot/env";

export function PilotBanner() {
  if (!isPilotMode() && APP_CHANNEL !== "pilot") return null;
  const warnings = pilotEnvWarnings();
  return (
    <div
      role="status"
      className="border-b border-[var(--warning)]/40 bg-[var(--warning-soft,rgba(180,120,40,0.12))] px-4 py-2 text-center text-xs text-[var(--brand-ink)] sm:text-sm"
    >
      Sorria {APP_VERSION} — ambiente de piloto controlado. Dados reais exigem
      projeto separado do demo.
      {warnings.length > 0 ? (
        <span className="mt-1 block text-[var(--danger)]">
          {warnings[0]}
        </span>
      ) : null}
    </div>
  );
}
