import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import {
  callOutcomeEnum,
  leadFinancingEnum,
  leadIntentEnum,
  leadTimelineEnum,
  propertyTypeEnum,
  sentimentEnum,
} from "@/db/schema";
import { env } from "@/lib/env";
import { anthropic, analysisModel } from "./client";
import { CONVERSATION_START } from "./conversation";

export const CallAnalysisSchema = z.object({
  summary: z.string().describe("Resumen de 2 a 4 frases en español para el asesor"),
  outcome: z.enum(callOutcomeEnum.enumValues),
  sentiment: z.enum(sentimentEnum.enumValues),
  lead: z.object({
    name: z.string().nullable(),
    phone: z.string().nullable(),
    email: z.string().nullable(),
    intent: z.enum(leadIntentEnum.enumValues).nullable(),
    propertyType: z.enum(propertyTypeEnum.enumValues).nullable(),
    budgetMin: z.number().nullable(),
    budgetMax: z.number().nullable(),
    zones: z.string().nullable(),
    bedrooms: z.number().nullable(),
    timeline: z.enum(leadTimelineEnum.enumValues),
    financing: z.enum(leadFinancingEnum.enumValues),
  }),
  keyPoints: z.array(z.string()).describe("Hechos clave mencionados por el cliente"),
  followUpActions: z.array(z.string()).describe("Siguientes pasos concretos para el equipo comercial"),
});

export type CallAnalysisResult = z.infer<typeof CallAnalysisSchema>;

const SYSTEM = `Eres un analista comercial de una inmobiliaria. Recibes la transcripción de una conversación entre el agente de IA de la inmobiliaria y un cliente (o posible cliente).
Extrae únicamente información que el cliente haya dicho o confirmado; si un dato no aparece, usa null (o "unknown" en plazo y financiación). No inventes.
- Presupuestos: número entero en la moneda indicada, sin separadores (por ejemplo 450 millones = 450000000).
- outcome: "appointment_booked" si se agendó una cita; "callback_requested" si pidió que lo llamen; "qualified" si se obtuvo intención, zona y presupuesto sin cita; "info_provided" si solo pidió información; "not_interested" si no está interesado; "no_answer" o "voicemail" si no hubo conversación real.
- Escribe el resumen, los puntos clave y las acciones en español.`;

/**
 * Analiza una conversación con Claude y devuelve datos estructurados (resumen, resultado,
 * sentimiento y datos del lead). Devuelve null si no hay contenido suficiente o el modelo declina.
 */
export async function analyzeConversation(input: {
  transcript: string;
  agencyName: string;
  currency: string;
  direction: string;
}): Promise<CallAnalysisResult | null> {
  if (input.transcript.trim().length < 20) return null;

  const response = await anthropic().beta.messages.parse({
    model: analysisModel(),
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: env().AI_ANALYSIS_EFFORT, format: betaZodOutputFormat(CallAnalysisSchema) },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `Inmobiliaria: ${input.agencyName}\nMoneda: ${input.currency}\nTipo de conversación: ${input.direction}\n\n<transcripcion>\n${input.transcript}\n</transcripcion>`,
      },
    ],
  });

  if (response.stop_reason === "refusal") return null;
  return response.parsed_output ?? null;
}

/** Convierte el historial de mensajes de Claude en una transcripción legible. */
export function transcriptFromMessages(messages: Anthropic.Beta.BetaMessageParam[], agentName = "Agente"): string {
  const lines: string[] = [];
  for (const m of messages) {
    const parts = typeof m.content === "string" ? [{ type: "text", text: m.content }] : m.content;
    for (const part of parts) {
      if (part.type !== "text" || !("text" in part)) continue;
      const text = part.text.trim();
      if (!text || text === CONVERSATION_START) continue;
      lines.push(`${m.role === "user" ? "Cliente" : agentName}: ${text}`);
    }
  }
  return lines.join("\n");
}
