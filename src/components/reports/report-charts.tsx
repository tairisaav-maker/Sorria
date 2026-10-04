"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatBRL } from "@/lib/money";
import type { NamedCount, TimeSeriesPoint } from "@/types/reports";
import { EmptyState } from "@/components/ui/empty-state";

export function StatusBars({ data }: { data: NamedCount[] }) {
  if (!data.some((d) => d.value > 0)) {
    return <EmptyState title="Ainda não há dados suficientes neste período." />;
  }
  return (
    <div className="h-56 w-full" role="img" aria-label="Consultas por status">
      <ResponsiveContainer>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
          <Tooltip />
          <Bar dataKey="value" name="Quantidade" fill="var(--brand-primary)" radius={6} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SeriesLine({
  data,
  name = "Valor",
  currency,
}: {
  data: TimeSeriesPoint[];
  name?: string;
  currency?: boolean;
}) {
  if (data.length === 0) {
    return <EmptyState title="Ainda não há dados suficientes neste período." />;
  }
  return (
    <div className="h-56 w-full" role="img" aria-label={name}>
      <ResponsiveContainer>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis
            tick={{ fontSize: 11 }}
            tickFormatter={(v) =>
              currency ? formatBRL(Number(v)).replace("R$\u00a0", "") : String(v)
            }
          />
          <Tooltip
            formatter={(v) =>
              currency ? formatBRL(Number(v)) : String(v)
            }
          />
          <Line
            type="monotone"
            dataKey="value"
            name={name}
            stroke="var(--brand-primary)"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DualCashflow({ data }: { data: TimeSeriesPoint[] }) {
  if (data.length === 0) {
    return <EmptyState title="Ainda não há dados suficientes neste período." />;
  }
  return (
    <div className="h-56 w-full" role="img" aria-label="Entradas e despesas">
      <ResponsiveContainer>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => formatBRL(Number(v)).replace("R$\u00a0", "")}
          />
          <Tooltip formatter={(v) => formatBRL(Number(v))} />
          <Legend />
          <Bar dataKey="value" name="Entradas" fill="var(--brand-primary)" radius={4} />
          <Bar dataKey="secondary" name="Despesas" fill="var(--warning)" radius={4} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function HorizontalCounts({ data }: { data: NamedCount[] }) {
  if (!data.some((d) => d.value > 0)) {
    return <EmptyState title="Ainda não há dados suficientes neste período." />;
  }
  return (
    <div className="h-56 w-full" role="img" aria-label="Distribuição">
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ left: 24 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="label" width={100} tick={{ fontSize: 11 }} />
          <Tooltip />
          <Bar dataKey="value" name="Quantidade" fill="var(--brand-primary)" radius={4} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
