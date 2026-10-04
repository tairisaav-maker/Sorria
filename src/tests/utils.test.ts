import { describe, expect, it } from "vitest";
import { cn, formatCurrencyBRL } from "@/lib/utils";
import { loginSchema } from "@/lib/validations/auth";

describe("cn", () => {
  it("mescla classes sem conflito", () => {
    expect(cn("px-2", "px-4", "text-sm")).toBe("px-4 text-sm");
  });
});

describe("formatCurrencyBRL", () => {
  it("formata valores em BRL", () => {
    expect(formatCurrencyBRL(1240)).toMatch(/R\$\s?1\.240,00/);
  });
});

describe("loginSchema", () => {
  it("aceita credenciais válidas", () => {
    const result = loginSchema.safeParse({
      email: "demo@sorria.app",
      password: "sorria-demo",
    });
    expect(result.success).toBe(true);
  });

  it("rejeita e-mail inválido", () => {
    const result = loginSchema.safeParse({
      email: "invalido",
      password: "123456",
    });
    expect(result.success).toBe(false);
  });
});
