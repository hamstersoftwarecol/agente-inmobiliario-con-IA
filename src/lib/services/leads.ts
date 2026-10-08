import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  appointments,
  leads,
  type Lead,
  type LeadFinancing,
  type LeadIntent,
  type LeadSource,
  type LeadStatus,
  type LeadTimeline,
  type PropertyType,
} from "@/db/schema";
import { normalizePhone } from "@/lib/format";
import { scoreLead } from "@/lib/leads/scoring";

export type LeadPatch = {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  intent?: LeadIntent | null;
  propertyType?: PropertyType | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  zones?: string | null;
  bedrooms?: number | null;
  timeline?: LeadTimeline | null;
  financing?: LeadFinancing | null;
  notes?: string | null;
};

const STATUS_RANK: Record<LeadStatus, number> = {
  new: 0,
  contacted: 1,
  qualified: 2,
  appointment: 3,
  won: 4,
  lost: 4,
};

/** Avanza el estado del lead en el embudo sin retroceder nunca. */
export function advanceStatus(current: LeadStatus, next: LeadStatus): LeadStatus {
  if (current === "won" || current === "lost") return current;
  return STATUS_RANK[next] > STATUS_RANK[current] ? next : current;
}

function clean<T>(value: T | null | undefined): T | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string" && value.trim() === "") return undefined;
  return value;
}

export async function findLeadByPhone(organizationId: string, phone: string | null | undefined) {
  const normalized = normalizePhone(phone);
  if (!normalized) return undefined;
  const [lead] = await db
    .select()
    .from(leads)
    .where(and(eq(leads.organizationId, organizationId), eq(leads.phone, normalized)))
    .limit(1);
  return lead;
}

/**
 * Crea o actualiza un lead con información obtenida en una conversación.
 * Solo sobrescribe campos con valores nuevos no vacíos y recalcula la puntuación.
 */
export async function saveLeadInfo(
  organizationId: string,
  patch: LeadPatch,
  opts: { leadId?: string | null; source: LeadSource; fallbackPhone?: string | null; markContacted?: boolean },
): Promise<Lead> {
  const phone = normalizePhone(clean(patch.phone) ?? opts.fallbackPhone ?? null);

  let existing: Lead | undefined;
  if (opts.leadId) {
    [existing] = await db
      .select()
      .from(leads)
      .where(and(eq(leads.id, opts.leadId), eq(leads.organizationId, organizationId)))
      .limit(1);
  }
  existing ??= await findLeadByPhone(organizationId, phone);

  const values = {
    name: clean(patch.name),
    phone: phone ?? undefined,
    email: clean(patch.email)?.toLowerCase(),
    intent: clean(patch.intent),
    propertyType: clean(patch.propertyType),
    budgetMin: clean(patch.budgetMin),
    budgetMax: clean(patch.budgetMax),
    zones: clean(patch.zones),
    bedrooms: clean(patch.bedrooms),
    timeline: patch.timeline && patch.timeline !== "unknown" ? patch.timeline : undefined,
    financing: patch.financing && patch.financing !== "unknown" ? patch.financing : undefined,
  };
  const definedValues = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== undefined));
  const note = clean(patch.notes);

  if (!existing) {
    const [created] = await db
      .insert(leads)
      .values({
        organizationId,
        source: opts.source,
        status: opts.markContacted ? "contacted" : "new",
        notes: note ?? null,
        lastContactAt: new Date(),
        ...definedValues,
      })
      .returning();
    return rescoreLead(created.id);
  }

  await db
    .update(leads)
    .set({
      ...definedValues,
      notes: note ? [existing.notes, note].filter(Boolean).join("\n") : existing.notes,
      status: opts.markContacted ? advanceStatus(existing.status, "contacted") : existing.status,
      lastContactAt: new Date(),
    })
    .where(eq(leads.id, existing.id));
  return rescoreLead(existing.id);
}

/** Recalcula puntuación, temperatura y estado (calificado) de un lead. */
export async function rescoreLead(leadId: string): Promise<Lead> {
  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
  if (!lead) throw new Error(`Lead ${leadId} no encontrado`);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(appointments)
    .where(and(eq(appointments.leadId, leadId), ne(appointments.status, "cancelled")));

  const { score, temperature } = scoreLead({ ...lead, hasAppointment: count > 0 });
  let status = lead.status;
  if (count > 0) status = advanceStatus(status, "appointment");
  else if (score >= 40 && lead.intent) status = advanceStatus(status, "qualified");

  const [updated] = await db
    .update(leads)
    .set({ score, temperature, status })
    .where(eq(leads.id, leadId))
    .returning();
  return updated;
}

export async function flagFollowUp(leadId: string, reason: string) {
  await db
    .update(leads)
    .set({ needsFollowUp: true, followUpReason: reason.slice(0, 500) })
    .where(eq(leads.id, leadId));
}
