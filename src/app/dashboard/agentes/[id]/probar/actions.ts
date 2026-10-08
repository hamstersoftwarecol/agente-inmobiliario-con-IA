"use server";

import Anthropic from "@anthropic-ai/sdk";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { calls } from "@/db/schema";
import { runAgentTurn } from "@/lib/ai/agent";
import { transcriptFromMessages } from "@/lib/ai/analysis";
import { chatModel } from "@/lib/ai/client";
import { initialHistory, parseHistory } from "@/lib/ai/conversation";
import { buildSystemPrompt } from "@/lib/ai/prompt";
import { rateLimit } from "@/lib/auth/rate-limit";
import { requireAuth } from "@/lib/auth/session";
import { env, features } from "@/lib/env";
import { callOutcomeLabels } from "@/lib/labels";
import { getAgentWithOrg } from "@/lib/services/agents";
import { finalizeCall } from "@/lib/services/calls";
import { getUsageSummary } from "@/lib/services/usage";
import { buildAssistant, type VapiAssistant } from "@/lib/voice/vapi";

export type SimulatorToolEvent = { name: string; result: string; isError: boolean };

export type SimulatorReply =
  | { ok: true; sessionId: string; reply: string; tools: SimulatorToolEvent[] }
  | { ok: false; error: string };

function friendlyError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return "La clave de Anthropic no es válida.";
  if (err instanceof Anthropic.RateLimitError) return "Límite de uso de la IA alcanzado. Intenta en unos segundos.";
  if (err instanceof Anthropic.APIError) return `Error de la IA (${err.status ?? "red"}). Intenta de nuevo.`;
  return "Ocurrió un error inesperado. Intenta de nuevo.";
}

export async function sendSimulatorMessage(agentId: string, sessionId: string | null, text: string): Promise<SimulatorReply> {
  const { organization: org } = await requireAuth();
  if (!features.ai()) return { ok: false, error: "Configura ANTHROPIC_API_KEY para conversar con el agente." };

  const message = text.trim().slice(0, 2000);
  if (!message) return { ok: false, error: "Escribe un mensaje." };
  if (!rateLimit(`sim:${org.id}`, 60, 10 * 60 * 1000).ok) {
    return { ok: false, error: "Demasiados mensajes seguidos. Espera unos minutos." };
  }

  const found = await getAgentWithOrg(agentId, org.id);
  if (!found) return { ok: false, error: "Agente no encontrado." };
  const { agent } = found;

  let call;
  if (sessionId) {
    [call] = await db
      .select()
      .from(calls)
      .where(and(eq(calls.id, sessionId), eq(calls.organizationId, org.id), eq(calls.direction, "simulator")))
      .limit(1);
    if (!call || call.status === "ended") return { ok: false, error: "La conversación terminó. Inicia una nueva." };
  } else {
    // El prompt de sistema y el saludo se congelan al iniciar: el historial solo crece al final.
    [call] = await db
      .insert(calls)
      .values({
        organizationId: org.id,
        agentId: agent.id,
        direction: "simulator",
        status: "in_progress",
        startedAt: new Date(),
        systemPrompt: buildSystemPrompt({ org, agent, channel: "simulator", direction: "inbound" }),
        aiMessages: JSON.stringify(initialHistory(agent.greeting)),
      })
      .returning();
  }

  const history = parseHistory(call.aiMessages);
  const userMessage: Anthropic.Beta.BetaMessageParam = { role: "user", content: message };

  try {
    const result = await runAgentTurn({
      ctx: {
        org,
        agent,
        channel: "simulator",
        direction: "inbound",
        callId: call.id,
        leadId: call.leadId,
        callerPhone: null,
      },
      system: call.systemPrompt ?? buildSystemPrompt({ org, agent, channel: "simulator", direction: "inbound" }),
      messages: [...history, userMessage],
      model: chatModel(),
      effort: env().AI_CHAT_EFFORT,
    });

    const updatedHistory = [...history, userMessage, ...result.appended];
    await db
      .update(calls)
      .set({ aiMessages: JSON.stringify(updatedHistory), transcript: transcriptFromMessages(updatedHistory, agent.name) })
      .where(eq(calls.id, call.id));

    return {
      ok: true,
      sessionId: call.id,
      reply: result.text,
      tools: result.toolEvents.map((e) => ({ name: e.name, result: e.result, isError: e.isError })),
    };
  } catch (err) {
    console.error("[simulador] Error en el turno del agente", err);
    return { ok: false, error: friendlyError(err) };
  }
}

export type EndSimulatorResult =
  | { ok: true; callId: string; summary: string | null; outcome: string | null; leadId: string | null }
  | { ok: false; error: string };

export async function endSimulatorSession(sessionId: string): Promise<EndSimulatorResult> {
  const { organization: org } = await requireAuth();
  const [call] = await db
    .select()
    .from(calls)
    .where(and(eq(calls.id, sessionId), eq(calls.organizationId, org.id), eq(calls.direction, "simulator")))
    .limit(1);
  if (!call) return { ok: false, error: "Conversación no encontrada." };

  const endedAt = new Date();
  await db
    .update(calls)
    .set({
      status: "ended",
      endedAt,
      durationSec: call.startedAt ? Math.round((endedAt.getTime() - call.startedAt.getTime()) / 1000) : 0,
      endedReason: "simulator-ended",
    })
    .where(eq(calls.id, call.id));

  const finalized = await finalizeCall(call.id);
  revalidatePath("/dashboard/llamadas");
  revalidatePath("/dashboard/leads");
  return {
    ok: true,
    callId: call.id,
    summary: finalized?.summary ?? null,
    outcome: finalized?.outcome ? callOutcomeLabels[finalized.outcome] : null,
    leadId: finalized?.leadId ?? null,
  };
}

export type WebCallConfig = { ok: true; publicKey: string; assistant: VapiAssistant } | { ok: false; error: string };

/** Configuración para una llamada de voz real desde el navegador (Vapi Web SDK). */
export async function getWebCallConfig(agentId: string): Promise<WebCallConfig> {
  const { organization: org } = await requireAuth();
  const publicKey = env().NEXT_PUBLIC_VAPI_PUBLIC_KEY;
  if (!features.vapiWeb() || !publicKey) {
    return { ok: false, error: "Configura NEXT_PUBLIC_VAPI_PUBLIC_KEY y VAPI_WEBHOOK_SECRET para llamadas web." };
  }
  if (!features.ai()) return { ok: false, error: "Configura ANTHROPIC_API_KEY." };
  const usage = await getUsageSummary(org);
  if (!usage.canUseVoice) return { ok: false, error: "No tienes minutos disponibles o tu plan no está activo." };

  const found = await getAgentWithOrg(agentId, org.id);
  if (!found) return { ok: false, error: "Agente no encontrado." };
  return { ok: true, publicKey, assistant: buildAssistant(found.agent, org, { metadata: { source: "dashboard-test" } }) };
}
