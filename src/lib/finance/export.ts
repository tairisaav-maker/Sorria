import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { formatBRL } from "@/lib/money";
import {
  METHOD_LABELS,
  STATUS_LABELS,
  TYPE_LABELS,
  type TransactionWithDetails,
} from "@/types/finance";

type ExportPayload = {
  clinicName: string;
  generatedAt: string;
  items: TransactionWithDetails[];
  totals: {
    income_net_cents: number;
    received_cents: number;
    expense_cents: number;
  };
  periodLabel?: string;
};

function headerLines(payload: ExportPayload) {
  return [
    "Sorria",
    "Gestão inteligente para consultórios",
    `Clínica: ${payload.clinicName}`,
    `Gerado em: ${new Date(payload.generatedAt).toLocaleString("pt-BR")}`,
    payload.periodLabel ? `Período: ${payload.periodLabel}` : "",
  ].filter(Boolean);
}

/** CSV com delimitador `;` (compatível com Excel BR). UTF-8 com BOM. */
export function buildFinanceCsv(payload: ExportPayload): string {
  const lines = [
    ...headerLines(payload).map((l) => `"${l}"`),
    "",
    [
      "Data",
      "Descrição",
      "Paciente",
      "Tipo",
      "Valor líquido",
      "Recebido",
      "Saldo",
      "Status",
    ].join(";"),
  ];
  for (const item of payload.items) {
    lines.push(
      [
        new Date(item.created_at).toLocaleDateString("pt-BR"),
        `"${item.description.replace(/"/g, '""')}"`,
        `"${(item.patient_name ?? "").replace(/"/g, '""')}"`,
        TYPE_LABELS[item.type],
        (item.net_amount_cents / 100).toFixed(2).replace(".", ","),
        (item.paid_cents / 100).toFixed(2).replace(".", ","),
        (item.balance_cents / 100).toFixed(2).replace(".", ","),
        STATUS_LABELS[item.status],
      ].join(";"),
    );
  }
  lines.push("");
  lines.push(`Totais;;;;${(payload.totals.income_net_cents / 100).toFixed(2).replace(".", ",")};${(payload.totals.received_cents / 100).toFixed(2).replace(".", ",")};${(payload.totals.expense_cents / 100).toFixed(2).replace(".", ",")};`);
  return `\uFEFF${lines.join("\n")}`;
}

export async function buildFinanceXlsx(payload: ExportPayload): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Sorria";
  const sheet = wb.addWorksheet("Financeiro");
  sheet.addRow(["Sorria"]);
  sheet.addRow(["Gestão inteligente para consultórios"]);
  sheet.addRow([`Clínica: ${payload.clinicName}`]);
  sheet.addRow([`Gerado em: ${new Date(payload.generatedAt).toLocaleString("pt-BR")}`]);
  sheet.addRow([]);
  sheet.addRow([
    "Data",
    "Descrição",
    "Paciente",
    "Tipo",
    "Valor líquido",
    "Recebido",
    "Saldo",
    "Status",
  ]);
  for (const item of payload.items) {
    sheet.addRow([
      new Date(item.created_at),
      item.description,
      item.patient_name ?? "",
      TYPE_LABELS[item.type],
      item.net_amount_cents / 100,
      item.paid_cents / 100,
      item.balance_cents / 100,
      STATUS_LABELS[item.status],
    ]);
  }
  sheet.getColumn(5).numFmt = '"R$"#,##0.00';
  sheet.getColumn(6).numFmt = '"R$"#,##0.00';
  sheet.getColumn(7).numFmt = '"R$"#,##0.00';
  sheet.getColumn(1).numFmt = "dd/mm/yyyy";
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export async function buildFinancePdf(payload: ExportPayload): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(Buffer.from(c)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(18).text("Sorria", { continued: false });
    doc.fontSize(11).fillColor("#444").text("Gestão inteligente para consultórios");
    doc.moveDown(0.5);
    doc.fillColor("#111").text(`Clínica: ${payload.clinicName}`);
    doc.text(`Gerado em: ${new Date(payload.generatedAt).toLocaleString("pt-BR")}`);
    doc.moveDown();
    doc.fontSize(14).text("Movimentações financeiras");
    doc.moveDown(0.5);
    doc.fontSize(9);

    for (const item of payload.items.slice(0, 40)) {
      doc.text(
        `${new Date(item.created_at).toLocaleDateString("pt-BR")} · ${TYPE_LABELS[item.type]} · ${STATUS_LABELS[item.status]}`,
      );
      doc.text(
        `${item.description}${item.patient_name ? ` — ${item.patient_name}` : ""}`,
      );
      doc.text(
        `Líquido ${formatBRL(item.net_amount_cents)} · Recebido ${formatBRL(item.paid_cents)} · Saldo ${formatBRL(item.balance_cents)}`,
      );
      doc.moveDown(0.4);
    }

    doc.moveDown();
    doc.fontSize(11).text(`Recebido: ${formatBRL(payload.totals.received_cents)}`);
    doc.text(`Despesas pagas: ${formatBRL(payload.totals.expense_cents)}`);
    doc.end();
  });
}

export function describePaymentMethods(item: TransactionWithDetails) {
  const methods = new Set<string>();
  for (const inst of item.installments) {
    for (const p of inst.payments) {
      if (!p.reversed_at) methods.add(METHOD_LABELS[p.payment_method]);
    }
  }
  return [...methods].join(", ");
}
