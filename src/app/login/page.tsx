import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { SorriaMark } from "@/components/brand/sorria-mark";
import { Spinner } from "@/components/ui/spinner";

export const metadata: Metadata = {
  title: "Entrar",
  description: "Sorria — Gestão inteligente para consultórios",
};

export default function LoginPage() {
  return (
    <main className="login-atmosphere flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-8">
        <div className="animate-fade-in flex flex-col items-center">
          <SorriaMark size="hero" showSubtitle align="center" />
        </div>

        <Suspense
          fallback={
            <div className="flex h-40 w-full items-center justify-center">
              <Spinner />
            </div>
          }
        >
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
