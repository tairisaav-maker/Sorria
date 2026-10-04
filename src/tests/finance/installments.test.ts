import { describe, expect, it } from "vitest";
import { splitAmountIntoInstallments, sumCents } from "@/lib/money";

describe("splitAmountIntoInstallments", () => {
  it("mantém total exato", () => {
    for (const total of [100, 10000, 199, 1, 33333]) {
      for (const n of [1, 2, 3, 4, 7, 12]) {
        if (total < n) continue;
        const parts = splitAmountIntoInstallments(total, n);
        expect(sumCents(parts)).toBe(total);
        expect(parts).toHaveLength(n);
      }
    }
  });
});
