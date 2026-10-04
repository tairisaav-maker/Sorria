"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { hasSupabaseConfig } from "@/lib/supabase/client";
import { isDemoMode } from "@/lib/utils";
import { loginSchema, type LoginValues } from "@/lib/validations/auth";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/app/home";
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: isDemoMode() ? "demo@sorria.app" : "",
      password: isDemoMode() ? "sorria-demo" : "",
    },
  });

  async function onSubmit(values: LoginValues) {
    setFormError(null);

    try {
      if (isDemoMode()) {
        const response = await fetch("/auth/demo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        });

        if (response.ok) {
          const payload = (await response.json()) as {
            redirect?: string;
            kind?: string;
          };
          const dest =
            payload.redirect ??
            (payload.kind === "portal" ? "/portal/inicio" : next);
          router.replace(dest);
          router.refresh();
          return;
        }

        if (!hasSupabaseConfig()) {
          const payload = (await response.json()) as { error?: string };
          setFormError(payload.error ?? "Não foi possível entrar no modo demo.");
          return;
        }
      }

      if (!hasSupabaseConfig()) {
        setFormError(
          "Configure o Supabase ou habilite NEXT_PUBLIC_DEMO_MODE=true.",
        );
        return;
      }

      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });

      if (error) {
        setFormError("E-mail ou senha incorretos.");
        return;
      }

      router.replace(next);
      router.refresh();
    } catch {
      setFormError("Falha inesperada ao entrar. Tente novamente.");
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="animate-rise w-full space-y-4 rounded-2xl border border-white/60 bg-white/85 p-5 shadow-[0_20px_50px_-28px_rgba(11,61,58,0.45)] backdrop-blur-md sm:p-6"
      noValidate
    >
      <div>
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="voce@email.com"
          aria-invalid={Boolean(errors.email)}
          {...register("email")}
        />
        {errors.email ? (
          <p className="mt-1 text-xs text-[var(--danger)]">{errors.email.message}</p>
        ) : null}
      </div>

      <div>
        <Label htmlFor="password">Senha</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          aria-invalid={Boolean(errors.password)}
          {...register("password")}
        />
        {errors.password ? (
          <p className="mt-1 text-xs text-[var(--danger)]">
            {errors.password.message}
          </p>
        ) : null}
      </div>

      {formError ? (
        <p
          className="rounded-xl bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]"
          role="alert"
        >
          {formError}
        </p>
      ) : null}

      <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
        Entrar
      </Button>

      {isDemoMode() ? (
        <div className="space-y-2">
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            loading={isSubmitting}
            onClick={() => {
              setValue("email", "paciente@sorria.app");
              setValue("password", "sorria-demo");
              void handleSubmit(onSubmit)();
            }}
          >
            Entrar no Portal (paciente demo)
          </Button>
          <p className="text-center text-xs text-[var(--text-subtle)]">
            Teste V1 — owner: DEMO_EMAIL · dentista: carlos.a@clinicademo.sorria.app
            · secretária: mariana.a@clinicademo.sorria.app · senha: DEMO_PASSWORD
            (padrão em .env.local). Portal: paciente@sorria.app.
          </p>
        </div>
      ) : null}
    </form>
  );
}
