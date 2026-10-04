import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { formatBRL } from "@/lib/money";
import type { ReportSection } from "@/types/reports";

type Bundle = Awaited<
  ReturnType<typeof import("@/services/reports").getReportBundle>
>;

function metricLine(
  title: string,
  value: number,
  format: "number" | "percent" | "currency_cents",
) {
  if (format === "currency_cents") return `${title}: ${formatBRL(value)}`;
  if (format === "percent") return `${title}: ${value}%`;
  return `${title}: ${value}`;
}

export function buildReportCsv(
  bundle: Bundle,
  section: ReportSection | "all",
): string {
  const lines = [
    `"Sorria"`,
    `"Gestão inteligente para consultórios"`,
    `"Clínica: ${bundle.clinicName}"`,
    `"Período: ${bundle.period.label}"`,
    `"Gerado em: ${new Date().toLocaleString("pt-BR")}"`,
    "",
  ];

  const pushSection = (name: string, metrics: Array<{ title: string; value: number; format: "number" | "percent" | "currency_cents" }>) => {
    lines.push(`"${name}"`);
    lines.push("Indicador;Valor");
    for (const m of metrics) {
      const val =
        m.format === "currency_cents"
          ? (m.value / 100).toFixed(2).replace(".", ",")
          : m.format === "percent"
            ? `${m.value}%`
            : String(m.value);
      lines.push(`"${m.title}";${val}`);
    }
    lines.push("");
  };

  if ((section === "all" || section === "overview") && bundle.sections.overview) {
    const o = bundle.sections.overview;
    pushSection("Visão geral", [
      o.completed_appointments,
      o.new_patients,
      o.accepted_plans,
      ...(o.received_cents ? [o.received_cents] : []),
    ]);
  }
  if ((section === "all" || section === "schedule") && bundle.sections.schedule) {
    const s = bundle.sections.schedule;
    pushSection("Agenda", [
      s.scheduled_in_period,
      s.completed,
      s.cancelled,
      s.no_shows,
      s.attendance_rate,
      s.no_show_rate,
    ]);
  }
  if ((section === "all" || section === "patients") && bundle.sections.patients) {
    const p = bundle.sections.patients;
    pushSection("Pacientes", [p.new_patients, p.active_registered, p.pending_returns]);
    lines.push("Origem;Quantidade");
    for (const r of p.by_referral) lines.push(`"${r.label}";${r.value}`);
    lines.push("");
  }
  if ((section === "all" || section === "treatments") && bundle.sections.treatments) {
    const t = bundle.sections.treatments;
    pushSection("Tratamentos", [
      t.presented,
      t.accepted,
      t.rejected,
      t.awaiting_decision,
      t.acceptance_rate,
      t.presented_value_cents,
      t.accepted_value_cents,
    ]);
  }
  if ((section === "all" || section === "financial") && bundle.sections.financial) {
    const f = bundle.sections.financial;
    pushSection("Financeiro", [
      f.received_cents,
      f.receivable_cents,
      f.overdue_cents,
      f.expense_cents,
      f.period_result_cents,
      f.overdue_patients,
    ]);
  }

  return `\uFEFF${lines.join("\n")}`;
}

export async function buildReportXlsx(
  bundle: Bundle,
  section: ReportSection | "all",
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Sorria";

  const addSheet = (
    name: string,
    rows: Array<[string, string | number]>,
  ) => {
    const sheet = wb.addWorksheet(name);
    sheet.addRow(["Sorria"]);
    sheet.addRow(["Gestão inteligente para consultórios"]);
    sheet.addRow([`Clínica: ${bundle.clinicName}`]);
    sheet.addRow([`Período: ${bundle.period.label}`]);
    sheet.addRow([]);
    sheet.addRow(["Indicador", "Valor"]);
    for (const [k, v] of rows) sheet.addRow([k, v]);
  };

  const fmt = (m: { title: string; value: number; format: string }) =>
    [
      m.title,
      m.format === "currency_cents"
        ? m.value / 100
        : m.format === "percent"
          ? `${m.value}%`
          : m.value,
    ] as [string, string | number];

  if (section === "all" || section === "overview") {
    const o = bundle.sections.overview;
    addSheet("Resumo", [
      fmt(o.completed_appointments),
      fmt(o.new_patients),
      fmt(o.accepted_plans),
      ...(o.received_cents ? [fmt(o.received_cents)] : []),
    ]);
  }
  if ((section === "all" || section === "schedule") && bundle.sections.schedule) {
    const s = bundle.sections.schedule;
    addSheet("Agenda", [
      fmt(s.scheduled_in_period),
      fmt(s.completed),
      fmt(s.cancelled),
      fmt(s.no_shows),
      fmt(s.attendance_rate),
      fmt(s.no_show_rate),
    ]);
  }
  if ((section === "all" || section === "patients") && bundle.sections.patients) {
    const p = bundle.sections.patients;
    const sheet = wb.addWorksheet("Pacientes");
    sheet.addRow(["Indicador", "Valor"]);
    sheet.addRow(fmt(p.new_patients));
    sheet.addRow(fmt(p.active_registered));
    sheet.addRow(fmt(p.pending_returns));
    sheet.addRow([]);
    sheet.addRow(["Origem", "Quantidade"]);
    for (const r of p.by_referral) sheet.addRow([r.label, r.value]);
  }
  if ((section === "all" || section === "treatments") && bundle.sections.treatments) {
    const t = bundle.sections.treatments;
    addSheet("Tratamentos", [
      fmt(t.presented),
      fmt(t.accepted),
      fmt(t.rejected),
      fmt(t.awaiting_decision),
      fmt(t.acceptance_rate),
      fmt(t.presented_value_cents),
      fmt(t.accepted_value_cents),
    ]);
  }
  if ((section === "all" || section === "financial") && bundle.sections.financial) {
    const f = bundle.sections.financial;
    addSheet("Financeiro", [
      fmt(f.received_cents),
      fmt(f.receivable_cents),
      fmt(f.overdue_cents),
      fmt(f.expense_cents),
      fmt(f.period_result_cents),
    ]);
  }

  if (wb.worksheets.length === 0) {
    wb.addWorksheet("Vazio").addRow(["Sem permissão para exportar esta seção."]);
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export async function buildReportPdf(
  bundle: Bundle,
  section: ReportSection | "all",
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(18).text("Sorria", { continued: false });
    doc.fontSize(11).fillColor("#555").text("Gestão inteligente para consultórios");
    doc.moveDown(0.5);
    doc.fillColor("#000").fontSize(12).text(`Clínica: ${bundle.clinicName}`);
    doc.text(`Relatório — ${bundle.period.label}`);
    doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`);
    doc.moveDown();

    const writeMetric = (m: {
      title: string;
      value: number;
      format: "number" | "percent" | "currency_cents";
      tooltip?: string;
    }) => {
      doc.fontSize(11).text(metricLine(m.title, m.value, m.format));
      if (m.tooltip) {
        doc.fontSize(9).fillColor("#666").text(m.tooltip, { width: 480 });
        doc.fillColor("#000");
      }
    };

    if ((section === "all" || section === "overview") && bundle.sections.overview) {
      doc.fontSize(14).text("Visão geral");
      const o = bundle.sections.overview;
      writeMetric(o.completed_appointments);
      writeMetric(o.new_patients);
      writeMetric(o.accepted_plans);
      if (o.received_cents) writeMetric(o.received_cents);
      doc.moveDown();
    }
    if ((section === "all" || section === "schedule") && bundle.sections.schedule) {
      doc.fontSize(14).text("Agenda");
      const s = bundle.sections.schedule;
      writeMetric(s.completed);
      writeMetric(s.cancelled);
      writeMetric(s.no_shows);
      writeMetric(s.attendance_rate);
      doc.fontSize(9).fillColor("#666").text(s.occupancy.message);
      doc.fillColor("#000");
      doc.moveDown();
    }
    if ((section === "all" || section === "patients") && bundle.sections.patients) {
      doc.fontSize(14).text("Pacientes");
      writeMetric(bundle.sections.patients.new_patients);
      writeMetric(bundle.sections.patients.pending_returns);
      doc.moveDown();
    }
    if ((section === "all" || section === "treatments") && bundle.sections.treatments) {
      doc.fontSize(14).text("Tratamentos");
      const t = bundle.sections.treatments;
      writeMetric(t.presented);
      writeMetric(t.accepted);
      writeMetric(t.acceptance_rate);
      writeMetric(t.accepted_value_cents);
      doc.moveDown();
    }
    if ((section === "all" || section === "financial") && bundle.sections.financial) {
      doc.fontSize(14).text("Financeiro");
      const f = bundle.sections.financial;
      writeMetric(f.received_cents);
      writeMetric(f.receivable_cents);
      writeMetric(f.overdue_cents);
      writeMetric(f.expense_cents);
      writeMetric(f.period_result_cents);
      doc.moveDown();
    }

    doc.fontSize(8).fillColor("#888").text(
      "Definições: valor recebido ≠ plano aceito; resultado do período ≠ lucro líquido contábil.",
    );
    doc.end();
  });
}
