import type { Metadata } from "next";
import { HomeGreeting } from "@/components/home/home-greeting";
import { SetupChecklist } from "@/components/home/setup-checklist";
import { KpiRow } from "@/components/home/kpi-row";
import { RequestsList } from "@/components/home/requests-list";
import { TodayList } from "@/components/home/today-list";
import { WeekChart } from "@/components/home/week-chart";
import { requireClinic } from "@/lib/authz/guards";
import { getClinic, getProfile } from "@/lib/demo/authz-store";
import { buildHomeDashboard } from "@/lib/home/dashboard";
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
