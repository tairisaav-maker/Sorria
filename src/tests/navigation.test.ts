import { describe, expect, it } from "vitest";
import { professionalNav } from "@/lib/navigation";

describe("professionalNav", () => {
  it("habilita apenas Início na Fase 0", () => {
    const enabled = professionalNav.filter((item) => item.enabled);
    expect(enabled).toHaveLength(1);
    expect(enabled[0]?.href).toBe("/app/home");
  });

  it("mantém itens futuros presentes porém desabilitados", () => {
    expect(professionalNav.some((item) => item.href === "/app/agenda")).toBe(
      true,
    );
    expect(
      professionalNav.find((item) => item.href === "/app/agenda")?.enabled,
    ).toBe(false);
  });
});
