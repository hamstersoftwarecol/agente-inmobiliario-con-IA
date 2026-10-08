import type { NextRequest } from "next/server";
import { runAgentTurn, ERROR_REPLY } from "@/lib/ai/agent";
import { voiceModel } from "@/lib/ai/client";
import { buildSystemPrompt } from "@/lib/ai/prompt";
import type { ToolContext } from "@/lib/ai/tools";
import { env, features } from "@/lib/env";
import { getAgentWithOrg } from "@/lib/services/agents";
import { getUsageSummary } from "@/lib/services/usage";
import { normalizePhone } from "@/lib/format";
import { openAiCompletion, openAiStream, openAiToAnthropic, type OpenAiMessage } from "@/lib/voice/openai-compat";
import { directionFromCallType, ensureCallRecord, verifyToken, type VapiCall } from "@/lib/voice/vapi";

export const maxDuration = 60;

type Body = { messages?: OpenAiMessage[]; stream?: boolean; call?: VapiCall };

/**
 * LLM personalizado para Vapi (formato OpenAI Chat Completions).
 * Vapi transcribe la voz del cliente, nos envía la conversación y lee en voz alta lo que respondemos.
 * Aquí Claude razona, usa las herramientas (inventario, agenda, CRM) y responde en streaming.
 */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/voice/llm/[agentId]/[token]/chat/completions">) {
  const { agentId, token } = await ctx.params;
  if (!verifyToken(`llm:${agentId}`, token)) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body || !Array.isArray(body.messages)) {
    return Response.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const found = await getAgentWithOrg(agentId);
  if (!found) return Response.json({ error: "Agente no encontrado" }, { status: 404 });
  const { agent, org } = found;
  const model = voiceModel();
  const english = agent.language === "en";

  const vapiCall = body.call ?? {};
  const direction = directionFromCallType(vapiCall.type);
  const callRecord = await ensureCallRecord({ vapiCall, agent, org });
  const usage = await getUsageSummary(org);

  const unavailable = english
    ? "I'm sorry, we can't take your call right now. Please try again later. Goodbye!"
    : "Lo siento, en este momento no podemos atender tu llamada. Por favor intenta más tarde. ¡Hasta luego!";
  if (!agent.isActive || !usage.canUseVoice || !features.ai()) {
    return body.stream === false ? openAiCompletion(model, unavailable) : openAiStream(model, async (w) => w(unavailable), unavailable);
  }

  const toolCtx: ToolContext = {
    org,
    agent,
    channel: direction === "web" ? "web" : "phone",
    direction: direction === "outbound" ? "outbound" : "inbound",
    callId: callRecord?.id ?? null,
    leadId: callRecord?.leadId ?? null,
    callerPhone: normalizePhone(vapiCall.customer?.number),
  };
  const system =
    callRecord?.systemPrompt ??
    buildSystemPrompt({ org, agent, channel: toolCtx.channel, direction: toolCtx.direction });
  const messages = openAiToAnthropic(body.messages);
  const filler = english ? "One moment, please. " : "Un momento, por favor. ";

  if (body.stream === false) {
    const result = await runAgentTurn({ ctx: toolCtx, system, messages, model, effort: env().AI_CHAT_EFFORT });
    return openAiCompletion(model, result.text);
  }

  return openAiStream(
    model,
    async (write) => {
      let spoken = false;
      let filled = false;
      await runAgentTurn({
        ctx: toolCtx,
        system,
        messages,
        model,
        effort: env().AI_CHAT_EFFORT,
        signal: request.signal,
        onText: (delta) => {
          spoken = true;
          write(delta);
        },
        // Mientras se consultan inventario o agenda, avisamos al cliente para evitar silencios largos.
        onToolStart: () => {
          if (!spoken && !filled) {
            filled = true;
            write(filler);
          }
        },
      });
    },
    ERROR_REPLY,
  );
}
