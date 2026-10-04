import type { ParsedIntent } from "@/types/assistant";

export type AIProviderMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AIProvider = {
  name: string;
  /** Structured intent + tool selection — never raw SQL. */
  parseIntent(input: {
    messages: AIProviderMessage[];
    allowedTools: string[];
    contextHint?: string;
  }): Promise<ParsedIntent>;
  /** Present tool result as user-facing text (no invented numbers). */
  presentResult(input: {
    userMessage: string;
    toolName: string;
    toolResult: unknown;
    facts: string[];
  }): Promise<string>;
};

export class ProviderUnavailableError extends Error {
  constructor(message = "A Secretária Virtual não conseguiu responder agora. Tente novamente.") {
    super(message);
    this.name = "ProviderUnavailableError";
  }
}
