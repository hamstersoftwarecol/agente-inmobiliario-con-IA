import type Anthropic from "@anthropic-ai/sdk";

/** Mensaje inicial del lado del cliente: la API exige que la conversación empiece con "user". */
export const CONVERSATION_START = "[El cliente inicia la conversación]";

/** Historial inicial: el agente saluda primero, igual que en una llamada telefónica. */
export function initialHistory(greeting: string): Anthropic.Beta.BetaMessageParam[] {
  return [
    { role: "user", content: CONVERSATION_START },
    { role: "assistant", content: greeting },
  ];
}

export function parseHistory(json: string | null | undefined): Anthropic.Beta.BetaMessageParam[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
