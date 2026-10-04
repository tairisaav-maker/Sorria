import type { Metadata } from "next";
import { ForecastHomeCard } from "@/components/home/forecast-home-card";
import { HomeGreeting } from "@/components/home/home-greeting";
import { InventoryHomeCard } from "@/components/home/inventory-home-card";
import { SetupChecklist } from "@/components/home/setup-checklist";
import { KpiRow } from "@/components/home/kpi-row";
import { RequestsList } from "@/components/home/requests-list";
import { TodayList } from "@/components/home/today-list";
import { WeekChart } from "@/components/home/week-chart";
import { can } from "@/lib/authz/can";
import { requireClinic } from "@/lib/authz/guards";
import { getClinic, getProfile } from "@/lib/demo/authz-store";
import { buildHomeDashboard } from "@/lib/home/dashboard";
import { getInventoryDashboard } from "@/services/inventory";
import { forecastMaterialNeeds } from "@/services/inventory/forecast";
import { getOnboarding } from "@/services/settings";

export const metadata: Metadata = {
  title: "Início",
};

export default async function HomePage() {
  const actor = await requireClinic();
  const profile = getProfile(actor.ctx.userId);
  const clinic = getClinic(actor.ctx.clinicId);
  const dashboard = buildHomeDashboard(actor.ctx);
  const onboarding = getOnboarding(actor.ctx);
  const inventory = getInventoryDashboard(actor.ctx);
  const canForecast = can(actor.ctx, "inventory.forecast_view").allowed;
  let weekForecast: {
    materials_at_risk: number;
    procedures_planned: number;
    appointments_analyzed: number;
  } | null = null;
  let tomorrowForecast: {
    appointments_analyzed: number;
    procedures_planned: number;
    materials_at_risk: number;
  } | null = null;
  if (canForecast) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const weekEnd = new Date(start);
    weekEnd.setDate(weekEnd.getDate() + 7);
    weekEnd.setHours(23, 59, 59, 999);
    weekForecast = forecastMaterialNeeds(actor.ctx, {
      start_date: start.toISOString(),
      end_date: weekEnd.toISOString(),
    });
    const tomorrowStart = new Date(start);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    const tomorrowEnd = new Date(tomorrowStart);
    tomorrowEnd.setHours(23, 59, 59, 999);
    tomorrowForecast = forecastMaterialNeeds(actor.ctx, {
      start_date: tomorrowStart.toISOString(),
      end_date: tomorrowEnd.toISOString(),
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <HomeGreeting
        userName={profile?.full_name ?? "Profissional"}
        clinicName={clinic?.name ?? "Clínica"}
      />
      {!onboarding.complete ? (
        <SetupChecklist
          items={[...onboarding.checklist]}
          dismissHref="/app/onboarding?step=welcome"
        />
      ) : null}
      <KpiRow items={dashboard.kpis} />
      {inventory ? <InventoryHomeCard data={inventory} /> : null}
      {weekForecast && tomorrowForecast ? (
        <ForecastHomeCard week={weekForecast} tomorrow={tomorrowForecast} />
      ) : null}
      <div className="grid gap-4 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <WeekChart data={dashboard.weekSeries} />
        </div>
        <div className="xl:col-span-2">
          <RequestsList items={dashboard.requestItems} />
        </div>
      </div>
      <TodayList items={dashboard.todayItems} />
    </div>
  );
}
