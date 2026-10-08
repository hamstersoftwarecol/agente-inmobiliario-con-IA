import { eq } from "drizzle-orm";
import { after, type NextRequest } from "next/server";
import { db } from "@/db";
import { calls } from "@/db/schema";
import { getAgentByVapiPhoneNumber, getAgentWithOrg, isUuid, type AgentWithOrg } from "@/lib/services/agents";
import { finalizeCall } from "@/lib/services/calls";
import { getUsageSummary } from "@/lib/services/usage";
import { mapVapiStatus, parseEndOfCallReport, type VapiServerMessage } from "@/lib/voice/events";
import { authorizeWebhook, buildAssistant, ensureCallRecord, type WebhookAuth } from "@/lib/voice/vapi";

export const maxDuration = 60;

async function resolveAgent(message: VapiServerMessage, auth: WebhookAuth): Promise<AgentWithOrg | undefined> {
  if (auth.scope === "agent") return getAgentWithOrg(auth.agentId);

  const phoneNumberId = message.phoneNumber?.id ?? message.call?.phoneNumberId;
  if (phoneNumberId) {
    const byPhone = await getAgentByVapiPhoneNumber(phoneNumberId);
    if (byPhone) return byPhone;
  }
  const metaAgentId = message.call?.assistant?.metadata?.agentId ?? message.assistant?.metadata?.agentId;
  return isUuid(metaAgentId) ? getAgentWithOrg(metaAgentId) : undefined;
}

/**
 * Webhook de eventos de Vapi:
 * - assistant-request: una llamada entrante a un número configurado pide su asistente.
 * - status-update: cambios de estado de la llamada.
 * - end-of-call-report: transcripción, grabación y duración al colgar → análisis con IA.
 */
export async function POST(request: NextRequest) {
  const auth = authorizeWebhook(request);
  if (!auth) return Response.json({ error: "No autorizado" }, { status: 401 });

  const payload = (await request.json().catch(() => null)) as { message?: VapiServerMessage } | null;
  const message = payload?.message;
  if (!message?.type) return Response.json({ error: "Evento inválido" }, { status: 400 });

  const found = await resolveAgent(message, auth);

  switch (message.type) {
    case "assistant-request": {
      if (!found) return Response.json({ error: "Este número no tiene un agente asignado." });
      const { agent, org } = found;
      const english = agent.language === "en";
      if (!agent.isActive || !agent.inboundEnabled) {
        return Response.json({
          error: english
            ? "Sorry, this line is not taking calls right now."
            : "Lo sentimos, esta línea no está recibiendo llamadas en este momento.",
        });
      }
      const usage = await getUsageSummary(org);
      if (!usage.canUseVoice) {
        return Response.json({
          error: english
            ? "Sorry, we can't take your call right now. Please try again later."
            : "Lo sentimos, en este momento no podemos atender tu llamada. Intenta más tarde.",
        });
      }
      await ensureCallRecord({ vapiCall: message.call ?? {}, agent, org, phoneNumber: message.phoneNumber?.number });
      return Response.json({ assistant: buildAssistant(agent, org) });
    }

    case "status-update": {
      if (!found || !message.call?.id) break;
      const status = mapVapiStatus(message.status, message.endedReason);
      const call = await ensureCallRecord({ vapiCall: message.call, agent: found.agent, org: found.org });
      if (call && status && call.status !== "ended" && call.status !== "failed") {
        await db
          .update(calls)
          .set({ status, startedAt: status === "in_progress" && !call.startedAt ? new Date() : call.startedAt })
          .where(eq(calls.id, call.id));
      }
      break;
    }

    case "end-of-call-report": {
      if (!found || !message.call?.id) break;
      const call = await ensureCallRecord({ vapiCall: message.call, agent: found.agent, org: found.org });
      if (!call) break;
      const report = parseEndOfCallReport(message, found.agent.name);
      await db
        .update(calls)
        .set({
          status: report.status,
          transcript: report.transcript ?? call.transcript,
          recordingUrl: report.recordingUrl,
          startedAt: report.startedAt ?? call.startedAt,
          endedAt: report.endedAt,
          durationSec: report.durationSec,
          endedReason: report.endedReason,
          cost: report.cost,
          summary: call.summary ?? report.providerSummary,
        })
        .where(eq(calls.id, call.id));
      // El análisis con IA se ejecuta después de responder a Vapi.
      after(async () => {
        try {
          await finalizeCall(call.id);
        } catch (err) {
          console.error("[voice-webhook] Error finalizando llamada", call.id, err);
        }
      });
      break;
    }
  }

  return Response.json({ received: true });
}
