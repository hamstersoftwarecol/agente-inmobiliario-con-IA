import type Anthropic from "@anthropic-ai/sdk";
import { CONVERSATION_START } from "@/lib/ai/conversation";

/** Mensaje en formato OpenAI Chat Completions, tal como lo envía Vapi al LLM personalizado. */
export type OpenAiMessage = {
  role: string;
  content?: string | Array<{ type?: string; text?: string }> | null;
};

const SILENCE = "[El cliente guarda silencio]";

function textOf(content: OpenAiMessage["content"]): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((p) => p?.text ?? "").join(" ");
  return "";
}

/**
 * Convierte el historial de Vapi (OpenAI) al formato de Claude:
 * ignora mensajes de sistema/herramientas, une turnos consecutivos del mismo rol
 * y garantiza que empiece y termine con un mensaje del cliente.
 */
export function openAiToAnthropic(messages: OpenAiMessage[] | undefined): Anthropic.Beta.BetaMessageParam[] {
  const out: { role: "user" | "assistant"; content: string }[] = [];
  for (const m of messages ?? []) {
    if (m.role !== "user" && m.role !== "assistant") continue;
    const text = textOf(m.content).trim();
    if (!text) continue;
    const last = out.at(-1);
    if (last && last.role === m.role) last.content = `${last.content}\n${text}`;
    else out.push({ role: m.role, content: text });
  }
  if (out[0]?.role !== "user") out.unshift({ role: "user", content: CONVERSATION_START });
  if (out.at(-1)?.role !== "user") out.push({ role: "user", content: SILENCE });
  return out;
}

const encoder = new TextEncoder();

function chunk(id: string, model: string, delta: Record<string, unknown>, finishReason: string | null) {
  const payload = {
    id,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, delta, finish_reason: finishReason }],
  };
  return encoder.encode(`data: ${JSON.stringify(payload)}\n\n`);
}

/**
 * Respuesta en streaming compatible con OpenAI (SSE). `run` recibe una función para emitir texto;
 * si falla, se emite `fallbackText` para que la llamada no quede en silencio.
 */
export function openAiStream(
  model: string,
  run: (write: (text: string) => void) => Promise<void>,
  fallbackText: string,
): Response {
  const id = `chatcmpl-${crypto.randomUUID()}`;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let wrote = false;
      const write = (text: string) => {
        if (!text) return;
        controller.enqueue(chunk(id, model, wrote ? { content: text } : { role: "assistant", content: text }, null));
        wrote = true;
      };
      try {
        await run(write);
      } catch (err) {
        console.error("[voice-llm] Error generando respuesta:", err);
        write(wrote ? ` ${fallbackText}` : fallbackText);
      }
      controller.enqueue(chunk(id, model, {}, "stop"));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

/** Respuesta no streaming (chat.completion) por compatibilidad. */
export function openAiCompletion(model: string, text: string): Response {
  return Response.json({
    id: `chatcmpl-${crypto.randomUUID()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, message: { role: "assistant", content: text }, finish_reason: "stop" }],
  });
}
