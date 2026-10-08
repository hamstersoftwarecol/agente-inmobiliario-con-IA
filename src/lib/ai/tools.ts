import type Anthropic from "@anthropic-ai/sdk";
import { and, desc, eq, ilike, inArray, or, type SQL, gte, lte } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  calls,
  properties,
  type Agent,
  type AppointmentType,
  type LeadFinancing,
  type LeadIntent,
  type LeadSource,
  type LeadTimeline,
  type Organization,
  type Property,
  type PropertyType,
} from "@/db/schema";
import { computeDaySlots, findNextAvailableDays, spreadSlots } from "@/lib/booking/availability";
import { formatLongDate, formatMoney } from "@/lib/format";
import { appointmentTypeLabels, propertyOperationLabels, propertyStatusLabels, propertyTypeLabels } from "@/lib/labels";
import { bookAppointment, bookingSettings, getBusyForWindow, SlotUnavailableError } from "@/lib/services/booking";
import { flagFollowUp, rescoreLead, saveLeadInfo, type LeadPatch } from "@/lib/services/leads";
import { DATE_KEY_RE, LOCAL_DATETIME_RE, toDateKey, toTimeKey, zonedTimeToUtc } from "@/lib/time";
import type { Channel } from "./prompt";

export type ToolContext = {
  org: Organization;
  agent: Agent;
  channel: Channel;
  direction: "inbound" | "outbound";
  /** ID interno de la llamada/conversación (tabla calls). */
  callId: string | null;
  /** Lead asociado a la conversación; las herramientas lo actualizan al identificar al cliente. */
  leadId: string | null;
  callerPhone: string | null;
  now?: Date;
};

export type ToolEvent = { name: string; input: unknown; result: string; isError: boolean };

// ─── Definiciones (JSON Schema que ve el modelo) ───────────────────────────

const PROPERTY_TYPES_ES = ["apartamento", "casa", "oficina", "local", "lote", "bodega", "otro"] as const;
const INTENTS_ES = ["comprar", "vender", "arrendar", "poner_en_arriendo", "invertir", "otro"] as const;
const TIMELINES_ES = ["inmediato", "1_3_meses", "3_6_meses", "mas_6_meses"] as const;
const FINANCING_ES = ["contado", "credito_preaprobado", "credito_en_tramite", "necesita_financiacion"] as const;
const APPOINTMENT_TYPES_ES = ["visita", "avaluo", "reunion", "llamada"] as const;

export const TOOL_DEFINITIONS: Anthropic.Beta.BetaTool[] = [
  {
    name: "buscar_propiedades",
    description:
      "Busca inmuebles del inventario de la inmobiliaria. Devuelve hasta 5 resultados con referencia, precio, ubicación y características. Úsala antes de hablar de cualquier inmueble.",
    input_schema: {
      type: "object",
      properties: {
        operacion: { type: "string", enum: ["venta", "arriendo"], description: "Venta o arriendo" },
        tipo: { type: "string", enum: [...PROPERTY_TYPES_ES] },
        zona: { type: "string", description: "Ciudad, barrio o sector (texto libre)" },
        precio_min: { type: "number", description: "Precio mínimo en la moneda de la inmobiliaria" },
        precio_max: { type: "number", description: "Precio máximo en la moneda de la inmobiliaria" },
        habitaciones_min: { type: "integer", description: "Número mínimo de habitaciones" },
        texto: { type: "string", description: "Palabras clave: referencia, balcón, piscina, amoblado…" },
      },
    },
  },
  {
    name: "detalle_propiedad",
    description: "Obtiene la ficha completa de un inmueble por su referencia (por ejemplo HZ-101).",
    input_schema: {
      type: "object",
      properties: { referencia: { type: "string" } },
      required: ["referencia"],
    },
  },
  {
    name: "consultar_disponibilidad",
    description:
      "Consulta los horarios libres para citas. Sin fecha devuelve los próximos días con disponibilidad. Incluye la fecha y hora actuales.",
    input_schema: {
      type: "object",
      properties: {
        fecha: { type: "string", description: "Fecha en formato YYYY-MM-DD (opcional)" },
      },
    },
  },
  {
    name: "agendar_cita",
    description:
      "Agenda una cita con un asesor tras confirmar con el cliente. Verifica la disponibilidad y registra al cliente como lead.",
    input_schema: {
      type: "object",
      properties: {
        nombre: { type: "string", description: "Nombre completo del cliente" },
        telefono: { type: "string", description: "Teléfono de contacto del cliente" },
        correo: { type: "string", description: "Correo electrónico (opcional)" },
        fecha_hora: { type: "string", description: "Fecha y hora local en formato 'YYYY-MM-DD HH:mm'" },
        tipo: {
          type: "string",
          enum: [...APPOINTMENT_TYPES_ES],
          description: "visita a un inmueble, avalúo para propietarios, reunión en oficina o llamada con asesor",
        },
        referencia_propiedad: { type: "string", description: "Referencia del inmueble, si aplica" },
        notas: { type: "string", description: "Detalles útiles para el asesor" },
      },
      required: ["nombre", "telefono", "fecha_hora", "tipo"],
    },
  },
  {
    name: "guardar_lead",
    description:
      "Guarda o actualiza los datos del cliente potencial en el CRM. Llámala cada vez que obtengas información nueva relevante.",
    input_schema: {
      type: "object",
      properties: {
        nombre: { type: "string" },
        telefono: { type: "string" },
        correo: { type: "string" },
        intencion: { type: "string", enum: [...INTENTS_ES] },
        tipo_inmueble: { type: "string", enum: [...PROPERTY_TYPES_ES] },
        presupuesto_min: { type: "number" },
        presupuesto_max: { type: "number" },
        zonas: { type: "string", description: "Zonas o barrios de interés" },
        habitaciones: { type: "integer" },
        plazo: { type: "string", enum: [...TIMELINES_ES], description: "Cuándo planea concretar" },
        financiacion: { type: "string", enum: [...FINANCING_ES] },
        notas: { type: "string", description: "Resumen breve de necesidades o detalles importantes" },
      },
    },
  },
  {
    name: "solicitar_llamada_asesor",
    description:
      "Registra que un asesor humano debe devolver la llamada al cliente (pidió hablar con una persona, consulta compleja o prefiere que lo llamen después).",
    input_schema: {
      type: "object",
      properties: {
        motivo: { type: "string" },
        nombre: { type: "string" },
        telefono: { type: "string" },
        horario_preferido: { type: "string" },
      },
      required: ["motivo"],
    },
  },
];

// ─── Validación de entradas ───────────────────────────────────────────────

const optionalText = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((v) => (v ? v : undefined));

const optionalNumber = z
  .union([z.number(), z.string()])
  .optional()
  .transform((v) => {
    if (v === undefined || v === "") return undefined;
    const n = typeof v === "number" ? v : Number(String(v).replace(/[^\d.]/g, ""));
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  });

const schemas = {
  buscar_propiedades: z.object({
    operacion: z.enum(["venta", "arriendo"]).optional(),
    tipo: z.enum(PROPERTY_TYPES_ES).optional(),
    zona: optionalText,
    precio_min: optionalNumber,
    precio_max: optionalNumber,
    habitaciones_min: optionalNumber,
    texto: optionalText,
  }),
  detalle_propiedad: z.object({ referencia: z.string().trim().min(1).max(50) }),
  consultar_disponibilidad: z.object({ fecha: optionalText }),
  agendar_cita: z.object({
    nombre: z.string().trim().min(2).max(120),
    telefono: z.string().trim().min(5).max(40),
    correo: optionalText,
    fecha_hora: z.string().trim(),
    tipo: z.enum(APPOINTMENT_TYPES_ES),
    referencia_propiedad: optionalText,
    notas: optionalText,
  }),
  guardar_lead: z.object({
    nombre: optionalText,
    telefono: optionalText,
    correo: optionalText,
    intencion: z.enum(INTENTS_ES).optional(),
    tipo_inmueble: z.enum(PROPERTY_TYPES_ES).optional(),
    presupuesto_min: optionalNumber,
    presupuesto_max: optionalNumber,
    zonas: optionalText,
    habitaciones: optionalNumber,
    plazo: z.enum(TIMELINES_ES).optional(),
    financiacion: z.enum(FINANCING_ES).optional(),
    notas: optionalText,
  }),
  solicitar_llamada_asesor: z.object({
    motivo: z.string().trim().min(2).max(500),
    nombre: optionalText,
    telefono: optionalText,
    horario_preferido: optionalText,
  }),
} as const;

type ToolName = keyof typeof schemas;

// ─── Mapeos español → valores internos ────────────────────────────────────

const propertyTypeMap: Record<(typeof PROPERTY_TYPES_ES)[number], PropertyType> = {
  apartamento: "apartment",
  casa: "house",
  oficina: "office",
  local: "commercial",
  lote: "lot",
  bodega: "warehouse",
  otro: "other",
};
const intentMap: Record<(typeof INTENTS_ES)[number], LeadIntent> = {
  comprar: "buy",
  vender: "sell",
  arrendar: "rent",
  poner_en_arriendo: "rent_out",
  invertir: "invest",
  otro: "other",
};
const timelineMap: Record<(typeof TIMELINES_ES)[number], LeadTimeline> = {
  inmediato: "immediate",
  "1_3_meses": "1_3_months",
  "3_6_meses": "3_6_months",
  mas_6_meses: "6_plus_months",
};
const financingMap: Record<(typeof FINANCING_ES)[number], LeadFinancing> = {
  contado: "cash",
  credito_preaprobado: "preapproved",
  credito_en_tramite: "in_process",
  necesita_financiacion: "needs_financing",
};
const appointmentTypeMap: Record<(typeof APPOINTMENT_TYPES_ES)[number], AppointmentType> = {
  visita: "visit",
  avaluo: "valuation",
  reunion: "meeting",
  llamada: "call",
};

export function leadSourceFor(channel: Channel, direction: "inbound" | "outbound"): LeadSource {
  if (channel === "simulator") return "simulator";
  if (channel === "web") return "web_call";
  return direction === "outbound" ? "outbound_call" : "inbound_call";
}

/** Escapa comodines de LIKE para que el texto del usuario se busque literalmente. */
function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

function describeProperty(p: Property, currency: string, full = false): string {
  const specs = [
    p.bedrooms != null && `${p.bedrooms} hab.`,
    p.bathrooms != null && `${p.bathrooms} baños`,
    p.areaM2 != null && `${p.areaM2} m²`,
    p.parking != null && `${p.parking} parq.`,
  ]
    .filter(Boolean)
    .join(", ");
  const base = `[${p.reference}] ${p.title} · ${propertyTypeLabels[p.type]} en ${propertyOperationLabels[p.operation].toLowerCase()} · ${formatMoney(p.price, p.currency || currency)}${p.operation === "rent" ? " mensuales" : ""} · ${[p.neighborhood, p.city].filter(Boolean).join(", ")} · ${specs || "sin especificaciones"} · Estado: ${propertyStatusLabels[p.status]}`;
  if (!full) return base;
  return [
    base,
    p.address ? `Dirección: ${p.address}` : null,
    p.description ? `Descripción: ${p.description}` : null,
    p.features.length ? `Características: ${p.features.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

async function linkLead(ctx: ToolContext, leadId: string) {
  if (ctx.leadId === leadId) return;
  ctx.leadId = leadId;
  if (ctx.callId) {
    await db.update(calls).set({ leadId }).where(eq(calls.id, ctx.callId));
  }
}

function nowLine(ctx: ToolContext) {
  const now = ctx.now ?? new Date();
  return `Fecha y hora actual: ${toDateKey(now, ctx.org.timezone)} ${toTimeKey(now, ctx.org.timezone)} (${ctx.org.timezone}).`;
}

// ─── Ejecutores ───────────────────────────────────────────────────────────

const executors: { [K in ToolName]: (input: z.infer<(typeof schemas)[K]>, ctx: ToolContext) => Promise<string> } = {
  async buscar_propiedades(input, ctx) {
    const conditions: SQL[] = [
      eq(properties.organizationId, ctx.org.id),
      inArray(properties.status, ["available", "reserved"]),
    ];
    if (input.operacion) conditions.push(eq(properties.operation, input.operacion === "venta" ? "sale" : "rent"));
    if (input.tipo) conditions.push(eq(properties.type, propertyTypeMap[input.tipo]));
    if (input.precio_min !== undefined) conditions.push(gte(properties.price, input.precio_min));
    if (input.precio_max !== undefined) conditions.push(lte(properties.price, input.precio_max));
    if (input.habitaciones_min !== undefined) conditions.push(gte(properties.bedrooms, input.habitaciones_min));
    if (input.zona) {
      const like = `%${escapeLike(input.zona)}%`;
      conditions.push(or(ilike(properties.city, like), ilike(properties.neighborhood, like), ilike(properties.address, like))!);
    }
    if (input.texto) {
      const like = `%${escapeLike(input.texto)}%`;
      conditions.push(
        or(ilike(properties.title, like), ilike(properties.description, like), ilike(properties.reference, like))!,
      );
    }

    const rows = await db
      .select()
      .from(properties)
      .where(and(...conditions))
      .orderBy(desc(properties.updatedAt))
      .limit(5);

    if (rows.length === 0) {
      return "No hay inmuebles que coincidan con esos criterios. Ofrece ampliar la búsqueda o registrar sus preferencias con guardar_lead para que un asesor le avise cuando haya opciones.";
    }
    return `Inmuebles encontrados (${rows.length}):\n${rows.map((p) => describeProperty(p, ctx.org.currency)).join("\n")}`;
  },

  async detalle_propiedad(input, ctx) {
    const [p] = await db
      .select()
      .from(properties)
      .where(and(eq(properties.organizationId, ctx.org.id), ilike(properties.reference, escapeLike(input.referencia))))
      .limit(1);
    if (!p) return `No existe un inmueble con la referencia ${input.referencia}. Usa buscar_propiedades para encontrarlo.`;
    return describeProperty(p, ctx.org.currency, true);
  },

  async consultar_disponibilidad(input, ctx) {
    const now = ctx.now ?? new Date();
    const settings = bookingSettings(ctx.org);
    const busy = await getBusyForWindow(ctx.org, now);
    const tz = ctx.org.timezone;
    const lines = [nowLine(ctx)];

    const formatDay = (dateKey: string, slots: { time: string }[]) =>
      `${formatLongDate(zonedTimeToUtc(dateKey, "12:00", tz), tz)} (${dateKey}): ${slots.map((s) => `${dateKey} ${s.time}`).join(", ")}`;

    if (input.fecha) {
      if (!DATE_KEY_RE.test(input.fecha)) return "Formato de fecha inválido. Usa YYYY-MM-DD.";
      const slots = computeDaySlots(input.fecha, settings, busy, now);
      if (slots.length > 0) {
        lines.push(`Horarios libres el ${formatDay(input.fecha, spreadSlots(slots, 8))}`);
        return lines.join("\n");
      }
      lines.push(`No hay horarios libres el ${input.fecha}.`);
    }

    const next = findNextAvailableDays(input.fecha ?? toDateKey(now, tz), settings, busy, {
      maxDays: 3,
      maxSlotsPerDay: 5,
      now,
    });
    if (next.length === 0) {
      lines.push("No hay disponibilidad en la ventana de reservas. Ofrece que un asesor lo contacte.");
    } else {
      lines.push("Próximos horarios disponibles:");
      for (const day of next) lines.push(`- ${formatDay(day.dateKey, day.slots)}`);
    }
    lines.push(`Cada cita dura ${ctx.org.appointmentDurationMin} minutos.`);
    return lines.join("\n");
  },

  async agendar_cita(input, ctx) {
    const match = LOCAL_DATETIME_RE.exec(input.fecha_hora);
    if (!match) return "Formato de fecha_hora inválido. Usa 'YYYY-MM-DD HH:mm' tal como lo devuelve consultar_disponibilidad.";
    const [, dateKey, time] = match;

    let propertyId: string | null = null;
    let propertyRef = "";
    if (input.referencia_propiedad) {
      const [p] = await db
        .select({ id: properties.id, reference: properties.reference, address: properties.address })
        .from(properties)
        .where(and(eq(properties.organizationId, ctx.org.id), ilike(properties.reference, escapeLike(input.referencia_propiedad))))
        .limit(1);
      if (p) {
        propertyId = p.id;
        propertyRef = p.reference;
      }
    }

    const lead = await saveLeadInfo(
      ctx.org.id,
      { name: input.nombre, phone: input.telefono, email: input.correo },
      { leadId: ctx.leadId, source: leadSourceFor(ctx.channel, ctx.direction), fallbackPhone: ctx.callerPhone, markContacted: true },
    );
    await linkLead(ctx, lead.id);

    const type = appointmentTypeMap[input.tipo];
    try {
      const appointment = await bookAppointment({
        org: ctx.org,
        dateKey,
        time,
        type,
        title: `${appointmentTypeLabels[type]}${propertyRef ? ` ${propertyRef}` : ""} · ${input.nombre}`,
        leadId: lead.id,
        propertyId,
        callId: ctx.callId,
        notes: input.notas ?? null,
        source: "ai",
      });
      await rescoreLead(lead.id);
      return [
        "Cita agendada correctamente.",
        `Tipo: ${appointmentTypeLabels[type]}${propertyRef ? ` (inmueble ${propertyRef})` : ""}`,
        `Fecha: ${formatLongDate(appointment.startsAt, ctx.org.timezone)} a las ${time} (${ctx.org.appointmentDurationMin} min).`,
        ctx.org.address && type !== "visit" ? `Lugar: ${ctx.org.address}` : null,
        "Confirma los detalles al cliente.",
      ]
        .filter(Boolean)
        .join("\n");
    } catch (err) {
      if (err instanceof SlotUnavailableError) {
        return `Ese horario (${input.fecha_hora}) no está disponible o está fuera del horario de atención. Consulta de nuevo la disponibilidad con consultar_disponibilidad y ofrece otra opción.`;
      }
      throw err;
    }
  },

  async guardar_lead(input, ctx) {
    const patch: LeadPatch = {
      name: input.nombre,
      phone: input.telefono,
      email: input.correo,
      intent: input.intencion ? intentMap[input.intencion] : undefined,
      propertyType: input.tipo_inmueble ? propertyTypeMap[input.tipo_inmueble] : undefined,
      budgetMin: input.presupuesto_min,
      budgetMax: input.presupuesto_max,
      zones: input.zonas,
      bedrooms: input.habitaciones !== undefined ? Math.round(input.habitaciones) : undefined,
      timeline: input.plazo ? timelineMap[input.plazo] : undefined,
      financing: input.financiacion ? financingMap[input.financiacion] : undefined,
      notes: input.notas,
    };
    const lead = await saveLeadInfo(ctx.org.id, patch, {
      leadId: ctx.leadId,
      source: leadSourceFor(ctx.channel, ctx.direction),
      fallbackPhone: ctx.callerPhone,
      markContacted: true,
    });
    await linkLead(ctx, lead.id);
    return `Datos guardados en el CRM. (Dato interno, no lo menciones al cliente: puntuación ${lead.score}/100, temperatura ${lead.temperature}.)`;
  },

  async solicitar_llamada_asesor(input, ctx) {
    const lead = await saveLeadInfo(
      ctx.org.id,
      {
        name: input.nombre,
        phone: input.telefono,
        notes: `Solicita llamada de asesor: ${input.motivo}${input.horario_preferido ? ` (prefiere: ${input.horario_preferido})` : ""}`,
      },
      {
        leadId: ctx.leadId,
        source: leadSourceFor(ctx.channel, ctx.direction),
        fallbackPhone: ctx.callerPhone,
        markContacted: true,
      },
    );
    await linkLead(ctx, lead.id);
    await flagFollowUp(lead.id, input.motivo + (input.horario_preferido ? ` · Horario: ${input.horario_preferido}` : ""));
    if (!lead.phone) {
      return "Solicitud registrada, pero falta un teléfono de contacto: pídeselo al cliente y vuelve a llamar a esta herramienta o a guardar_lead.";
    }
    return "Solicitud registrada. Un asesor humano devolverá la llamada en horario de atención. Infórmaselo al cliente.";
  },
};

/** Ejecuta una herramienta validando su entrada. Nunca lanza: devuelve el error como resultado. */
export async function executeTool(name: string, rawInput: unknown, ctx: ToolContext): Promise<ToolEvent> {
  if (!(name in schemas)) {
    return { name, input: rawInput, result: `Herramienta desconocida: ${name}`, isError: true };
  }
  const toolName = name as ToolName;
  const parsed = schemas[toolName].safeParse(rawInput ?? {});
  if (!parsed.success) {
    const detail = parsed.error.issues.map((i) => `${i.path.join(".") || "entrada"}: ${i.message}`).join("; ");
    return { name, input: rawInput, result: `Entrada inválida (${detail}). Corrige los parámetros.`, isError: true };
  }
  try {
    const run = executors[toolName] as (input: unknown, ctx: ToolContext) => Promise<string>;
    const result = await run(parsed.data, ctx);
    return { name, input: parsed.data, result, isError: false };
  } catch (err) {
    console.error(`[tools] Error en ${name}:`, err);
    return {
      name,
      input: parsed.data,
      result: "Error interno al ejecutar la herramienta. Discúlpate y ofrece que un asesor lo contacte.",
      isError: true,
    };
  }
}
