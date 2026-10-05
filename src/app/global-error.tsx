"use client";

import { useEffect } from "react";
import { createCorrelationId } from "@/lib/observability";

/**
 * Error boundary raiz — nunca mostra stack trace ao usuário.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const code =
    error.digest?.slice(0, 8)?.toUpperCase() ?? createCorrelationId();

  useEffect(() => {
    console.error("[sorria:global-error]", { code, message: error.message });
  }, [code, error.message]);

  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#F7F9FA",
          color: "#0B3D3A",
          padding: 16,
          textAlign: "center",
        }}
      >
        <main>
          <h1 style={{ fontSize: 24, margin: 0 }}>Algo deu errado</h1>
          <p style={{ color: "#5A6B6A", marginTop: 8, maxWidth: 360 }}>
            Não foi possível carregar o Sorria. Tente novamente.
          </p>
          <p style={{ fontSize: 12, color: "#8A9A99", marginTop: 12 }}>
            Código: {code}
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 20,
              height: 44,
              padding: "0 16px",
              borderRadius: 12,
              border: "none",
              background: "#246B73",
              color: "#fff",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Tentar novamente
          </button>
        </main>
      </body>
    </html>
  );
}
