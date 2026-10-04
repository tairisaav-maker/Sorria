import { NextResponse } from "next/server";
import { getDemoSession } from "@/lib/demo/authz-store";
import {
  archivePatient,
  createPatient,
  getPatient,
  listPatients,
  reactivatePatient,
  updatePatient,
  checkPotentialDuplicates,
} from "@/services/patients";

function ensureDemo() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true") {
    return NextResponse.json({ error: "Demo mode only" }, { status: 403 });
  }
  return null;
}

function ctx() {
  const session = getDemoSession();
  return { userId: session.userId, clinicId: session.clinicId };
}

function mapError(error: unknown) {
  const message = error instanceof Error ? error.message : "Erro inesperado";
  if (message === "AUTHORIZATION_DENIED") {
    return NextResponse.json(
      { error: "Você não tem permissão para realizar esta ação." },
      { status: 403 },
    );
  }
  if (message === "PATIENT_NOT_FOUND") {
    return NextResponse.json(
      { error: "Paciente não encontrado." },
      { status: 404 },
    );
  }
  return NextResponse.json(
    { error: message || "Não foi possível concluir esta ação. Tente novamente." },
    { status: 400 },
  );
}

export async function GET(request: Request) {
  const blocked = ensureDemo();
  if (blocked) return blocked;

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    const session = ctx();

    if (id) {
      const patient = getPatient(session, id);
      return NextResponse.json({ patient });
    }

    const result = listPatients(session, {
      query: url.searchParams.get("q") ?? undefined,
      status: (url.searchParams.get("status") as never) ?? "all",
      sort: (url.searchParams.get("sort") as never) ?? "name_asc",
      page: Number(url.searchParams.get("page") ?? "1"),
    });
    return NextResponse.json(result);
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
    const action = body.action as string | undefined;

    if (action === "check_duplicates") {
      const duplicates = checkPotentialDuplicates({
        clinicId: session.clinicId,
        cpf: body.cpf,
        phone: body.phone,
        email: body.email,
        full_name: body.full_name,
        birth_date: body.birth_date,
        excludePatientId: body.excludePatientId,
      });
      return NextResponse.json({ duplicates });
    }

    if (action === "archive") {
      const patient = archivePatient(session, body.id);
      return NextResponse.json({ patient });
    }

    if (action === "reactivate") {
      const patient = reactivatePatient(session, body.id);
      return NextResponse.json({ patient });
    }

    if (action === "update") {
      const patient = updatePatient(session, body.id, body);
      return NextResponse.json({
        patient,
        message: "Alterações salvas.",
      });
    }

    const result = createPatient(session, body);
    if (!result.ok) {
      return NextResponse.json(
        {
          error:
            "Encontramos um cadastro parecido. Confira antes de continuar.",
          duplicates: result.duplicates,
        },
        { status: 409 },
      );
    }
    return NextResponse.json({ patient: result.patient }, { status: 201 });
  } catch (error) {
    return mapError(error);
  }
}
