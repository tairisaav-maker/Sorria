import { describe, expect, it } from "vitest";
import { professionalNav } from "@/lib/navigation";

describe("professionalNav", () => {
  it("habilita Início e Mais na Fase 1", () => {
    const enabled = professionalNav.filter((item) => item.enabled).map((i) => i.href);
    expect(enabled).toContain("/app/home");
    expect(enabled).toContain("/app/mais");
    expect(enabled).not.toContain("/app/agenda");
  });
});
