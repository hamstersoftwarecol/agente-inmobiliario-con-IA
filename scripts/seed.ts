import "dotenv/config";
import { eq } from "drizzle-orm";
import { closeDb, db } from "@/db";
import {
  agents,
  appointments,
  calls,
  leads,
  memberships,
  organizations,
  properties,
  users,
  type NewLead,
} from "@/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { DEFAULT_BUSINESS_HOURS, defaultAgentValues } from "@/lib/defaults";
import { scoreLead } from "@/lib/leads/scoring";
import { addDaysToDateKey, toDateKey, zonedTimeToUtc } from "@/lib/time";

const DEMO_EMAIL = "demo@inmovoz.com";
const DEMO_PASSWORD = "demo12345";
const TZ = "America/Bogota";

async function main() {
  const existing = await db.select().from(users).where(eq(users.email, DEMO_EMAIL)).limit(1);
  if (existing[0]) {
    const orgs = await db
      .select({ id: memberships.organizationId })
      .from(memberships)
      .where(eq(memberships.userId, existing[0].id));
    for (const o of orgs) await db.delete(organizations).where(eq(organizations.id, o.id));
    await db.delete(users).where(eq(users.id, existing[0].id));
    console.log("♻️  Datos demo anteriores eliminados");
  }

  const [user] = await db
    .insert(users)
    .values({ name: "Laura Gómez", email: DEMO_EMAIL, passwordHash: await hashPassword(DEMO_PASSWORD) })
    .returning();

  const agencyName = "Inmobiliaria Horizonte";
  const [org] = await db
    .insert(organizations)
    .values({
      name: agencyName,
      timezone: TZ,
      currency: "COP",
      phone: "+57 601 555 0123",
      address: "Calle 93 #11-27, Oficina 402, Bogotá",
      website: "https://horizonte.example.com",
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      businessHours: DEFAULT_BUSINESS_HOURS,
    })
    .returning();

  await db.insert(memberships).values({ userId: user.id, organizationId: org.id, role: "owner" });

  const [agent] = await db
    .insert(agents)
    .values({
      organizationId: org.id,
      ...defaultAgentValues(agencyName),
      agencyInfo:
        "Inmobiliaria con 12 años de experiencia en Bogotá y Medellín. Vendemos y arrendamos apartamentos, casas y locales. " +
        "Ofrecemos avalúos sin costo para propietarios, acompañamiento en el crédito hipotecario y estudio de arrendamiento en 48 horas. " +
        "Comisión de venta: 3% + IVA. Administración de arriendos: 10% del canon.",
    })
    .returning();

  const props = await db
    .insert(properties)
    .values([
      {
        organizationId: org.id,
        reference: "HZ-101",
        title: "Apartamento moderno con balcón en Chicó",
        operation: "sale",
        type: "apartment",
        price: 890_000_000,
        city: "Bogotá",
        neighborhood: "Chicó Navarra",
        address: "Carrera 15 #100-20",
        bedrooms: 3,
        bathrooms: 2,
        areaM2: 98,
        parking: 2,
        description:
          "Piso 7 con vista exterior, cocina abierta, balcón, estudio y depósito. Edificio con gimnasio, BBQ y portería 24 h. Administración: 780.000.",
        features: ["Balcón", "Gimnasio", "Portería 24h", "Depósito", "Estudio"],
      },
      {
        organizationId: org.id,
        reference: "HZ-102",
        title: "Apartaestudio amoblado cerca a la Javeriana",
        operation: "rent",
        type: "apartment",
        price: 2_300_000,
        city: "Bogotá",
        neighborhood: "Chapinero Alto",
        bedrooms: 1,
        bathrooms: 1,
        areaM2: 38,
        parking: 0,
        description: "Ideal para estudiantes o ejecutivos. Amoblado, servicios incluidos excepto internet. Canon incluye administración.",
        features: ["Amoblado", "Servicios incluidos", "Cerca a TransMilenio"],
      },
      {
        organizationId: org.id,
        reference: "HZ-103",
        title: "Casa campestre en conjunto cerrado en Chía",
        operation: "sale",
        type: "house",
        price: 1_450_000_000,
        city: "Chía",
        neighborhood: "Vereda Fusca",
        bedrooms: 4,
        bathrooms: 4,
        areaM2: 260,
        parking: 3,
        description: "Casa de dos niveles con jardín privado de 300 m², chimenea, estudio y cuarto de servicio. Conjunto con piscina y canchas.",
        features: ["Jardín privado", "Chimenea", "Piscina en conjunto", "Cuarto de servicio"],
      },
      {
        organizationId: org.id,
        reference: "HZ-104",
        title: "Apartamento familiar en El Poblado",
        operation: "sale",
        type: "apartment",
        price: 720_000_000,
        city: "Medellín",
        neighborhood: "El Poblado - Los Balsos",
        bedrooms: 3,
        bathrooms: 3,
        areaM2: 120,
        parking: 2,
        description: "Unidad con piscina, zonas verdes y juegos infantiles. Excelente iluminación natural y vista a la ciudad.",
        features: ["Piscina", "Vista a la ciudad", "Zonas verdes", "Parque infantil"],
      },
      {
        organizationId: org.id,
        reference: "HZ-105",
        title: "Local comercial esquinero en Cedritos",
        operation: "rent",
        type: "commercial",
        price: 6_800_000,
        city: "Bogotá",
        neighborhood: "Cedritos",
        bathrooms: 1,
        areaM2: 75,
        description: "Local con alto tráfico peatonal, doble vitrina y mezanine. Uso de suelo comercial aprobado.",
        features: ["Esquinero", "Doble vitrina", "Mezanine"],
      },
      {
        organizationId: org.id,
        reference: "HZ-106",
        title: "Apartamento para inversión en Salitre",
        operation: "sale",
        type: "apartment",
        price: 465_000_000,
        city: "Bogotá",
        neighborhood: "Ciudad Salitre",
        bedrooms: 2,
        bathrooms: 2,
        areaM2: 64,
        parking: 1,
        description: "Actualmente arrendado en 2.600.000. Cerca al aeropuerto y centros empresariales. Rentabilidad cercana al 6,7% anual.",
        features: ["Arrendado", "Cerca al aeropuerto", "Rentabilidad"],
      },
      {
        organizationId: org.id,
        reference: "HZ-107",
        title: "Oficina con terraza en Usaquén",
        operation: "rent",
        type: "office",
        price: 9_500_000,
        city: "Bogotá",
        neighborhood: "Santa Bárbara",
        bathrooms: 2,
        areaM2: 140,
        parking: 3,
        description: "Oficina abierta con terraza privada, 2 salas de juntas y cocineta. Edificio con planta eléctrica.",
        features: ["Terraza", "Salas de juntas", "Planta eléctrica"],
      },
      {
        organizationId: org.id,
        reference: "HZ-108",
        title: "Casa en Laureles para remodelar",
        operation: "sale",
        type: "house",
        price: 980_000_000,
        status: "reserved",
        city: "Medellín",
        neighborhood: "Laureles",
        bedrooms: 5,
        bathrooms: 3,
        areaM2: 210,
        parking: 1,
        description: "Lote amplio, ideal para remodelación o proyecto multifamiliar. Calle tranquila y arborizada.",
        features: ["Para remodelar", "Lote amplio"],
      },
    ])
    .returning();

  const leadSeeds: NewLead[] = [
    {
      organizationId: org.id,
      name: "Carlos Rodríguez",
      phone: "+573001234567",
      email: "carlos.rodriguez@example.com",
      source: "inbound_call",
      intent: "buy",
      propertyType: "apartment",
      budgetMin: 700_000_000,
      budgetMax: 950_000_000,
      zones: "Chicó, Rosales",
      bedrooms: 3,
      timeline: "1_3_months",
      financing: "preapproved",
      notes: "Busca apartamento con balcón para su familia. Tiene crédito preaprobado con Bancolombia.",
    },
    {
      organizationId: org.id,
      name: "María Fernanda López",
      phone: "+573109876543",
      source: "inbound_call",
      intent: "sell",
      propertyType: "house",
      zones: "Chía",
      timeline: "3_6_months",
      notes: "Quiere vender su casa en Chía para mudarse a Medellín. Pidió avalúo.",
    },
    {
      organizationId: org.id,
      name: "Andrés Ospina",
      phone: "+573155550101",
      email: "andres.ospina@example.com",
      source: "web_call",
      intent: "invest",
      budgetMax: 500_000_000,
      zones: "Salitre, Modelia",
      timeline: "immediate",
      financing: "cash",
      notes: "Inversionista, busca apartamento arrendado con buena rentabilidad.",
    },
    {
      organizationId: org.id,
      name: "Juliana Martínez",
      phone: "+573204440022",
      source: "inbound_call",
      intent: "rent",
      propertyType: "apartment",
      budgetMax: 2_500_000,
      zones: "Chapinero",
      bedrooms: 1,
      timeline: "immediate",
      notes: "Estudiante de posgrado, necesita mudarse el próximo mes.",
    },
    {
      organizationId: org.id,
      name: "Roberto Sánchez",
      phone: "+573013332211",
      source: "outbound_call",
      intent: "buy",
      zones: "El Poblado",
      timeline: "6_plus_months",
      financing: "needs_financing",
    },
    {
      organizationId: org.id,
      name: "Diana Castillo",
      phone: "+573187776655",
      source: "manual",
      intent: "rent_out",
      propertyType: "apartment",
      zones: "Usaquén",
      notes: "Propietaria de un apartamento en Usaquén, interesada en administración de arriendo.",
    },
  ];

  const createdLeads = [];
  for (const seed of leadSeeds) {
    const { score, temperature } = scoreLead(seed);
    const [lead] = await db
      .insert(leads)
      .values({
        ...seed,
        score,
        temperature,
        status: score >= 40 ? "qualified" : "contacted",
        lastContactAt: new Date(Date.now() - Math.random() * 5 * 24 * 3600 * 1000),
      })
      .returning();
    createdLeads.push(lead);
  }

  // Llamadas de ejemplo de los últimos días.
  const now = Date.now();
  const callSeeds = [
    {
      lead: 0,
      direction: "inbound" as const,
      daysAgo: 0,
      duration: 312,
      outcome: "appointment_booked" as const,
      sentiment: "positive" as const,
      summary:
        "Carlos llamó interesado en el apartamento HZ-101 en Chicó. Confirmó presupuesto de hasta 950 millones con crédito preaprobado. Se agendó visita para el inmueble.",
      transcript:
        "Agente: ¡Hola! Gracias por llamar a Inmobiliaria Horizonte, te habla Sofía. ¿En qué te puedo ayudar?\nCliente: Hola, vi el apartamento de Chicó con balcón, ¿sigue disponible?\nAgente: Sí, el HZ-101 sigue disponible: 98 metros, 3 habitaciones, 2 baños y 2 parqueaderos, en 890 millones. ¿Te gustaría visitarlo?\nCliente: Sí, me interesa. Tengo crédito preaprobado.\nAgente: Perfecto. Tengo disponibilidad el jueves a las 10 de la mañana o a las 3 de la tarde. ¿Cuál prefieres?\nCliente: El jueves a las 10.\nAgente: Listo, quedó agendada tu visita. ¡Hasta luego!",
    },
    {
      lead: 1,
      direction: "inbound" as const,
      daysAgo: 1,
      duration: 245,
      outcome: "appointment_booked" as const,
      sentiment: "positive" as const,
      summary: "María Fernanda quiere vender su casa en Chía en los próximos meses. Se agendó una cita de avalúo sin costo.",
      transcript:
        "Agente: Hola, te habla Sofía de Inmobiliaria Horizonte. ¿En qué te ayudo?\nCliente: Quiero vender mi casa en Chía.\nAgente: Con gusto. Un asesor puede hacer un avalúo profesional sin costo. ¿Agendamos una visita?\nCliente: Sí, por favor.",
    },
    {
      lead: 2,
      direction: "web" as const,
      daysAgo: 2,
      duration: 198,
      outcome: "qualified" as const,
      sentiment: "positive" as const,
      summary: "Andrés busca inversión de hasta 500 millones de contado. Se le presentó el HZ-106 arrendado en Salitre.",
      transcript:
        "Agente: Hola, soy Sofía. ¿Qué tipo de inmueble buscas?\nCliente: Algo para invertir, que ya esté arrendado.\nAgente: Tengo el HZ-106 en Ciudad Salitre, arrendado en 2,6 millones, por 465 millones.",
    },
    {
      lead: 3,
      direction: "inbound" as const,
      daysAgo: 3,
      duration: 156,
      outcome: "info_provided" as const,
      sentiment: "neutral" as const,
      summary: "Juliana busca apartaestudio en Chapinero por menos de 2,5 millones. Se le compartió el HZ-102.",
      transcript: "Agente: Hola, soy Sofía.\nCliente: Busco apartaestudio en Chapinero.\nAgente: Tengo el HZ-102 amoblado en 2,3 millones.",
    },
    {
      lead: 4,
      direction: "outbound" as const,
      daysAgo: 4,
      duration: 64,
      outcome: "callback_requested" as const,
      sentiment: "neutral" as const,
      summary: "Roberto pidió que lo llamen la próxima semana; aún no tiene definida la financiación.",
      transcript: "Agente: Hola Roberto, te llamo de Inmobiliaria Horizonte.\nCliente: Ahora no puedo, llámenme la otra semana.",
    },
    {
      lead: null,
      direction: "inbound" as const,
      daysAgo: 5,
      duration: 0,
      outcome: "no_answer" as const,
      sentiment: "neutral" as const,
      summary: "El cliente colgó antes de hablar.",
      transcript: "",
    },
  ];

  const createdCalls = [];
  for (const [i, c] of callSeeds.entries()) {
    const startedAt = new Date(now - c.daysAgo * 24 * 3600 * 1000 - (i + 1) * 3600 * 1000);
    const lead = c.lead === null ? null : createdLeads[c.lead];
    const [call] = await db
      .insert(calls)
      .values({
        organizationId: org.id,
        agentId: agent.id,
        leadId: lead?.id ?? null,
        direction: c.direction,
        status: "ended",
        fromNumber: c.direction === "outbound" ? "+576015550123" : (lead?.phone ?? "+573000000000"),
        toNumber: c.direction === "outbound" ? (lead?.phone ?? null) : "+576015550123",
        startedAt,
        endedAt: new Date(startedAt.getTime() + c.duration * 1000),
        durationSec: c.duration,
        endedReason: c.duration === 0 ? "customer-ended-call" : "assistant-ended-call",
        transcript: c.transcript,
        summary: c.summary,
        outcome: c.outcome,
        sentiment: c.sentiment,
        analysis: { keyPoints: [], followUpActions: [] },
        analyzedAt: new Date(),
        createdAt: startedAt,
      })
      .returning();
    createdCalls.push(call);
  }

  // Citas próximas.
  const today = toDateKey(new Date(), TZ);
  await db.insert(appointments).values([
    {
      organizationId: org.id,
      leadId: createdLeads[0].id,
      propertyId: props[0].id,
      callId: createdCalls[0].id,
      type: "visit",
      status: "confirmed",
      title: "Visita HZ-101 · Carlos Rodríguez",
      startsAt: zonedTimeToUtc(addDaysToDateKey(today, 1), "10:00", TZ),
      endsAt: zonedTimeToUtc(addDaysToDateKey(today, 1), "11:00", TZ),
      source: "ai",
    },
    {
      organizationId: org.id,
      leadId: createdLeads[1].id,
      callId: createdCalls[1].id,
      type: "valuation",
      status: "scheduled",
      title: "Avalúo casa en Chía · María Fernanda López",
      startsAt: zonedTimeToUtc(addDaysToDateKey(today, 2), "15:00", TZ),
      endsAt: zonedTimeToUtc(addDaysToDateKey(today, 2), "16:00", TZ),
      source: "ai",
    },
    {
      organizationId: org.id,
      leadId: createdLeads[2].id,
      propertyId: props[5].id,
      type: "meeting",
      status: "scheduled",
      title: "Reunión de inversión · Andrés Ospina",
      startsAt: zonedTimeToUtc(addDaysToDateKey(today, 3), "11:00", TZ),
      endsAt: zonedTimeToUtc(addDaysToDateKey(today, 3), "12:00", TZ),
      source: "manual",
    },
  ]);

  // Los leads con cita pasan a "cita agendada" con su puntuación recalculada.
  for (const idx of [0, 1, 2]) {
    const lead = createdLeads[idx];
    const { score, temperature } = scoreLead({ ...lead, hasAppointment: true });
    await db.update(leads).set({ status: "appointment", score, temperature }).where(eq(leads.id, lead.id));
  }

  console.log("✅ Datos demo creados");
  console.log(`   Usuario: ${DEMO_EMAIL}`);
  console.log(`   Contraseña: ${DEMO_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error("❌ Error en el seed:", err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
