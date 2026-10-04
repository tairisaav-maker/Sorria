"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SorriaMark } from "@/components/brand/sorria-mark";
import { Button } from "@/components/ui/button";
import { hasSupabaseConfig } from "@/lib/supabase/client";
import { isDemoMode } from "@/lib/utils";

export function Topbar({
  userName,
  clinicName,
}: {
  userName: string;
  clinicName: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);
    try {
      if (isDemoMode()) {
        await fetch("/auth/demo", { method: "DELETE" });
      }

      if (hasSupabaseConfig()) {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        await supabase.auth.signOut();
      }

      router.replace("/login");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--surface)]/80 backdrop-blur-md">
      <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="lg:hidden">
          <SorriaMark size="sm" />
        </div>
        <div className="hidden min-w-0 lg:block">
          <p className="truncate text-sm text-[var(--text-muted)]">
            Olá, <span className="font-medium text-[var(--text)]">{userName}</span>
          </p>
          <p className="truncate text-xs text-[var(--text-subtle)]">
            Clínica: {clinicName}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden text-right sm:block lg:hidden">
            <p className="text-sm font-medium text-[var(--text)]">{userName}</p>
            <p className="text-xs text-[var(--text-subtle)]">{clinicName}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            loading={loading}
            onClick={handleSignOut}
            aria-label="Sair"
          >
            <LogOut className="size-4" />
            <span className="hidden sm:inline">Sair</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
