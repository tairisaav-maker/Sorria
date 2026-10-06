"use client";

import { useEffect, useState } from "react";
import { Download, Share } from "lucide-react";
import { Button } from "@/components/ui/button";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

export function PwaProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    // Em development o SW atrapalha HMR/cache — remove registros antigos
    // e só registra de novo com ?pwa=1. Produção mantém PWA normal.
    if (process.env.NODE_ENV === "development") {
      const wantPwa = window.location.search.includes("pwa=1");
      if (!wantPwa) {
        void navigator.serviceWorker
          .getRegistrations()
          .then((regs) => Promise.all(regs.map((r) => r.unregister())))
          .catch(() => {
            /* silencioso */
          });
        return;
      }
    }

    void navigator.serviceWorker.register("/sw.js").catch(() => {
      /* silencioso */
    });
  }, []);

  return <>{children}</>;
}

export function InstallSorriaCard() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [installed, setInstalled] = useState(false);
  const [iosHint, setIosHint] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    if (isStandalone()) {
      setInstalled(true);
      return;
    }
    setSupported(true);
    if (isIos()) {
      setIosHint(true);
      return;
    }
    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", () => setInstalled(true));
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  if (installed || !supported) return null;

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setDeferred(null);
  }

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-4 shadow-[var(--shadow-card)]">
      <h2 className="font-medium text-[var(--brand-ink)]">Instalar Sorria</h2>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Use o Sorria como aplicativo na tela inicial do celular ou computador.
      </p>
      {deferred ? (
        <Button type="button" className="mt-3" onClick={() => void install()}>
          <Download className="size-4" />
          Instalar Sorria
        </Button>
      ) : iosHint ? (
        <p className="mt-3 flex items-start gap-2 text-sm text-[var(--text-muted)]">
          <Share className="mt-0.5 size-4 shrink-0 text-[var(--brand-primary)]" />
          <span>
            No Safari: toque em <strong>Compartilhar</strong> →{" "}
            <strong>Adicionar à Tela de Início</strong>.
          </span>
        </p>
      ) : (
        <p className="mt-3 text-xs text-[var(--text-subtle)]">
          Quando o navegador permitir, o botão de instalação aparece aqui.
        </p>
      )}
    </section>
  );
}
