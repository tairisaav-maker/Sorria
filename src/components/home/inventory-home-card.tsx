import Link from "next/link";
import { Package } from "lucide-react";
import { formatBRL } from "@/lib/money";

export function InventoryHomeCard({
  data,
}: {
  data: {
    low_count: number;
    empty_count: number;
    expiring_count: number;
    estimated_value_cents: number | null;
  };
}) {
  return (
    <section
      aria-label="Estoque"
      className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-4 animate-rise"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Package className="size-5 text-[var(--brand-primary)]" />
          <h2 className="font-[family-name:var(--font-display)] text-lg text-[var(--brand-ink)]">
            Estoque
          </h2>
        </div>
        <Link
          href="/app/estoque"
          className="text-sm font-medium text-[var(--brand-primary)]"
        >
          Ver estoque
        </Link>
      </div>
      <ul className="mt-3 space-y-1.5 text-sm text-[var(--text-muted)]">
        <li>
          {data.low_count} item(ns) abaixo do mínimo
        </li>
        <li>{data.empty_count} sem estoque</li>
        <li>{data.expiring_count} próximo(s) do vencimento</li>
        {data.estimated_value_cents != null ? (
          <li>
            Valor estimado:{" "}
            <span className="font-medium text-[var(--brand-ink)]">
              {formatBRL(data.estimated_value_cents)}
            </span>
          </li>
        ) : null}
      </ul>
    </section>
  );
}
