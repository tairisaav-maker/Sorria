import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDemoSession } from "@/lib/demo/authz-store";
import {
  DEMO_COOKIE_NAME,
  hydrateDemoSessionFromCookie,
} from "@/lib/demo/session";
import {
  exportReport,
  getOverdueAccounts,
  getPendingReturns,
  getPendingTreatmentDecisions,
  getReportBundle,
} from "@/services/reports";
import type { ReportPeriodPreset, ReportSection } from "@/types/reports";

async function ctx() {
  const jar = await cookies();
  hydrateDemoSessionFromCookie(jar.get(DEMO_COOKIE_NAME)?.value);
  const s = getDemoSession();
  return { userId: s.userId, clinicId: s.clinicId };
}

function filterFrom(url: URL) {
  return {
    preset: (url.searchParams.get("preset") ?? "30d") as ReportPeriodPreset,
    customStart: url.searchParams.get("from"),
    customEnd: url.searchParams.get("to"),
    professionalId: url.searchParams.get("professionalId"),
  };
}

function mapError(error: unknown) {
  const message = error instanceof Error ? error.message : "Erro";
  if (message.includes("PERMISSION") || message.includes("AUTHORIZATION")) {
    return NextResponse.json(
      { error: "Você não tem permissão para esta seção." },
      { status: 403 },
    );
  }
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function GET(request: Request) {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true") {
    return NextResponse.json({ error: "Demo only" }, { status: 403 });
  }
  try {
    const url = new URL(request.url);
    const resource = url.searchParams.get("resource") ?? "bundle";
    const auth = await ctx();
    const filter = filterFrom(url);

    if (resource === "bundle") {
      return NextResponse.json(getReportBundle(auth, filter));
    }
    if (resource === "pending-returns") {
      return NextResponse.json({ items: getPendingReturns(auth) });
    }
    if (resource === "overdue") {
      return NextResponse.json({ items: getOverdueAccounts(auth) });
    }
    if (resource === "pending-decisions") {
      return NextResponse.json({ items: getPendingTreatmentDecisions(auth) });
    }
    if (resource === "export") {
      const format = (url.searchParams.get("format") ?? "csv") as
        | "pdf"
        | "xlsx"
        | "csv";
      const section = (url.searchParams.get("section") ?? "all") as
        | ReportSection
        | "all";
      const file = await exportReport(auth, filter, format, section);
      const bytes =
        typeof file.body === "string"
          ? Buffer.from(file.body, "utf8")
          : file.body;
      return new NextResponse(new Uint8Array(bytes), {
        headers: {
          "Content-Type": file.contentType,
          "Content-Disposition": `attachment; filename="${file.filename}"`,
        },
      });
    }
    return NextResponse.json({ error: "resource inválido" }, { status: 400 });
  } catch (error) {
    return mapError(error);
  }
}
