import { createHmac, timingSafeEqual } from "node:crypto";
import type { CreateAssistantDTO } from "@vapi-ai/web/dist/api";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { calls, type Agent, type Call, type CallDirection, type Lead, type Organization } from "@/db/schema";
import { buildSystemPrompt } from "@/lib/ai/prompt";
import { voiceModel } from "@/lib/ai/client";
import { env } from "@/lib/env";
import { normalizePhone } from "@/lib/format";

const VAPI_API = "https://api.vapi.ai";

// ─── Firmas de URL ────────────────────────────────────────────────────────

function secret(): string {
  const s = env().VAPI_WEBHOOK_SECRET;
  if (!s) throw new Error("VAPI_WEBHOOK_SECRET no está configurado");
  return s;
}

export function signToken(purpose: string): string {
  return createHmac("sha256", secret()).update(purpose).digest("base64url").slice(0, 32);
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function verifyToken(purpose: string, token: string | null | undefined): boolean {
  if (!token || !env().VAPI_WEBHOOK_SECRET) return false;
  return safeEqual(signToken(purpose), token);
}

/** URL base del LLM personalizado (Vapi le agrega /chat/completions). Firmada por agente. */
export function customLlmUrl(agentId: string) {
  return `${env().APP_URL}/api/voice/llm/${agentId}/${signToken(`llm:${agentId}`)}`;
}

/** URL de eventos del servidor para un agente concreto (firmada). */
export function agentWebhookUrl(agentId: string) {
  return `${env().APP_URL}/api/voice/webhook?agentId=${agentId}&token=${signToken(`webhook:${agentId}`)}`;
}

/** URL de webhook para los números de teléfono (se autentica con la cabecera x-vapi-secret). */
export function phoneWebhookUrl() {
  return `${env().APP_URL}/api/voice/webhook`;
}

export type WebhookAuth = { scope: "global" } | { scope: "agent"; agentId: string };

/**
 * Autoriza una petición de Vapi:
 * - Con la cabecera x-vapi-secret (configurada por el operador en los números de teléfono): acceso global.
 * - Con el token firmado en la URL del asistente: solo eventos de ese agente.
 */
export function authorizeWebhook(request: Request): WebhookAuth | null {
  const header = request.headers.get("x-vapi-secret");
  const configured = env().VAPI_WEBHOOK_SECRET;
  if (header && configured && safeEqual(header, configured)) return { scope: "global" };

  const url = new URL(request.url);
  const agentId = url.searchParams.get("agentId");
  if (agentId && verifyToken(`webhook:${agentId}`, url.searchParams.get("token"))) {
    return { scope: "agent", agentId };
  }
  return null;
}

// ─── Configuración del asistente (transitoria) ────────────────────────────

/** Asistente transitorio de Vapi, tipado con el DTO oficial del SDK de Vapi. */
export type VapiAssistant = CreateAssistantDTO;

/**
 * Construye el asistente de voz para Vapi. Vapi se encarga de telefonía, voz a texto y texto a voz;
 * el "cerebro" (Claude + herramientas) es el endpoint de LLM personalizado de esta app.
 */
export function buildAssistant(
  agent: Agent,
  org: Organization,
  opts: { firstMessage?: string; metadata?: Record<string, string> } = {},
): VapiAssistant {
  const english = agent.language === "en";
  return {
    name: agent.name.slice(0, 40),
    firstMessage: opts.firstMessage ?? agent.greeting,
    firstMessageMode: "assistant-speaks-first",
    model: {
      provider: "custom-llm",
      url: customLlmUrl(agent.id),
      model: voiceModel(),
      messages: [
        { role: "system", content: "Las instrucciones de este agente las gestiona el servidor de InmoVoz." },
      ],
    },
    voice: { provider: agent.voiceProvider, voiceId: agent.voiceId } as CreateAssistantDTO["voice"],
    transcriber: { provider: "deepgram", model: "nova-2", language: english ? "en" : "es" },
    server: { url: agentWebhookUrl(agent.id) },
    // La API espera un arreglo; el tipo generado del SDK lo declara como unión simple.
    serverMessages: ["status-update", "end-of-call-report"] as unknown as CreateAssistantDTO["serverMessages"],
    endCallPhrases: english ? ["goodbye", "have a great day"] : ["hasta luego", "que tengas un buen día"],
    maxDurationSeconds: Math.max(60, agent.maxCallDurationMin * 60),
    metadata: { organizationId: org.id, agentId: agent.id, ...opts.metadata },
  };
}

// ─── API de Vapi ──────────────────────────────────────────────────────────

export class VapiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function vapiFetch<T>(path: string, init: RequestInit): Promise<T> {
  const key = env().VAPI_API_KEY;
  if (!key) throw new VapiError("VAPI_API_KEY no está configurada", 500);
  const res = await fetch(`${VAPI_API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...init.headers },
    signal: AbortSignal.timeout(15_000),
  });
  const body = await res.text();
  if (!res.ok) {
    let message = body;
    try {
      const json = JSON.parse(body);
      message = Array.isArray(json.message) ? json.message.join("; ") : (json.message ?? json.error ?? body);
    } catch {
      // cuerpo no JSON
    }
    throw new VapiError(`Vapi ${res.status}: ${String(message).slice(0, 300)}`, res.status);
  }
  return JSON.parse(body) as T;
}

/** Inicia una llamada saliente a un lead y registra la llamada en la base de datos. */
export async function startOutboundCall(input: {
  agent: Agent;
  org: Organization;
  lead: Lead;
  purpose: string;
}): Promise<Call> {
  const { agent, org, lead, purpose } = input;
  if (!agent.vapiPhoneNumberId) throw new VapiError("El agente no tiene un número de teléfono de Vapi asignado.", 400);
  const number = normalizePhone(lead.phone);
  if (!number || !number.startsWith("+")) {
    throw new VapiError("El lead necesita un teléfono en formato internacional (ej. +573001234567).", 400);
  }

  const firstName = lead.name?.split(" ")[0];
  const firstMessage =
    agent.language === "en"
      ? `Hi${firstName ? ` ${firstName}` : ""}, this is ${agent.name} from ${org.name}. Do you have a minute?`
      : `Hola${firstName ? ` ${firstName}` : ""}, te habla ${agent.name} de ${org.name}. ¿Tienes un minuto?`;

  // Registramos la llamada antes de marcar para congelar el prompt con el contexto del lead.
  const [call] = await db
    .insert(calls)
    .values({
      organizationId: org.id,
      agentId: agent.id,
      leadId: lead.id,
      direction: "outbound",
      status: "queued",
      fromNumber: agent.phoneNumber,
      toNumber: number,
      purpose,
      systemPrompt: buildSystemPrompt({ org, agent, channel: "phone", direction: "outbound", lead, purpose }),
    })
    .returning();

  try {
    const created = await vapiFetch<{ id: string; status?: string }>("/call", {
      method: "POST",
      body: JSON.stringify({
        phoneNumberId: agent.vapiPhoneNumberId,
        customer: { number, ...(lead.name ? { name: lead.name.slice(0, 40) } : {}) },
        assistant: buildAssistant(agent, org, { firstMessage, metadata: { callRecordId: call.id } }),
      }),
    });
    const [updated] = await db
      .update(calls)
      .set({ providerCallId: created.id })
      .where(eq(calls.id, call.id))
      .returning();
    return updated;
  } catch (err) {
    await db
      .update(calls)
      .set({ status: "failed", endedReason: err instanceof Error ? err.message.slice(0, 300) : "error" })
      .where(eq(calls.id, call.id));
    throw err;
  }
}

// ─── Registro de llamadas a partir de eventos de Vapi ─────────────────────

export type VapiCall = {
  id?: string;
  type?: string;
  phoneNumberId?: string;
  customer?: { number?: string; name?: string };
  phoneNumber?: { number?: string };
  assistant?: { metadata?: Record<string, string> };
  metadata?: Record<string, string>;
  startedAt?: string;
  endedAt?: string;
  cost?: number;
};

export function directionFromCallType(type: string | undefined): CallDirection {
  if (type === "outboundPhoneCall") return "outbound";
  if (type === "webCall") return "web";
  return "inbound";
}

/**
 * Obtiene (o crea) el registro de la llamada correspondiente a un ID de Vapi.
 * Si es nueva, congela el prompt de sistema para que sea estable durante toda la llamada.
 */
export async function ensureCallRecord(input: {
  vapiCall: VapiCall;
  agent: Agent;
  org: Organization;
  phoneNumber?: string | null;
}): Promise<Call | undefined> {
  const { vapiCall, agent, org } = input;
  if (!vapiCall.id) return undefined;

  const [existing] = await db
    .select()
    .from(calls)
    .where(and(eq(calls.providerCallId, vapiCall.id), eq(calls.organizationId, org.id)))
    .limit(1);
  if (existing) return existing;

  // Llamadas salientes creadas por nosotros: el registro ya existe y se identifica por metadata.
  const recordId = vapiCall.assistant?.metadata?.callRecordId ?? vapiCall.metadata?.callRecordId;
  if (recordId && /^[0-9a-f-]{36}$/i.test(recordId)) {
    const [linked] = await db
      .update(calls)
      .set({ providerCallId: vapiCall.id })
      .where(and(eq(calls.id, recordId), eq(calls.organizationId, org.id)))
      .returning();
    if (linked) return linked;
  }

  const direction = directionFromCallType(vapiCall.type);
  const customer = normalizePhone(vapiCall.customer?.number);
  const ownNumber = input.phoneNumber ?? vapiCall.phoneNumber?.number ?? agent.phoneNumber;

  const [created] = await db
    .insert(calls)
    .values({
      organizationId: org.id,
      agentId: agent.id,
      providerCallId: vapiCall.id,
      direction,
      status: "in_progress",
      fromNumber: direction === "outbound" ? ownNumber : customer,
      toNumber: direction === "outbound" ? customer : ownNumber,
      startedAt: new Date(),
      systemPrompt: buildSystemPrompt({
        org,
        agent,
        channel: direction === "web" ? "web" : "phone",
        direction: direction === "outbound" ? "outbound" : "inbound",
      }),
    })
    .onConflictDoNothing({ target: calls.providerCallId })
    .returning();

  if (created) return created;
  // Otra petición concurrente la creó primero.
  const [again] = await db
    .select()
    .from(calls)
    .where(and(eq(calls.providerCallId, vapiCall.id), eq(calls.organizationId, org.id)))
    .limit(1);
  return again;
}
