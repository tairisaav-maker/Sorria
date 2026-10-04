import { NextResponse } from "next/server";
import { APP_VERSION } from "@/lib/version";
import { envFlags } from "@/lib/feature-flags";

/**
 * Health check — sem secrets.
 * application healthy ≠ AI provider available
 */
export async function GET() {
  const flags = envFlags();
  return NextResponse.json({
    status: "ok",
    app: "sorria",
    version: APP_VERSION,
    time: new Date().toISOString(),
    checks: {
      application: "healthy",
      demo_mode: process.env.NEXT_PUBLIC_DEMO_MODE === "true",
      assistant_feature: flags.assistant_enabled ? "enabled" : "disabled",
      portal_feature: flags.portal_enabled ? "enabled" : "disabled",
    },
  });
}
