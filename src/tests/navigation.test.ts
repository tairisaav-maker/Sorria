import { describe, expect, it } from "vitest";
import { professionalNav, secondaryNav } from "@/lib/navigation";

describe("professionalNav", () => {
  it("prioriza Início, Agenda, Pacientes, Estoque, Financeiro e Mais", () => {
    const enabled = professionalNav
      .filter((item) => item.enabled)
      .map((i) => i.href);
    expect(enabled).toEqual([
      "/app/home",
      "/app/agenda",
      "/app/pacientes",
      "/app/estoque",
      "/app/financeiro",
      "/app/mais",
    ]);
    expect(enabled).not.toContain("/app/assistente");
    expect(enabled).not.toContain("/portal/inicio");
  });

  it("mantém Procedimentos e Relatórios como secundários", () => {
    const hrefs = secondaryNav.map((i) => i.href);
    expect(hrefs).toContain("/app/procedimentos");
    expect(hrefs).toContain("/app/relatorios");
    expect(hrefs).toContain("/app/configuracoes");
  });
});
