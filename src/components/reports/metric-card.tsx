"use client";

import { formatBRL } from "@/lib/money";
import type { MetricValue } from "@/types/reports";
import { cn } from "@/lib/utils";

export function MetricCard({
  metric,
  onDrill,
  className,
}: {
  metric: MetricValue;
  onDrill?: () => void;
  className?: string;
}) {
  const display =
    metric.format === "currency_cents"
      ? formatBRL(metric.value)
      : metric.format === "percent"
        ? `${metric.value}%`
        : String(metric.value);

  const cmp = metric.comparison;
  const clickable = Boolean(metric.drilldown && onDrill);

  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={onDrill}
      title={metric.tooltip}
      className={cn(
        "rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-4 text-left",
        clickable && "hover:border-[var(--brand-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brand-primary)]",
        !clickable && "cursor-default",
        className,
      )}
    >
      <p className="text-xs text-[var(--text-subtle)]">{metric.title}</p>
      <p className="mt-1 font-[family-name:var(--font-display)] text-2xl text-[var(--brand-ink)]">
        {display}
      </p>
      {cmp ? (
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          {cmp.has_baseline && cmp.delta_percent != null ? (
            <span
              className={
                cmp.delta_percent > 0
                  ? "text-[var(--success)]"
                  : cmp.delta_percent < 0
                    ? "text-[var(--danger)]"
                    : undefined
              }
            >
              {cmp.delta_percent > 0 ? "+" : ""}
              {cmp.delta_percent}%
            </span>
          ) : (
            <span>{cmp.label}</span>
          )}
          {cmp.has_baseline ? (
            <span className="text-[var(--text-subtle)]"> · {cmp.label}</span>
          ) : null}
        </p>
      ) : null}
      {metric.tooltip ? (
        <p className="mt-2 text-[10px] leading-snug text-[var(--text-subtle)]">
          {metric.tooltip}
        </p>
      ) : null}
      {clickable ? (
        <p className="mt-2 text-xs font-medium text-[var(--brand-primary)]">
          Ver detalhes
        </p>
      ) : null}
    </button>
  );
}
