"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { appointments, appointmentStatusEnum, appointmentTypeEnum, leads, properties } from "@/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { appointmentTypeLabels } from "@/lib/labels";
import { bookAppointment, SlotUnavailableError } from "@/lib/services/booking";
import { rescoreLead } from "@/lib/services/leads";
import { DATE_KEY_RE } from "@/lib/time";
import { parseForm, zCheckbox, zOptText, type ActionState } from "@/lib/validation";

const optionalUuid = z.preprocess((v) => (v === "" ? undefined : v), z.uuid().optional());

const appointmentSchema = z.object({
  leadId: optionalUuid,
  propertyId: optionalUuid,
  type: z.enum(appointmentTypeEnum.enumValues),
  date: z.string().regex(DATE_KEY_RE, "Fecha inválida"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Hora inválida"),
  title: zOptText(200),
  notes: zOptText(2000),
  allowOutside: zCheckbox(),
});

export async function createAppointmentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { organization: org } = await requireAuth();
  const parsed = parseForm(appointmentSchema, formData);
  if (!parsed.success) return parsed.state;
  const data = parsed.data;

  let leadName: string | null = null;
  if (data.leadId) {
    const [lead] = await db
      .select({ name: leads.name, phone: leads.phone })
      .from(leads)
      .where(and(eq(leads.id, data.leadId), eq(leads.organizationId, org.id)))
      .limit(1);
    if (!lead) return { error: "Lead no encontrado" };
    leadName = lead.name ?? lead.phone;
  }
  let propertyRef: string | null = null;
  if (data.propertyId) {
    const [property] = await db
      .select({ reference: properties.reference })
      .from(properties)
      .where(and(eq(properties.id, data.propertyId), eq(properties.organizationId, org.id)))
      .limit(1);
    if (!property) return { error: "Inmueble no encontrado" };
    propertyRef = property.reference;
  }

  const title =
    data.title ??
    [appointmentTypeLabels[data.type] + (propertyRef ? ` ${propertyRef}` : ""), leadName].filter(Boolean).join(" · ");

  try {
    await bookAppointment({
      org,
      dateKey: data.date,
      time: data.time,
      type: data.type,
      title,
      leadId: data.leadId ?? null,
      propertyId: data.propertyId ?? null,
      notes: data.notes,
      source: "manual",
      enforceAvailability: !data.allowOutside,
    });
  } catch (err) {
    if (err instanceof SlotUnavailableError) {
      return {
        error:
          "Ese horario está ocupado, fuera del horario de atención o no cumple la antelación mínima. Marca «Permitir fuera de disponibilidad» para forzarlo.",
      };
    }
    throw err;
  }

  if (data.leadId) await rescoreLead(data.leadId);
  revalidatePath("/dashboard/citas");
  return { ok: true, message: "Cita agendada" };
}

export async function setAppointmentStatusAction(appointmentId: string, status: string) {
  const { organization: org } = await requireAuth();
  const parsed = z.enum(appointmentStatusEnum.enumValues).safeParse(status);
  if (!parsed.success) return;
  const [updated] = await db
    .update(appointments)
    .set({ status: parsed.data })
    .where(and(eq(appointments.id, appointmentId), eq(appointments.organizationId, org.id)))
    .returning({ leadId: appointments.leadId });
  if (updated?.leadId) await rescoreLead(updated.leadId);
  revalidatePath("/dashboard/citas");
}
