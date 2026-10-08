"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { calls, leads } from "@/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { features } from "@/lib/env";
import { getAgentWithOrg } from "@/lib/services/agents";
import { finalizeCall } from "@/lib/services/calls";
import { getUsageSummary } from "@/lib/services/usage";
import { parseForm, type ActionState } from "@/lib/validation";
import { startOutboundCall, VapiError } from "@/lib/voice/vapi";

const outboundSchema = z.object({
  leadId: z.uuid("Selecciona un lead"),
  agentId: z.uuid("Selecciona un agente"),
  purpose: z.string().trim().min(3, "Describe el motivo de la llamada").max(500),
});

export async function startOutboundCallAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { organization: org } = await requireAuth();
  if (!features.vapi()) return { error: "Configura VAPI_API_KEY y VAPI_WEBHOOK_SECRET para hacer llamadas." };

  const parsed = parseForm(outboundSchema, formData);
  if (!parsed.success) return parsed.state;

  const usage = await getUsageSummary(org);
  if (!usage.canUseVoice) return { error: "No tienes minutos disponibles o tu plan no está activo." };

  const found = await getAgentWithOrg(parsed.data.agentId, org.id);
  if (!found) return { error: "Agente no encontrado." };
  if (!found.agent.outboundEnabled || !found.agent.isActive) {
    return { error: "Este agente no tiene habilitadas las llamadas salientes." };
  }

  const [lead] = await db
    .select()
    .from(leads)
    .where(and(eq(leads.id, parsed.data.leadId), eq(leads.organizationId, org.id)))
    .limit(1);
  if (!lead) return { error: "Lead no encontrado." };

  let callId: string;
  try {
    const call = await startOutboundCall({ agent: found.agent, org, lead, purpose: parsed.data.purpose });
    callId = call.id;
  } catch (err) {
    if (err instanceof VapiError) return { error: err.message };
    console.error("[llamadas] Error iniciando llamada saliente", err);
    return { error: "No se pudo iniciar la llamada. Intenta de nuevo." };
  }
  revalidatePath("/dashboard/llamadas");
  redirect(`/dashboard/llamadas/${callId}`);
}

export async function reanalyzeCallAction(callId: string) {
  const { organization: org } = await requireAuth();
  const [call] = await db
    .select({ id: calls.id })
    .from(calls)
    .where(and(eq(calls.id, callId), eq(calls.organizationId, org.id)))
    .limit(1);
  if (!call) return;
  await finalizeCall(call.id);
  revalidatePath(`/dashboard/llamadas/${callId}`);
}

export async function deleteCallAction(callId: string) {
  const { organization: org } = await requireAuth();
  await db.delete(calls).where(and(eq(calls.id, callId), eq(calls.organizationId, org.id)));
  revalidatePath("/dashboard/llamadas");
  redirect("/dashboard/llamadas");
}
