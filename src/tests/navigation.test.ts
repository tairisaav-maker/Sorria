import { describe, expect, it } from "vitest";
import { professionalNav } from "@/lib/navigation";

describe("professionalNav", () => {
  it("habilita Início, Agenda, Pacientes, Financeiro e Mais", () => {
    const enabled = professionalNav
      .filter((item) => item.enabled)
      .map((i) => i.href);
    expect(enabled).toContain("/app/home");
    expect(enabled).toContain("/app/agenda");
    expect(enabled).toContain("/app/pacientes");
    expect(enabled).toContain("/app/financeiro");
    expect(enabled).toContain("/app/mais");
  });
});
