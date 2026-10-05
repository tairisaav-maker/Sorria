import {
  simulateDiscountCents,
  simulatePriceByMarginCents,
  simulatePriceCents,
} from "@/lib/pricing/formulas";

/** Recálculo puro — seguro para client e server. */
export function computeQuickSimulation(input: {
  cost_cents: number | null;
  simulated_price_cents: number;
  default_price_cents: number | null;
}) {
  if (input.cost_cents == null) {
    return {
      simulated_price_cents: input.simulated_price_cents,
      result_cents: null as number | null,
      margin_percent: null as number | null,
      break_even_cents: null as number | null,
      vs_standard_cents:
        input.default_price_cents == null
          ? null
          : input.simulated_price_cents - input.default_price_cents,
      partial: true,
    };
  }
  const sim = simulatePriceCents(input.cost_cents, input.simulated_price_cents);
  return {
    simulated_price_cents: sim.simulated_price_cents,
    result_cents: sim.result_cents,
    margin_percent: sim.margin_percent,
    break_even_cents: input.cost_cents,
    vs_standard_cents:
      input.default_price_cents == null
        ? null
        : input.simulated_price_cents - input.default_price_cents,
    partial: false,
  };
}

export function computePriceForMargin(
  costCents: number,
  desiredMarginPercent: number,
) {
  return simulatePriceByMarginCents(costCents, desiredMarginPercent);
}

export function computeDiscountedPrice(
  standardPriceCents: number,
  discountPercent: number,
) {
  return simulateDiscountCents({
    standardPriceCents,
    discountPercent,
  });
}
