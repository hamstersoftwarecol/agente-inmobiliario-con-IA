import "dotenv/config";
import type Anthropic from "@anthropic-ai/sdk";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Prueba de integración del agente contra PostgreSQL real con Claude simulado:
 * verifica el bucle de herramientas, la búsqueda de inventario, la agenda y el CRM.
 * Se omite si no hay DATABASE_URL (p. ej. en CI sin base de datos).
 */

type Scripted = Pick<Anthropic.Beta.BetaMessage, "content" | "stop_reason">;
const script: Scripted[] = [];
const requests: Anthropic.Beta.MessageCreateParams[] = [];

vi.mock("./client", () => ({
  AI_BETAS: [],
  chatModel: () => "test-model",
  voiceModel: () => "test-model",
  analysisModel: () => "test-model",
  anthropic: () => ({
    beta: {
      messages: {
        stream: (params: Anthropic.Beta.MessageCreateParams) => {
          // Copia profunda: el agente sigue agregando mensajes al mismo arreglo.
          requests.push(structuredClone(params));
          const next = script.shift();
          if (!next) throw new Error("Sin respuesta preparada");
          const listeners: ((delta: string) => void)[] = [];
          return {
            on: (_event: "text", cb: (delta: string) => void) => listeners.push(cb),
            finalMessage: async () => {
              for (const block of next.content) if (block.type === "text") listeners.forEach((cb) => cb(block.text));
              return { ...next, id: "msg_test", role: "assistant", model: "test-model" };
            },
          };
        },
      },
    },
  }),
}));

const hasDb = !!process.env.DATABASE_URL;

describe.skipIf(!hasDb)("runAgentTurn (integración)", async () => {
  const { db, closeDb } = await import("@/db");
  const schema = await import("@/db/schema");
  const { DEFAULT_BUSINESS_HOURS, defaultAgentValues } = await import("@/lib/defaults");
  const { runAgentTurn } = await import("./agent");
  const { findNextAvailableDays } = await import("@/lib/booking/availability");
  const { bookingSettings } = await import("@/lib/services/booking");
  const { toDateKey } = await import("@/lib/time");

  let org: typeof schema.organizations.$inferSelect;
  let agent: typeof schema.agents.$inferSelect;
  let call: typeof schema.calls.$inferSelect;

  beforeAll(async () => {
    [org] = await db
      .insert(schema.organizations)
      .values({ name: "Org de prueba", businessHours: DEFAULT_BUSINESS_HOURS, trialEndsAt: new Date(Date.now() + 864e5) })
      .returning();
    [agent] = await db
      .insert(schema.agents)
      .values({ organizationId: org.id, ...defaultAgentValues(org.name) })
      .returning();
    await db.insert(schema.properties).values({
      organizationId: org.id,
      reference: "TST-1",
      title: "Apartamento de prueba en Chicó",
      operation: "sale",
      type: "apartment",
      price: 800_000_000,
      city: "Bogotá",
      neighborhood: "Chicó",
      bedrooms: 3,
    });
    [call] = await db
      .insert(schema.calls)
      .values({ organizationId: org.id, agentId: agent.id, direction: "simulator", status: "in_progress" })
      .returning();
  });

  afterAll(async () => {
    if (org) await db.delete(schema.organizations).where(eq(schema.organizations.id, org.id));
    await closeDb();
  });

  it("busca inventario, consulta agenda, agenda la cita y crea el lead", async () => {
    const [firstDay] = findNextAvailableDays(toDateKey(new Date(), org.timezone), bookingSettings(org), []);
    const slot = `${firstDay.dateKey} ${firstDay.slots[0].time}`;

    script.push(
      {
        stop_reason: "tool_use",
        content: [
          { type: "tool_use", id: "t1", name: "buscar_propiedades", input: { zona: "Chicó", habitaciones_min: 3 } },
          { type: "tool_use", id: "t2", name: "consultar_disponibilidad", input: {} },
        ] as Anthropic.Beta.BetaContentBlock[],
      },
      {
        stop_reason: "tool_use",
        content: [
          {
            type: "tool_use",
            id: "t3",
            name: "agendar_cita",
            input: { nombre: "Laura Pérez", telefono: "+57 300 555 1234", fecha_hora: slot, tipo: "visita", referencia_propiedad: "tst-1" },
          },
        ] as Anthropic.Beta.BetaContentBlock[],
      },
      {
        stop_reason: "end_turn",
        content: [{ type: "text", text: "¡Listo, Laura! Tu visita quedó agendada.", citations: null }] as Anthropic.Beta.BetaContentBlock[],
      },
    );

    const ctx = {
      org,
      agent,
      channel: "simulator" as const,
      direction: "inbound" as const,
      callId: call.id,
      leadId: null as string | null,
      callerPhone: null,
    };
    const result = await runAgentTurn({
      ctx,
      system: "prompt de prueba",
      messages: [{ role: "user", content: "Quiero visitar un apartamento en Chicó" }],
      model: "test-model",
      effort: "low",
    });

    expect(result.text).toBe("¡Listo, Laura! Tu visita quedó agendada.");
    expect(result.toolEvents.map((e) => [e.name, e.isError])).toEqual([
      ["buscar_propiedades", false],
      ["consultar_disponibilidad", false],
      ["agendar_cita", false],
    ]);
    expect(result.toolEvents[0].result).toContain("TST-1");
    expect(result.toolEvents[1].result).toContain(firstDay.dateKey);

    // Los resultados de herramientas paralelas van juntos en un solo mensaje de usuario.
    const secondRequest = requests[1];
    const toolResultMessage = secondRequest.messages.at(-1)!;
    expect(toolResultMessage.role).toBe("user");
    expect(Array.isArray(toolResultMessage.content) && toolResultMessage.content.length).toBe(2);
    // El prompt de sistema se cachea.
    expect(requests[0].system).toEqual([{ type: "text", text: "prompt de prueba", cache_control: { type: "ephemeral" } }]);

    const [lead] = await db.select().from(schema.leads).where(eq(schema.leads.organizationId, org.id));
    expect(lead).toMatchObject({ name: "Laura Pérez", phone: "+573005551234", status: "appointment", source: "simulator" });
    expect(lead.score).toBeGreaterThan(0);
    expect(ctx.leadId).toBe(lead.id);

    const [appointment] = await db.select().from(schema.appointments).where(eq(schema.appointments.organizationId, org.id));
    expect(appointment).toMatchObject({ leadId: lead.id, callId: call.id, type: "visit", source: "ai" });

    const [updatedCall] = await db.select().from(schema.calls).where(eq(schema.calls.id, call.id));
    expect(updatedCall.leadId).toBe(lead.id);
  });

  it("rechaza agendar en un horario ocupado", async () => {
    const [firstDay] = findNextAvailableDays(toDateKey(new Date(), org.timezone), bookingSettings(org), []);
    script.push(
      {
        stop_reason: "tool_use",
        content: [
          {
            type: "tool_use",
            id: "t4",
            name: "agendar_cita",
            input: { nombre: "Otro Cliente", telefono: "3001234567", fecha_hora: `${firstDay.dateKey} ${firstDay.slots[0].time}`, tipo: "visita" },
          },
        ] as Anthropic.Beta.BetaContentBlock[],
      },
      {
        stop_reason: "end_turn",
        content: [{ type: "text", text: "Ese horario ya no está libre.", citations: null }] as Anthropic.Beta.BetaContentBlock[],
      },
    );
    const result = await runAgentTurn({
      ctx: { org, agent, channel: "phone", direction: "inbound", callId: null, leadId: null, callerPhone: null },
      system: "prompt",
      messages: [{ role: "user", content: "Agéndame" }],
      model: "test-model",
      effort: "low",
    });
    expect(result.toolEvents[0].result).toContain("no está disponible");
  });

  it("sustituye una respuesta declinada por una respuesta segura", async () => {
    script.push({ stop_reason: "refusal", content: [] });
    const result = await runAgentTurn({
      ctx: { org, agent, channel: "phone", direction: "inbound", callId: null, leadId: null, callerPhone: null },
      system: "prompt",
      messages: [{ role: "user", content: "…" }],
      model: "test-model",
      effort: "low",
    });
    expect(result.text).toContain("no te puedo ayudar");
    expect(result.appended).toEqual([{ role: "assistant", content: expect.stringContaining("no te puedo ayudar") }]);
  });
});
