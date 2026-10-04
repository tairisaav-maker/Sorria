import { NextResponse } from "next/server";
import { APP_CHANNEL, APP_VERSION } from "@/lib/version";
import { envFlags } from "@/lib/feature-flags";
import { getSorriaEnv, isPilotMode, pilotEnvWarnings } from "@/lib/pilot/env";

/**
 * Health check — sem secrets.
 * application healthy ≠ AI provider available
 */
export async function GET() {
  const flags = envFlags();
  const warnings = pilotEnvWarnings();
  return NextResponse.json({
    status: warnings.length > 0 && isPilotMode() ? "degraded" : "ok",
    app: "sorria",
    version: APP_VERSION,
    channel: APP_CHANNEL,
    env: getSorriaEnv(),
    time: new Date().toISOString(),
    checks: {
      application: "healthy",
      demo_mode: process.env.NEXT_PUBLIC_DEMO_MODE === "true",
      pilot_mode: isPilotMode(),
      assistant_feature: flags.assistant_enabled ? "enabled" : "disabled",
      portal_feature: flags.portal_enabled ? "enabled" : "disabled",
      env_warnings: warnings,
    },
  });
}
