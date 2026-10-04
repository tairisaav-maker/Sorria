"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { HomeWeekPoint } from "@/lib/mock/home";

export function WeekChart({ data }: { data: HomeWeekPoint[] }) {
  return (
    <section
      aria-label="Consultas da semana"
      className="animate-rise rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-4 sm:p-5"
    >
      <div className="mb-4">
        <h2 className="font-[family-name:var(--font-display)] text-lg text-[var(--brand-ink)]">
          Semana
        </h2>
        <p className="text-sm text-[var(--text-muted)]">
          Volume de consultas (dados demo)
        </p>
      </div>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--text-subtle)", fontSize: 12 }}
            />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--text-subtle)", fontSize: 12 }}
            />
            <Tooltip
              cursor={{ fill: "var(--brand-soft)" }}
              contentStyle={{
                borderRadius: 12,
                border: "1px solid var(--border)",
                background: "var(--surface-elevated)",
              }}
            />
            <Bar
              dataKey="appointments"
              name="Consultas"
              fill="var(--brand-primary)"
              radius={[8, 8, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
