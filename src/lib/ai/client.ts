import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";

let client: Anthropic | undefined;

/** Cliente de Anthropic perezoso (lee ANTHROPIC_API_KEY del entorno). */
export function anthropic(): Anthropic {
  client ??= new Anthropic({ maxRetries: 2 });
  return client;
}

/**
 * Betas usadas en todas las peticiones:
 * - server-side-fallback: si el modelo declina por políticas, la API reintenta en el modelo recomendado.
 * - thinking-binding-controls: si el historial cambia, descarta bloques de razonamiento en lugar de fallar.
 */
export const AI_BETAS: Anthropic.Beta.AnthropicBeta[] = [
  "server-side-fallback-2026-07-01",
  "thinking-binding-controls-2026-08-01",
];

export function chatModel() {
  return env().ANTHROPIC_MODEL;
}

export function voiceModel() {
  return env().ANTHROPIC_VOICE_MODEL ?? env().ANTHROPIC_MODEL;
}

export function analysisModel() {
  return env().ANTHROPIC_MODEL;
}
