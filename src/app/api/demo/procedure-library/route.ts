import { NextResponse } from "next/server";
import { getDemoSession } from "@/lib/demo/authz-store";
import {
  getLibraryStats,
  getOnboardingProcedurePicks,
  getProcedureTemplatePreview,
  importProcedureTemplate,
  importProcedureTemplatesBatch,
  listMaterialLibrary,
  listProcedureLibrary,
  markCustomProcedureCreated,
  openProcedureLibrary,
  quickCreateMaterial,
  toggleLibraryFavorite,
} from "@/services/procedure-library";
import {
  duplicateProcedure,
  getProcedure,
  listProcedureMaterials,
} from "@/services/procedures";

function ensureDemo() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true") {
    return NextResponse.json({ error: "Demo mode only" }, { status: 403 });
  }
  return null;
}

function ctx() {
  const s = getDemoSession();
  return { userId: s.userId, clinicId: s.clinicId };
}

function mapError(error: unknown) {
  const message = error instanceof Error ? error.message : "Erro";
  if (message === "AUTHORIZATION_DENIED") {
    return NextResponse.json(
      { error: "Você não tem permissão para esta ação." },
      { status: 403 },
    );
  }
  if (
    message === "TEMPLATE_NOT_FOUND" ||
    message === "MATERIAL_TEMPLATE_NOT_FOUND" ||
    message === "PROCEDURE_NOT_FOUND"
  ) {
    return NextResponse.json(
      { error: "Não encontramos este registro." },
      { status: 404 },
    );
  }
  return NextResponse.json(
    { error: "Não foi possível concluir esta ação.", detail: message },
    { status: 400 },
  );
}

export async function GET(request: Request) {
  const blocked = ensureDemo();
  if (blocked) return blocked;
  try {
    const url = new URL(request.url);
    const session = ctx();
    const view = url.searchParams.get("view") ?? "library";

    if (view === "stats") {
      return NextResponse.json(getLibraryStats(session));
    }
    if (view === "onboarding_picks") {
      return NextResponse.json({ picks: getOnboardingProcedurePicks(session) });
    }
    if (view === "materials") {
      return NextResponse.json({
        items: listMaterialLibrary(session, {
          query: url.searchParams.get("q") ?? undefined,
          category: url.searchParams.get("category"),
          limit: Number(url.searchParams.get("limit") ?? 60),
        }),
      });
    }
    if (view === "preview") {
      const id = url.searchParams.get("template_id");
      if (!id) {
        return NextResponse.json(
          { error: "template_id obrigatório" },
          { status: 400 },
        );
      }
      return NextResponse.json(getProcedureTemplatePreview(session, id));
    }

    openProcedureLibrary(session);
    return NextResponse.json(
      listProcedureLibrary(session, {
        query: url.searchParams.get("q") ?? undefined,
        category: url.searchParams.get("category"),
        mode:
          (url.searchParams.get("mode") as "catalog" | "attendance" | "onboarding") ||
          "catalog",
        limit: Number(url.searchParams.get("limit") ?? 80),
      }),
    );
  } catch (error) {
    return mapError(error);
  }
}

export async function POST(request: Request) {
  const blocked = ensureDemo();
  if (blocked) return blocked;
  try {
    const body = await request.json();
    const session = ctx();
    const action = body.action as string;

    if (action === "import") {
      const result = importProcedureTemplate(session, body.data);
      const procedure = getProcedure(session, result.procedure_id);
      const materials = listProcedureMaterials(session, result.procedure_id);
      return NextResponse.json({ result, procedure, materials });
    }
    if (action === "import_batch") {
      const results = importProcedureTemplatesBatch(session, body.data);
      return NextResponse.json({ results });
    }
    if (action === "favorite") {
      return NextResponse.json(toggleLibraryFavorite(session, body.data));
    }
    if (action === "quick_create_material") {
      return NextResponse.json({
        item: quickCreateMaterial(session, body.data),
      });
    }
    if (action === "duplicate") {
      return NextResponse.json({
        procedure: duplicateProcedure(
          session,
          body.data.procedure_id,
          body.data.name,
        ),
      });
    }
    if (action === "mark_custom") {
      markCustomProcedureCreated(session, body.data.procedure_id);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  } catch (error) {
    return mapError(error);
  }
}
