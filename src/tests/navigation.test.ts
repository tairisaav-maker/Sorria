import { describe, expect, it } from "vitest";
import { professionalNav } from "@/lib/navigation";

describe("professionalNav", () => {
  it("habilita Início, Pacientes e Mais na Fase 2", () => {
    const enabled = professionalNav
      .filter((item) => item.enabled)
      .map((i) => i.href);
    expect(enabled).toContain("/app/home");
    expect(enabled).toContain("/app/pacientes");
    expect(enabled).toContain("/app/mais");
    expect(enabled).not.toContain("/app/agenda");
  });
});
