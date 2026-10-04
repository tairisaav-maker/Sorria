import { BottomNav } from "@/components/layout/bottom-nav";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { FeedbackButton } from "@/components/pilot/feedback-button";
import { PilotBanner } from "@/components/pilot/pilot-banner";

export function AppShell({
  children,
  userName,
  clinicName,
}: {
  children: React.ReactNode;
  userName: string;
  clinicName: string;
}) {
  return (
    <div className="min-h-dvh bg-[var(--surface)] text-[var(--text)]">
      <PilotBanner />
      <div className="flex min-h-dvh">
        <Sidebar clinicName={clinicName} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar userName={userName} clinicName={clinicName} />
          <main className="flex-1 px-4 pb-24 pt-5 sm:px-6 lg:px-8 lg:pb-8">
            {children}
          </main>
        </div>
      </div>
      <FeedbackButton />
      <BottomNav />
    </div>
  );
}
