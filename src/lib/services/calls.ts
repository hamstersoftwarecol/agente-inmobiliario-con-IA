import { eq } from "drizzle-orm";
import { db } from "@/db";
import { calls, organizations, type Call, type CallDirection, type LeadSource } from "@/db/schema";
import { analyzeConversation } from "@/lib/ai/analysis";
import { features } from "@/lib/env";
import { flagFollowUp, saveLeadInfo } from "@/lib/services/leads";

const SOURCE_BY_DIRECTION: Record<CallDirection, LeadSource> = {
  inbound: "inbound_call",
  outbound: "outbound_call",
  web: "web_call",
  simulator: "simulator",
};

/** Teléfono del cliente según la dirección de la llamada. */
export function customerNumber(call: Pick<Call, "direction" | "fromNumber" | "toNumber">) {
  return call.direction === "outbound" ? call.toNumber : call.fromNumber;
}

/**
 * Post-proceso de una llamada finalizada: analiza la transcripción con IA, guarda resumen,
 * resultado y sentimiento, y crea/actualiza el lead con los datos extraídos.
 */
export async function finalizeCall(callId: string): Promise<Call | undefined> {
  const [row] = await db
    .select({ call: calls, org: organizations })
    .from(calls)
    .innerJoin(organizations, eq(organizations.id, calls.organizationId))
    .where(eq(calls.id, callId))
    .limit(1);
  if (!row) return undefined;
  const { call, org } = row;
  const phone = customerNumber(call);
  const transcript = call.transcript ?? "";

  let analysis = null;
  if (features.ai() && transcript.trim().length >= 20) {
    try {
      analysis = await analyzeConversation({
        transcript,
        agencyName: org.name,
        currency: org.currency,
        direction: call.direction,
      });
    } catch (err) {
      console.error(`[calls] Error analizando la llamada ${callId}:`, err);
    }
  }

  let leadId = call.leadId;
  const hasConversation = transcript.trim().length >= 20;
  if (analysis || (hasConversation && phone) || leadId) {
    const lead = await saveLeadInfo(
      org.id,
      analysis
        ? {
            ...analysis.lead,
            bedrooms: analysis.lead.bedrooms !== null ? Math.round(analysis.lead.bedrooms) : null,
            budgetMin: analysis.lead.budgetMin !== null ? Math.round(analysis.lead.budgetMin) : null,
            budgetMax: analysis.lead.budgetMax !== null ? Math.round(analysis.lead.budgetMax) : null,
          }
        : {},
      { leadId, source: SOURCE_BY_DIRECTION[call.direction], fallbackPhone: phone, markContacted: hasConversation },
    );
    leadId = lead.id;
    if (analysis?.outcome === "callback_requested") {
      await flagFollowUp(lead.id, analysis.followUpActions[0] ?? "El cliente pidió que lo llamen.");
    }
  }

  const fallbackOutcome = hasConversation ? "other" : "no_answer";
  const [updated] = await db
    .update(calls)
    .set({
      leadId,
      summary: analysis?.summary ?? call.summary ?? (hasConversation ? null : "Sin conversación registrada."),
      outcome: analysis?.outcome ?? call.outcome ?? fallbackOutcome,
      sentiment: analysis?.sentiment ?? call.sentiment,
      analysis: analysis ? { keyPoints: analysis.keyPoints, followUpActions: analysis.followUpActions } : call.analysis,
      analyzedAt: new Date(),
    })
    .where(eq(calls.id, callId))
    .returning();
  return updated;
}
