import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { formatBRL } from "@/lib/money";
import type { getOperationalBundle } from "@/services/reports/operational";

type Bundle = ReturnType<typeof getOperationalBundle>;

function money(cents: number | null | undefined) {
  if (cents == null) return "—";
  return formatBRL(cents);
}

export function buildOperationalCsv(bundle: Bundle): string {
  const lines = [
    `"Sorria"`,
    `"Gestão inteligente para consultórios"`,
    `"Clínica: ${bundle.clinicName}"`,
    `"Relatório operacional"`,
    `"Período: ${bundle.period.label}"`,
    `"Gerado em: ${new Date().toLocaleString("pt-BR")}"`,
    "",
  ];

  const o = bundle.overview;
  lines.push(`"Resumo"`);
  lines.push("Indicador;Valor");
  lines.push(`"Procedimentos realizados";${o.procedures_completed}`);
  if (o.materials_cost_cents != null) {
    lines.push(
      `"Custo real de materiais";${(o.materials_cost_cents / 100).toFixed(2).replace(".", ",")}`,
    );
  }
  if (o.charged_cents != null) {
    lines.push(
      `"Valor cobrado";${(o.charged_cents / 100).toFixed(2).replace(".", ",")}`,
    );
  }
  if (o.received_cents != null) {
    lines.push(
      `"Valor recebido";${(o.received_cents / 100).toFixed(2).replace(".", ",")}`,
    );
  }
  if (o.gross_result_charged_cents != null) {
    lines.push(
      `"Resultado bruto";${(o.gross_result_charged_cents / 100).toFixed(2).replace(".", ",")}`,
    );
  }
  if (o.receivable_cents != null) {
    lines.push(
      `"A receber";${(o.receivable_cents / 100).toFixed(2).replace(".", ",")}`,
    );
  }
  if (bundle.coverage.coverage_percent != null) {
    lines.push(`"Cobertura de custos";${bundle.coverage.coverage_percent}%`);
  }
  lines.push("");

  if (bundle.capabilities.costs || bundle.procedures.length > 0) {
    lines.push(`"Procedimentos"`);
    lines.push(
      "Procedimento;Realizados;Custo médio real;Valor médio cobrado;Resultado bruto;Margem %",
    );
    for (const r of bundle.procedures) {
      lines.push(
        [
          `"${r.procedure_name}"`,
          r.count,
          r.avg_actual_cost_cents != null
            ? (r.avg_actual_cost_cents / 100).toFixed(2).replace(".", ",")
            : "",
          r.avg_charged_cents != null
            ? (r.avg_charged_cents / 100).toFixed(2).replace(".", ",")
            : "",
          r.gross_result_cents != null
            ? (r.gross_result_cents / 100).toFixed(2).replace(".", ",")
            : "",
          r.margin_percent != null ? String(r.margin_percent) : "",
        ].join(";"),
      );
    }
    lines.push("");
  }

  if (bundle.materials) {
    lines.push(`"Materiais"`);
    lines.push(
      "Material;Unidade;Previsto;Utilizado;Diferença;Custo consumido;Estoque",
    );
    for (const r of bundle.materials) {
      lines.push(
        [
          `"${r.item_name}"`,
          r.consumption_unit,
          r.planned_quantity,
          r.actual_quantity,
          r.difference,
          r.cost_incomplete
            ? "incompleto"
            : r.cost_consumed_cents != null
              ? (r.cost_consumed_cents / 100).toFixed(2).replace(".", ",")
              : "",
          r.current_stock ?? "",
        ].join(";"),
      );
    }
    lines.push("");
  }

  if (bundle.patients) {
    lines.push(`"Pacientes"`);
    lines.push(
      "Paciente;Procedimentos;Custo direto;Cobrado;Recebido;Saldo;Resultado bruto associado",
    );
    for (const r of bundle.patients) {
      lines.push(
        [
          `"${r.patient_name}"`,
          r.procedures_count,
          r.direct_cost_cents != null
            ? (r.direct_cost_cents / 100).toFixed(2).replace(".", ",")
            : "",
          r.charged_cents != null
            ? (r.charged_cents / 100).toFixed(2).replace(".", ",")
            : "",
          r.received_cents != null
            ? (r.received_cents / 100).toFixed(2).replace(".", ",")
            : "",
          r.outstanding_cents != null
            ? (r.outstanding_cents / 100).toFixed(2).replace(".", ",")
            : "",
          r.gross_result_cents != null
            ? (r.gross_result_cents / 100).toFixed(2).replace(".", ",")
            : "",
        ].join(";"),
      );
    }
    lines.push("");
  }

  if (bundle.financial) {
    const f = bundle.financial;
    lines.push(`"Financeiro"`);
    lines.push("Indicador;Valor");
    if (f.charged_cents != null) {
      lines.push(
        `"Valor cobrado";${(f.charged_cents / 100).toFixed(2).replace(".", ",")}`,
      );
    }
    if (f.received_cents != null) {
      lines.push(
        `"Valor recebido";${(f.received_cents / 100).toFixed(2).replace(".", ",")}`,
      );
    }
    if (f.receivable_cents != null) {
      lines.push(
        `"A receber";${(f.receivable_cents / 100).toFixed(2).replace(".", ",")}`,
      );
    }
    if (f.overdue_cents != null) {
      lines.push(
        `"Vencido";${(f.overdue_cents / 100).toFixed(2).replace(".", ",")}`,
      );
    }
    if (f.direct_cost_cents != null) {
      lines.push(
        `"Custos diretos";${(f.direct_cost_cents / 100).toFixed(2).replace(".", ",")}`,
      );
    }
    if (f.gross_result_charged_cents != null) {
      lines.push(
        `"Resultado bruto";${(f.gross_result_charged_cents / 100).toFixed(2).replace(".", ",")}`,
      );
    }
  }

  return `\uFEFF${lines.join("\n")}`;
}

export async function buildOperationalXlsx(bundle: Bundle): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Sorria";

  const header = (sheet: ExcelJS.Worksheet) => {
    sheet.addRow(["Sorria"]);
    sheet.addRow(["Gestão inteligente para consultórios"]);
    sheet.addRow([`Clínica: ${bundle.clinicName}`]);
    sheet.addRow(["Relatório operacional"]);
    sheet.addRow([`Período: ${bundle.period.label}`]);
    sheet.addRow([]);
  };

  const resumo = wb.addWorksheet("Resumo");
  header(resumo);
  resumo.addRow(["Indicador", "Valor"]);
  const o = bundle.overview;
  resumo.addRow(["Procedimentos realizados", o.procedures_completed]);
  if (o.materials_cost_cents != null) {
    resumo.addRow(["Custo real de materiais", o.materials_cost_cents / 100]);
  }
  if (o.charged_cents != null) {
    resumo.addRow(["Valor cobrado", o.charged_cents / 100]);
  }
  if (o.received_cents != null) {
    resumo.addRow(["Valor recebido", o.received_cents / 100]);
  }
  if (o.gross_result_charged_cents != null) {
    resumo.addRow(["Resultado bruto", o.gross_result_charged_cents / 100]);
  }
  if (o.receivable_cents != null) {
    resumo.addRow(["A receber", o.receivable_cents / 100]);
  }
  if (bundle.coverage.coverage_percent != null) {
    resumo.addRow(["Cobertura de custos (%)", bundle.coverage.coverage_percent]);
  }

  const proc = wb.addWorksheet("Procedimentos");
  header(proc);
  proc.addRow([
    "Procedimento",
    "Realizados",
    "Custo médio real",
    "Valor médio cobrado",
    "Resultado bruto",
    "Margem %",
  ]);
  for (const r of bundle.procedures) {
    proc.addRow([
      r.procedure_name,
      r.count,
      r.avg_actual_cost_cents != null ? r.avg_actual_cost_cents / 100 : "",
      r.avg_charged_cents != null ? r.avg_charged_cents / 100 : "",
      r.gross_result_cents != null ? r.gross_result_cents / 100 : "",
      r.margin_percent ?? "",
    ]);
  }

  if (bundle.materials) {
    const mat = wb.addWorksheet("Materiais");
    header(mat);
    mat.addRow([
      "Material",
      "Unidade",
      "Previsto",
      "Utilizado",
      "Diferença",
      "Custo consumido",
      "Estoque",
    ]);
    for (const r of bundle.materials) {
      mat.addRow([
        r.item_name,
        r.consumption_unit,
        r.planned_quantity,
        r.actual_quantity,
        r.difference,
        r.cost_incomplete
          ? "incompleto"
          : r.cost_consumed_cents != null
            ? r.cost_consumed_cents / 100
            : "",
        r.current_stock ?? "",
      ]);
    }
  }

  if (bundle.patients) {
    const pat = wb.addWorksheet("Pacientes");
    header(pat);
    pat.addRow([
      "Paciente",
      "Procedimentos",
      "Custo direto",
      "Cobrado",
      "Recebido",
      "Saldo",
      "Resultado bruto associado",
    ]);
    for (const r of bundle.patients) {
      pat.addRow([
        r.patient_name,
        r.procedures_count,
        r.direct_cost_cents != null ? r.direct_cost_cents / 100 : "",
        r.charged_cents != null ? r.charged_cents / 100 : "",
        r.received_cents != null ? r.received_cents / 100 : "",
        r.outstanding_cents != null ? r.outstanding_cents / 100 : "",
        r.gross_result_cents != null ? r.gross_result_cents / 100 : "",
      ]);
    }
  }

  if (bundle.financial) {
    const fin = wb.addWorksheet("Financeiro");
    header(fin);
    fin.addRow(["Indicador", "Valor"]);
    const f = bundle.financial;
    if (f.charged_cents != null) fin.addRow(["Valor cobrado", f.charged_cents / 100]);
    if (f.received_cents != null) fin.addRow(["Valor recebido", f.received_cents / 100]);
    if (f.receivable_cents != null) fin.addRow(["A receber", f.receivable_cents / 100]);
    if (f.overdue_cents != null) fin.addRow(["Vencido", f.overdue_cents / 100]);
    if (f.direct_cost_cents != null) {
      fin.addRow(["Custos diretos", f.direct_cost_cents / 100]);
    }
    if (f.gross_result_charged_cents != null) {
      fin.addRow(["Resultado bruto", f.gross_result_charged_cents / 100]);
    }
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export async function buildOperationalPdf(bundle: Bundle): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(18).text("Sorria");
    doc.fontSize(11).fillColor("#555").text("Gestão inteligente para consultórios");
    doc.moveDown(0.5);
    doc.fillColor("#000").fontSize(12).text(`Clínica: ${bundle.clinicName}`);
    doc.text("Relatório operacional");
    doc.text(`Período: ${bundle.period.label}`);
    doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`);
    doc.moveDown();

    const o = bundle.overview;
    doc.fontSize(14).text("Visão geral");
    doc.fontSize(11);
    doc.text(`Procedimentos realizados: ${o.procedures_completed}`);
    if (o.materials_cost_cents != null) {
      doc.text(`Custo real de materiais: ${money(o.materials_cost_cents)}`);
    }
    if (o.charged_cents != null) doc.text(`Valor cobrado: ${money(o.charged_cents)}`);
    if (o.received_cents != null) doc.text(`Valor recebido: ${money(o.received_cents)}`);
    if (o.gross_result_charged_cents != null) {
      doc.text(`Resultado bruto: ${money(o.gross_result_charged_cents)}`);
    }
    if (o.receivable_cents != null) doc.text(`A receber: ${money(o.receivable_cents)}`);
    if (bundle.coverage.coverage_percent != null) {
      doc.text(`Cobertura de custos: ${bundle.coverage.coverage_percent}%`);
    }
    doc.moveDown();

    if (bundle.procedures.length > 0) {
      doc.fontSize(14).text("Procedimentos");
      doc.fontSize(10);
      for (const r of bundle.procedures.slice(0, 25)) {
        doc.text(
          `${r.procedure_name}: ${r.count} · médio cobrado ${money(r.avg_charged_cents)} · resultado ${money(r.gross_result_cents)}${r.margin_percent != null ? ` · margem ${r.margin_percent}%` : ""}`,
        );
      }
      doc.moveDown();
    }

    if (bundle.materials && bundle.materials.length > 0) {
      doc.fontSize(14).text("Materiais");
      doc.fontSize(10);
      for (const r of bundle.materials.slice(0, 25)) {
        doc.text(
          `${r.item_name}: previsto ${r.planned_quantity} ${r.consumption_unit} · real ${r.actual_quantity} ${r.consumption_unit} · ${r.cost_incomplete ? "custo incompleto" : money(r.cost_consumed_cents)}`,
        );
      }
      doc.moveDown();
    }

    doc.fontSize(8).fillColor("#888").text(
      "Resultado bruto = valor cobrado − custos diretos. Não representa lucro líquido da clínica.",
    );
    doc.end();
  });
}
