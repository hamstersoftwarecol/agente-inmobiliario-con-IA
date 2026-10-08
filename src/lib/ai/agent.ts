import Anthropic from "@anthropic-ai/sdk";
import { AI_BETAS, anthropic } from "./client";
import { executeTool, TOOL_DEFINITIONS, type ToolContext, type ToolEvent } from "./tools";

type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export type AgentTurnOptions = {
  ctx: ToolContext;
  system: string;
  /** Historial completo (solo se agrega al final; nunca se edita) incluyendo el último mensaje del cliente. */
  messages: Anthropic.Beta.BetaMessageParam[];
  model: string;
  effort: Effort;
  onText?: (delta: string) => void;
  onToolStart?: (name: string) => void;
  maxToolRounds?: number;
  signal?: AbortSignal;
};

export type AgentTurnResult = {
  /** Mensajes nuevos a agregar al historial (respuestas del modelo y resultados de herramientas). */
  appended: Anthropic.Beta.BetaMessageParam[];
  text: string;
  toolEvents: ToolEvent[];
};

const REFUSAL_REPLY =
  "Disculpa, con eso no te puedo ayudar. ¿Hay algo sobre inmuebles, visitas o tu búsqueda en lo que te pueda ayudar?";
const ERROR_REPLY =
  "Disculpa, tuve un problema técnico. Si quieres, puedo pedir que un asesor te devuelva la llamada.";

// Herramientas con streaming anticipado de su entrada: validamos cada entrada con zod antes de ejecutarla.
const TOOLS: Anthropic.Beta.BetaTool[] = TOOL_DEFINITIONS.map((tool) => ({ ...tool, eager_input_streaming: true }));

/**
 * Ejecuta un turno del agente: llama a Claude en streaming, ejecuta las herramientas que pida
 * y repite hasta obtener la respuesta final para el cliente.
 */
export async function runAgentTurn(opts: AgentTurnOptions): Promise<AgentTurnResult> {
  const { ctx, system, model, effort, onText, onToolStart, signal } = opts;
  const maxRounds = opts.maxToolRounds ?? 6;
  const appended: Anthropic.Beta.BetaMessageParam[] = [];
  const toolEvents: ToolEvent[] = [];
  let finalText = "";
  let jsonRetries = 0;

  const emit = (text: string) => {
    finalText += text;
    onText?.(text);
  };

  for (let round = 0; round < maxRounds; round++) {
    let roundText = "";
    const stream = anthropic().beta.messages.stream(
      {
        model,
        max_tokens: 16000,
        betas: AI_BETAS,
        fallbacks: "default",
        thinking: { type: "adaptive", block_binding: { prefix_mismatch_behavior: "drop_block" } },
        output_config: { effort },
        // El prompt de sistema es estable durante la conversación: se cachea junto con las herramientas.
        system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
        tools: TOOLS,
        messages: [...opts.messages, ...appended],
      },
      { signal },
    );
    stream.on("text", (delta) => {
      roundText += delta;
      emit(delta);
    });

    let message: Anthropic.Beta.BetaMessage;
    try {
      message = await stream.finalMessage();
      jsonRetries = 0;
    } catch (err) {
      // Solo reintentamos si la entrada de una herramienta no se pudo parsear; los errores de API se propagan.
      if (err instanceof Anthropic.APIError || signal?.aborted || jsonRetries++ >= 2 || roundText) throw err;
      console.warn("[agent] Entrada de herramienta no parseable, reintentando el turno");
      continue;
    }

    if (message.stop_reason === "refusal") {
      // No reenviamos la respuesta declinada; la sustituimos por una respuesta segura.
      appended.push({ role: "assistant", content: REFUSAL_REPLY });
      emit(roundText ? ` ${REFUSAL_REPLY}` : REFUSAL_REPLY);
      break;
    }

    appended.push({ role: "assistant", content: message.content });

    if (message.stop_reason === "pause_turn") continue;

    const toolUses = message.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    // Solo ejecutamos herramientas si el modelo terminó de pedirlas (no en max_tokens).
    if (message.stop_reason !== "tool_use" || toolUses.length === 0) break;

    for (const tool of toolUses) onToolStart?.(tool.name);
    const events = await Promise.all(toolUses.map((tool) => executeTool(tool.name, tool.input, ctx)));
    toolEvents.push(...events);

    // Todos los resultados van en un único mensaje de usuario.
    appended.push({
      role: "user",
      content: toolUses.map((tool, i) => ({
        type: "tool_result" as const,
        tool_use_id: tool.id,
        content: events[i].result,
        is_error: events[i].isError || undefined,
      })),
    });
  }

  if (!finalText.trim()) {
    // Sin texto final (límite de rondas o respuesta vacía): cerramos el turno de forma segura.
    const fallback = toolEvents.some((e) => !e.isError) ? "Listo. ¿Te puedo ayudar con algo más?" : ERROR_REPLY;
    appended.push({ role: "assistant", content: fallback });
    emit(fallback);
  }

  return { appended, text: finalText.trim(), toolEvents };
}

export { ERROR_REPLY };
