import { NextResponse } from "next/server";
import { getDemoSession } from "@/lib/demo/authz-store";
import {
  buildFinanceCsv,
  buildFinancePdf,
  buildFinanceXlsx,
} from "@/lib/finance/export";
import {
  cancelFinancialTransaction,
  createExpenseTransaction,
  createIncomeTransaction,
  createInstallmentPlan,
  exportFinancialData,
  getFinancialDashboard,
  getFinancialTransaction,
  getInstallment,
  getPatientFinancialHistory,
  getPatientFinancialSummary,
  listFinancialTransactions,
  registerPayment,
  reversePayment,
} from "@/services/finance";

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
      { error: "Você não tem permissão para realizar esta ação." },
      { status: 403 },
    );
  }
  if (message === "AMOUNT_EXCEEDS_BALANCE") {
    return NextResponse.json(
      { error: "O valor informado é maior que o saldo restante." },
      { status: 400 },
    );
  }
  if (message === "INSTALLMENTS_SUM_MISMATCH") {
    return NextResponse.json(
      { error: "A soma das parcelas deve ser igual ao valor financeiro." },
      { status: 400 },
    );
  }
  if (
    message === "FINANCE_NOT_FOUND" ||
    message === "PATIENT_NOT_FOUND" ||
    message === "REF_TENANT_MISMATCH"
  ) {
    return NextResponse.json(
      { error: "Não encontramos este registro." },
      { status: 404 },
    );
  }
  return NextResponse.json(
    {
      error:
        message.includes("cancelar") ||
        message.includes("estornado") ||
        message.includes("aceito") ||
        message.includes("Desconto")
          ? message
          : "Não foi possível concluir esta ação. Tente novamente.",
    },
    { status: 400 },
  );
}

export async function GET(request: Request) {
  const blocked = ensureDemo();
  if (blocked) return blocked;
  try {
    const url = new URL(request.url);
    const session = ctx();
    const resource = url.searchParams.get("resource") ?? "list";
    const filter = Object.fromEntries(url.searchParams.entries());

    if (resource === "dashboard") {
      return NextResponse.json({
        dashboard: getFinancialDashboard(session, filter),
      });
    }
    if (resource === "transaction") {
      return NextResponse.json({
        transaction: getFinancialTransaction(
          session,
          url.searchParams.get("id") ?? "",
        ),
      });
    }
    if (resource === "installment") {
      return NextResponse.json({
        installment: getInstallment(session, url.searchParams.get("id") ?? ""),
      });
    }
    if (resource === "patient-summary") {
      const patientId = url.searchParams.get("patientId") ?? "";
      return NextResponse.json({
        summary: getPatientFinancialSummary(session, patientId),
        history: getPatientFinancialHistory(session, patientId),
      });
    }
    if (resource === "export") {
      const format = (url.searchParams.get("format") ?? "csv") as
        | "csv"
        | "xlsx"
        | "pdf";
      const payload = exportFinancialData(session, format, filter);
      if (format === "csv") {
        const body = buildFinanceCsv(payload);
        return new NextResponse(body, {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="sorria-financeiro.csv"`,
          },
        });
      }
      if (format === "xlsx") {
        const body = await buildFinanceXlsx(payload);
        return new NextResponse(new Uint8Array(body), {
          headers: {
            "Content-Type":
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": `attachment; filename="sorria-financeiro.xlsx"`,
          },
        });
      }
      const body = await buildFinancePdf(payload);
      return new NextResponse(new Uint8Array(body), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="sorria-financeiro.pdf"`,
        },
      });
    }

    return NextResponse.json({
      items: listFinancialTransactions(session, filter),
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

    if (action === "create-income") {
      return NextResponse.json(
        { transaction: createIncomeTransaction(session, body) },
        { status: 201 },
      );
    }
    if (action === "create-expense") {
      return NextResponse.json(
        { transaction: createExpenseTransaction(session, body) },
        { status: 201 },
      );
    }
    if (action === "create-from-treatment") {
      return NextResponse.json(
        { transaction: createInstallmentPlan(session, body) },
        { status: 201 },
      );
    }
    if (action === "cancel") {
      return NextResponse.json({
        transaction: cancelFinancialTransaction(
          session,
          body.id,
          body.reason ?? "",
        ),
      });
    }
    if (action === "register-payment") {
      const result = registerPayment(session, body);
      return NextResponse.json({
        ...result,
        message: "Pagamento registrado.",
      });
    }
    if (action === "reverse-payment") {
      const result = reversePayment(session, body);
      return NextResponse.json({
        ...result,
        message: "Pagamento estornado.",
      });
    }

    return NextResponse.json({ error: "action inválida" }, { status: 400 });
  } catch (error) {
    return mapError(error);
  }
}
