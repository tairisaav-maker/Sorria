"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type {
  AssistantActionPreview,
  AssistantMessage,
  AssistantNavLink,
  AssistantResultCard,
  AssistantThread,
} from "@/types/assistant";

type ChatPayload = {
  thread: AssistantThread;
  messages: AssistantMessage[];
  assistant_message: AssistantMessage;
  rate_limited?: boolean;
};

export function AssistantClient() {
  const [thread, setThread] = useState<AssistantThread | null>(null);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/demo/assistant?resource=suggestions");
        const data = await res.json();
        if (res.ok) setSuggestions(data.suggestions ?? []);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, scrollToBottom]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || loading) return;
    setLoading(true);
    setError(null);
    setStatus("Consultando…");
    setInput("");
    try {
      const res = await fetch("/api/demo/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send",
          threadId: thread?.id ?? null,
          message,
        }),
      });
      const data = (await res.json()) as ChatPayload & { error?: string };
      if (!res.ok) {
        setError(data.error ?? "A Secretária Virtual não conseguiu responder agora. Tente novamente.");
        return;
      }
      setThread(data.thread);
      setMessages(data.messages);
    } catch {
      setError("A Secretária Virtual não conseguiu responder agora. Tente novamente.");
    } finally {
      setLoading(false);
      setStatus(null);
      inputRef.current?.focus();
    }
  }

  async function newConversation() {
    setThread(null);
    setMessages([]);
    setError(null);
    setStatus(null);
    inputRef.current?.focus();
  }

  async function confirmAction(actionId: string) {
    setConfirmBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/demo/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm", actionId }),
      });
      const data = (await res.json()) as {
        error?: string;
        assistant_message?: AssistantMessage;
      };
      if (!res.ok) {
        setError(data.error ?? "Não foi possível confirmar a ação.");
        setMessages((prev) =>
          prev.map((m) =>
            m.meta_json.action_plan_id === actionId
              ? {
                  ...m,
                  meta_json: {
                    ...m.meta_json,
                    action_plan_id: undefined,
                    action_preview: null,
                  },
                }
              : m,
          ),
        );
        return;
      }
      setMessages((prev) => {
        const cleared = prev.map((m) =>
          m.meta_json.action_plan_id === actionId
            ? {
                ...m,
                meta_json: {
                  ...m.meta_json,
                  action_plan_id: undefined,
                  action_preview: null,
                },
              }
            : m,
        );
        return data.assistant_message
          ? [...cleared, data.assistant_message]
          : cleared;
      });
    } catch {
      setError("Não foi possível confirmar a ação.");
    } finally {
      setConfirmBusy(false);
    }
  }

  async function cancelAction(actionId: string) {
    setConfirmBusy(true);
    try {
      await fetch("/api/demo/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel_action", actionId }),
      });
      setMessages((prev) =>
        prev.map((m) =>
          m.meta_json.action_plan_id === actionId
            ? {
                ...m,
                content: `${m.content}\n\nAção cancelada.`,
                meta_json: { ...m.meta_json, action_plan_id: undefined, action_preview: null },
              }
            : m,
        ),
      );
    } finally {
      setConfirmBusy(false);
    }
  }

  const empty = messages.length === 0;

  return (
    <div className="mx-auto flex h-[calc(100dvh-9.5rem)] w-full max-w-5xl flex-col gap-3 sm:h-[calc(100dvh-8rem)] lg:h-[calc(100dvh-5.5rem)]">
      <header className="flex shrink-0 items-start justify-between gap-3 animate-fade-in">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl tracking-tight text-[var(--brand-ink)] sm:text-3xl">
            Secretária Virtual
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Consulte informações e organize tarefas administrativas do consultório.
          </p>
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={() => void newConversation()}>
          Nova conversa
        </Button>
      </header>

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[1fr_240px]">
        <section
          className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 shadow-sm"
          aria-label="Conversa com a Secretária Virtual"
        >
          <div
            className="flex-1 space-y-3 overflow-y-auto px-3 py-4 sm:px-4"
            role="log"
            aria-live="polite"
            aria-relevant="additions"
          >
            {empty ? (
              <EmptyWelcome
                suggestions={suggestions}
                onPick={(s) => void send(s)}
              />
            ) : (
              messages
                .filter((m) => m.role !== "system")
                .map((m) => (
                  <MessageBubble
                    key={m.id}
                    message={m}
                    confirmBusy={confirmBusy}
                    onConfirm={(id) => void confirmAction(id)}
                    onCancel={(id) => void cancelAction(id)}
                  />
                ))
            )}
            {loading ? (
              <p className="text-sm text-[var(--text-muted)] animate-pulse" aria-live="polite">
                {status ?? "Consultando…"}
              </p>
            ) : null}
            {error ? (
              <p className="rounded-xl bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]" role="alert">
                {error}
              </p>
            ) : null}
            <div ref={bottomRef} />
          </div>

          <form
            className="shrink-0 border-t border-[var(--border)] bg-[var(--surface-elevated)] p-3"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <label htmlFor="assistant-input" className="sr-only">
              Mensagem para a Secretária Virtual
            </label>
            <div className="flex items-end gap-2">
              <textarea
                id="assistant-input"
                ref={inputRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send(input);
                  }
                }}
                placeholder="Pergunte sobre agenda, solicitações, pacientes…"
                className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-[var(--text)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]"
                disabled={loading}
              />
              <Button type="submit" loading={loading} disabled={!input.trim()}>
                Enviar
              </Button>
            </div>
          </form>
        </section>

        <aside className="hidden min-h-0 flex-col gap-3 lg:flex" aria-label="Sugestões">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-subtle)]">
              Sugestões
            </p>
            <ul className="mt-3 space-y-2">
              {suggestions.map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    onClick={() => void send(s)}
                    className="w-full rounded-xl border border-transparent bg-[var(--surface-muted)]/60 px-3 py-2 text-left text-sm text-[var(--text)] transition-colors hover:border-[var(--border)] hover:bg-[var(--brand-soft)]/50"
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          {thread?.context_json.patient_name ? (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)]/90 p-4 text-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-subtle)]">
                Contexto
              </p>
              <p className="mt-2 text-[var(--text)]">
                Paciente: {thread.context_json.patient_name}
              </p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Revalidado a cada consulta · clínica atual
              </p>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function EmptyWelcome({
  suggestions,
  onPick,
}: {
  suggestions: string[];
  onPick: (s: string) => void;
}) {
  return (
    <div className="flex flex-col items-start gap-4 px-1 py-6 animate-rise">
      <div>
        <p className="font-[family-name:var(--font-display)] text-xl text-[var(--brand-ink)]">
          Olá! Como posso ajudar na organização do consultório?
        </p>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Assistente administrativa do Sorria — consultas e ações controladas, sem diagnóstico clínico.
        </p>
      </div>
      <ul className="flex w-full flex-col gap-2 sm:max-w-md">
        {suggestions.map((s) => (
          <li key={s}>
            <button
              type="button"
              onClick={() => onPick(s)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]/40 px-3 py-2.5 text-left text-sm text-[var(--text)] transition-colors hover:bg-[var(--brand-soft)]/60"
            >
              {s}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MessageBubble({
  message,
  confirmBusy,
  onConfirm,
  onCancel,
}: {
  message: AssistantMessage;
  confirmBusy: boolean;
  onConfirm: (id: string) => void;
  onCancel: (id: string) => void;
}) {
  const isUser = message.role === "user";
  const cards = message.meta_json.cards;
  const links = message.meta_json.links;
  const preview = message.meta_json.action_preview;
  const actionId = message.meta_json.action_plan_id;

  return (
    <div
      className={`flex ${isUser ? "justify-end" : "justify-start"} animate-fade-in`}
    >
      <div
        className={`max-w-[92%] space-y-2 sm:max-w-[80%] ${
          isUser
            ? "rounded-2xl rounded-br-md bg-[var(--brand-primary)] px-3.5 py-2.5 text-white"
            : "rounded-2xl rounded-bl-md bg-[var(--surface-muted)]/70 px-3.5 py-2.5 text-[var(--text)]"
        }`}
      >
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>

        {!isUser && cards && cards.length > 0 ? (
          <div className="grid grid-cols-2 gap-2 pt-1">
            {cards.map((c) => (
              <ResultCard key={`${c.title}-${c.value}`} card={c} />
            ))}
          </div>
        ) : null}

        {!isUser && links && links.length > 0 ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {links.map((l) => (
              <NavChip key={l.href + l.label} link={l} />
            ))}
          </div>
        ) : null}

        {!isUser && preview && actionId ? (
          <ActionCard
            preview={preview}
            busy={confirmBusy}
            onConfirm={() => onConfirm(actionId)}
            onCancel={() => onCancel(actionId)}
          />
        ) : null}
      </div>
    </div>
  );
}

function ResultCard({ card }: { card: AssistantResultCard }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white/80 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-[var(--text-subtle)]">
        {card.title}
      </p>
      <p className="mt-0.5 text-lg font-semibold text-[var(--brand-ink)]">{card.value}</p>
      {card.hint ? (
        <p className="text-xs text-[var(--text-muted)]">{card.hint}</p>
      ) : null}
    </div>
  );
}

function NavChip({ link }: { link: AssistantNavLink }) {
  return (
    <Link
      href={link.href}
      className="inline-flex items-center rounded-lg border border-[var(--border)] bg-white px-2.5 py-1 text-xs font-medium text-[var(--brand-primary)] hover:bg-[var(--brand-soft)]"
    >
      {link.label}
    </Link>
  );
}

function ActionCard({
  preview,
  busy,
  onConfirm,
  onCancel,
}: {
  preview: AssistantActionPreview;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="mt-2 rounded-xl border border-[var(--border)] bg-white p-3 shadow-sm"
      role="group"
      aria-label={preview.title}
    >
      <p className="text-sm font-semibold text-[var(--brand-ink)]">{preview.title}</p>
      <dl className="mt-2 space-y-1.5">
        {preview.fields.map((f) => (
          <div key={f.label} className="flex justify-between gap-3 text-sm">
            <dt className="text-[var(--text-muted)]">{f.label}</dt>
            <dd className="text-right font-medium text-[var(--text)]">{f.value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={onCancel}>
          {preview.cancel_label}
        </Button>
        <Button type="button" size="sm" loading={busy} onClick={onConfirm}>
          {preview.confirm_label}
        </Button>
      </div>
    </div>
  );
}
