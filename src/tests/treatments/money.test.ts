import { describe, expect, it } from "vitest";
import {
  calculatePlanTotals,
  centsToReais,
  formatBRL,
  lineTotalCents,
  reaisToCents,
} from "@/lib/treatments/money";

describe("money helpers", () => {
  it("converte reais ↔ centavos sem float inseguro no armazenamento", () => {
    expect(reaisToCents(12.34)).toBe(1234);
    expect(centsToReais(1234)).toBe(12.34);
    expect(formatBRL(1234)).toMatch(/R\$/);
  });

  it("arredonda metade para cima de forma estável", () => {
    expect(reaisToCents(10.005)).toBe(1001);
    expect(lineTotalCents(3, 333)).toBe(999);
  });

  it("calculatePlanTotals é a autoridade de desconto", () => {
    const result = calculatePlanTotals({
      items: [
        { quantity: 1, unit_price_cents: 10000 },
        { quantity: 1, unit_price_cents: 10000 },
      ],
      discount_type: "percent",
      discount_percent: 12.5,
    });
    expect(result.subtotal_cents).toBe(20000);
    expect(result.discount_cents).toBe(2500);
    expect(result.total_cents).toBe(17500);
  });
});
