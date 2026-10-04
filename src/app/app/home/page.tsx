import type { Metadata } from "next";
import { HomeGreeting } from "@/components/home/home-greeting";
import { KpiRow } from "@/components/home/kpi-row";
import { RequestsList } from "@/components/home/requests-list";
import { TodayList } from "@/components/home/today-list";
import { WeekChart } from "@/components/home/week-chart";
import {
  demoClinic,
  demoProfile,
  homeAppointments,
  homeKpis,
  homeRequests,
  homeWeekSeries,
} from "@/lib/mock/home";

export const metadata: Metadata = {
  title: "Início",
};

export default function HomePage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <HomeGreeting
        userName={demoProfile.full_name ?? "Profissional"}
        clinicName={demoClinic.name}
      />
      <KpiRow items={homeKpis} />
      <div className="grid gap-4 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <WeekChart data={homeWeekSeries} />
        </div>
        <div className="xl:col-span-2">
          <RequestsList items={homeRequests} />
        </div>
      </div>
      <TodayList items={homeAppointments} />
    </div>
  );
}
