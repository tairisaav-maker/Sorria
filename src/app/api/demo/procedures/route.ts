import { NextResponse } from "next/server";
import { getDemoSession } from "@/lib/demo/authz-store";
import {
  addProcedureMaterial,
  archiveProcedure,
  calculateProcedureStandardCost,
  createProcedure,
  duplicateProcedure,
  getProcedure,
  listProcedureMaterials,
  listProcedures,
  removeProcedureMaterial,
  setProcedureFavorite,
  updateProcedure,
  updateProcedureMaterial,
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
    message === "PROCEDURE_NOT_FOUND" ||
    message === "PROCEDURE_MATERIAL_NOT_FOUND" ||
    message === "INVENTORY_ITEM_NOT_FOUND"
  ) {
    return NextResponse.json(
      { error: "Não encontramos este registro." },
      { status: 404 },
    );
  }
  if (message === "CROSS_CLINIC_REFERENCE") {
    return NextResponse.json(
      { error: "Referência entre clínicas não permitida." },
      { status: 400 },
    );
  }
  if (message === "MATERIAL_ALREADY_LINKED") {
    return NextResponse.json(
      { error: "Este material já está na ficha técnica." },
      { status: 400 },
    );
  }
  return NextResponse.json(
    { error: "Não foi possível concluir esta ação." },
    { status: 400 },
  );
}

export async function GET(request: Request) {
  const blocked = ensureDemo();
  if (blocked) return blocked;
  try {
    const url = new URL(request.url);
    const session = ctx();
    const id = url.searchParams.get("id");
    if (id) {
      const procedure = getProcedure(session, id);
      const materials = listProcedureMaterials(session, id);
      const cost = calculateProcedureStandardCost(session, id);
      return NextResponse.json({ procedure, materials, cost });
    }
    return NextResponse.json({
      items: listProcedures(session, {
        includeArchived: url.searchParams.get("archived") === "1",
      }),
    });
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

    if (action === "create") {
      return NextResponse.json({
        procedure: createProcedure(session, body.data),
      });
    }
    if (action === "update") {
      return NextResponse.json({
        procedure: updateProcedure(session, body.data),
      });
    }
    if (action === "archive") {
      return NextResponse.json({
        procedure: archiveProcedure(session, body.data),
      });
    }
    if (action === "duplicate") {
      return NextResponse.json({
        procedure: duplicateProcedure(
          session,
          body.data.id,
          body.data.name,
        ),
      });
    }
    if (action === "favorite") {
      return NextResponse.json({
        procedure: setProcedureFavorite(
          session,
          body.data.id,
          Boolean(body.data.favorited),
        ),
      });
    }
    if (action === "add_material") {
      return NextResponse.json({
        material: addProcedureMaterial(session, body.data),
      });
    }
    if (action === "update_material") {
      return NextResponse.json({
        material: updateProcedureMaterial(session, body.data),
      });
    }
    if (action === "remove_material") {
      removeProcedureMaterial(session, body.data);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  } catch (error) {
    return mapError(error);
  }
}
