import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { formatBRL } from "@/lib/money";
import type { PricingReport } from "@/types/pricing";

function money(cents: number | null | undefined) {
  if (cents == null) return "—";
  return formatBRL(cents);
}

export function buildPricingCsv(report: PricingReport, clinicName: string) {
  const lines = [
    `"Sorria"`,
    `"Gestão inteligente para consultórios"`,
    `"Clínica: ${clinicName}"`,
    `"Análise de preços e margens"`,
    `"Período: ${report.period_label}"`,
    `"${report.disclaimer}"`,
    "",
    `"Cobertura";${report.pricing_coverage_percent ?? "—"}%`,
    "",
    `"Procedimentos"`,
    "Procedimento;Preço padrão atual;Padrão médio;Cobrado médio;Custo op. médio;Resultado agregado;Margem agregada %",
  ];
  for (const r of report.rows) {
    lines.push(
      [
        `"${r.procedure_name}"`,
        r.current_default_price_cents != null
          ? (r.current_default_price_cents / 100).toFixed(2).replace(".", ",")
          : "",
        r.avg_standard_snapshot_cents != null
          ? (r.avg_standard_snapshot_cents / 100).toFixed(2).replace(".", ",")
          : "",
        r.avg_charged_cents != null
          ? (r.avg_charged_cents / 100).toFixed(2).replace(".", ",")
          : "",
        r.avg_operational_cost_cents != null
          ? (r.avg_operational_cost_cents / 100).toFixed(2).replace(".", ",")
          : "",
        r.aggregate_result_cents != null
          ? (r.aggregate_result_cents / 100).toFixed(2).replace(".", ",")
          : "",
        r.aggregate_margin_percent != null
          ? String(r.aggregate_margin_percent)
          : "",
      ].join(";"),
    );
  }
  lines.push("");
  lines.push(`"Abaixo do custo operacional"`);
  lines.push("Procedimento;Data;Cobrado;Custo operacional;Diferença");
  for (const r of report.below_operational) {
    lines.push(
      [
        `"${r.procedure_name}"`,
        r.completed_at?.slice(0, 10) ?? "",
        r.charged_amount_cents != null
          ? (r.charged_amount_cents / 100).toFixed(2).replace(".", ",")
          : "",
        r.operational_total_cost_cents != null
          ? (r.operational_total_cost_cents / 100).toFixed(2).replace(".", ",")
          : "",
        r.operational_result_cents != null
          ? (r.operational_result_cents / 100).toFixed(2).replace(".", ",")
          : "",
      ].join(";"),
    );
  }
  return lines.join("\n");
}

export async function buildPricingPdf(
  report: PricingReport,
  clinicName: string,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48 });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(16).text("Sorria");
    doc.fontSize(10).fillColor("#666").text("Gestão inteligente para consultórios");
    doc.moveDown();
    doc.fillColor("#000").fontSize(14).text("Análise de preços e margens");
    doc.fontSize(10).text(`Clínica: ${clinicName}`);
    doc.text(`Período: ${report.period_label}`);
    doc.moveDown();
    doc.fillColor("#444").text(report.disclaimer);
    doc.moveDown();
    doc.fillColor("#000").text(
      `Cobertura: ${report.pricing_coverage_percent ?? "—"}%`,
    );
    doc.moveDown();
    for (const r of report.rows.slice(0, 40)) {
      doc
        .fontSize(11)
        .text(
          `${r.procedure_name} · Cobrado médio ${money(r.avg_charged_cents)} · Margem agregada ${r.aggregate_margin_percent ?? "—"}%`,
        );
    }
    if (report.below_operational.length > 0) {
      doc.moveDown();
      doc.fontSize(12).text("Abaixo do custo operacional");
      for (const r of report.below_operational.slice(0, 30)) {
        doc
          .fontSize(10)
          .text(
            `${r.procedure_name} · ${r.completed_at?.slice(0, 10) ?? ""} · Cobrado ${money(r.charged_amount_cents)} · Custo ${money(r.operational_total_cost_cents)}`,
          );
      }
    }
    doc.end();
  });
}

export async function buildPricingXlsx(
  report: PricingReport,
  clinicName: string,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Sorria";
  const summary = wb.addWorksheet("Resumo");
  summary.addRow(["Sorria — Análise de preços e margens"]);
  summary.addRow([clinicName]);
  summary.addRow([report.period_label]);
  summary.addRow([report.disclaimer]);
  summary.addRow([]);
  summary.addRow(["Cobertura %", report.pricing_coverage_percent]);
  summary.addRow(["Concluídos", report.completed]);
  summary.addRow(["Com análise completa", report.with_complete_pricing]);

  const procs = wb.addWorksheet("Procedimentos");
  procs.addRow([
    "Procedimento",
    "Preço padrão atual",
    "Padrão médio período",
    "Cobrado médio",
    "Custo op. médio",
    "Resultado agregado",
    "Margem agregada %",
  ]);
  for (const r of report.rows) {
    procs.addRow([
      r.procedure_name,
      r.current_default_price_cents != null
        ? r.current_default_price_cents / 100
        : null,
      r.avg_standard_snapshot_cents != null
        ? r.avg_standard_snapshot_cents / 100
        : null,
      r.avg_charged_cents != null ? r.avg_charged_cents / 100 : null,
      r.avg_operational_cost_cents != null
        ? r.avg_operational_cost_cents / 100
        : null,
      r.aggregate_result_cents != null
        ? r.aggregate_result_cents / 100
        : null,
      r.aggregate_margin_percent,
    ]);
  }

  const below = wb.addWorksheet("Abaixo do custo");
  below.addRow([
    "Procedimento",
    "Data",
    "Cobrado",
    "Custo operacional",
    "Diferença",
  ]);
  for (const r of report.below_operational) {
    below.addRow([
      r.procedure_name,
      r.completed_at?.slice(0, 10) ?? "",
      r.charged_amount_cents != null ? r.charged_amount_cents / 100 : null,
      r.operational_total_cost_cents != null
        ? r.operational_total_cost_cents / 100
        : null,
      r.operational_result_cents != null
        ? r.operational_result_cents / 100
        : null,
    ]);
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
