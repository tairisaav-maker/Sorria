/**
 * Rateio proporcional de um pagamento entre alocações de procedimentos.
 * Residual de centavos vai para o maior amount_allocated (desempate: ordem estável).
 * Análise apenas — não altera o pagamento real na transação/parcela.
 */
export function allocatePaymentAcrossProcedureAmounts(input: {
  paymentCents: number;
  allocations: Array<{ id: string; amount_allocated_cents: number }>;
}): Array<{ id: string; received_cents: number }> {
  const { paymentCents, allocations } = input;
  if (paymentCents < 0) throw new Error("Pagamento inválido");
  if (allocations.length === 0) return [];

  const totalAllocated = allocations.reduce(
    (s, a) => s + a.amount_allocated_cents,
    0,
  );
  if (totalAllocated <= 0) {
    return allocations.map((a) => ({ id: a.id, received_cents: 0 }));
  }

  const raw = allocations.map((a) => {
    const exact = (paymentCents * a.amount_allocated_cents) / totalAllocated;
    const floor = Math.floor(exact);
    return {
      id: a.id,
      amount_allocated_cents: a.amount_allocated_cents,
      floor,
      fraction: exact - floor,
    };
  });

  const assigned = raw.reduce((s, r) => s + r.floor, 0);
  let residual = paymentCents - assigned;

  // Distribui residual 1 centavo por vez: maior fração, depois maior alocado, depois id
  const order = [...raw].sort((a, b) => {
    if (b.fraction !== a.fraction) return b.fraction - a.fraction;
    if (b.amount_allocated_cents !== a.amount_allocated_cents) {
      return b.amount_allocated_cents - a.amount_allocated_cents;
    }
    return a.id.localeCompare(b.id);
  });

  const received = new Map(raw.map((r) => [r.id, r.floor]));
  let i = 0;
  while (residual > 0 && order.length > 0) {
    const target = order[i % order.length]!;
    received.set(target.id, (received.get(target.id) ?? 0) + 1);
    residual -= 1;
    i += 1;
  }

  return allocations.map((a) => ({
    id: a.id,
    received_cents: received.get(a.id) ?? 0,
  }));
}

/** Soma recebida por procedimento a partir dos pagamentos válidos das txs linkadas. */
export function sumAllocatedReceived(input: {
  links: Array<{
    id: string;
    amount_allocated_cents: number;
    financial_transaction_id: string;
  }>;
  /** paid_cents por transaction_id (pagamentos válidos, não estornados) */
  paidByTransaction: Map<string, number>;
}): number {
  // Agrupa links por transação para ratear o pago daquela tx
  const byTx = new Map<string, Array<{ id: string; amount_allocated_cents: number }>>();
  for (const link of input.links) {
    const list = byTx.get(link.financial_transaction_id) ?? [];
    list.push({
      id: link.id,
      amount_allocated_cents: link.amount_allocated_cents,
    });
    byTx.set(link.financial_transaction_id, list);
  }

  let total = 0;
  for (const [txId, allocs] of byTx) {
    const paid = input.paidByTransaction.get(txId) ?? 0;
    const parts = allocatePaymentAcrossProcedureAmounts({
      paymentCents: paid,
      allocations: allocs,
    });
    for (const p of parts) total += p.received_cents;
  }
  return total;
}

export function calculateDiscount(
  standardCents: number | null,
  chargedCents: number | null,
): { discount_amount_cents: number | null; discount_percent: number | null } {
  if (standardCents == null || chargedCents == null) {
    return { discount_amount_cents: null, discount_percent: null };
  }
  const discount = Math.max(0, standardCents - chargedCents);
  if (standardCents === 0) {
    return { discount_amount_cents: discount, discount_percent: null };
  }
  return {
    discount_amount_cents: discount,
    discount_percent: Math.round((discount / standardCents) * 10000) / 100,
  };
}
