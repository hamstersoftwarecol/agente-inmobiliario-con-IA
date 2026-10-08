"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import {
  leadFinancingEnum,
  leadIntentEnum,
  leads,
  leadStatusEnum,
  leadTimelineEnum,
  propertyTypeEnum,
} from "@/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { normalizePhone } from "@/lib/format";
import { rescoreLead } from "@/lib/services/leads";
import { parseForm, zOptEnum, zOptInt, zOptMoney, zOptText, type ActionState } from "@/lib/validation";

const leadSchema = z
  .object({
    name: zOptText(120),
    phone: zOptText(40),
    email: zOptText(200).refine((v) => !v || z.email().safeParse(v).success, "Correo inválido"),
    intent: zOptEnum(leadIntentEnum.enumValues),
    propertyType: zOptEnum(propertyTypeEnum.enumValues),
    budgetMin: zOptMoney(),
    budgetMax: zOptMoney(),
    zones: zOptText(300),
    bedrooms: zOptInt(0, 50),
    timeline: z.enum(leadTimelineEnum.enumValues).default("unknown"),
    financing: z.enum(leadFinancingEnum.enumValues).default("unknown"),
    status: z.enum(leadStatusEnum.enumValues).default("new"),
    notes: zOptText(5000),
  })
  .refine((v) => v.name || v.phone || v.email, { message: "Indica al menos nombre, teléfono o correo", path: ["name"] });

function toValues(data: z.infer<typeof leadSchema>) {
  return { ...data, phone: normalizePhone(data.phone), email: data.email?.toLowerCase() ?? null };
}

export async function createLeadAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { organization: org } = await requireAuth();
  const parsed = parseForm(leadSchema, formData);
  if (!parsed.success) return parsed.state;

  const [lead] = await db
    .insert(leads)
    .values({ ...toValues(parsed.data), organizationId: org.id, source: "manual" })
    .returning({ id: leads.id });
  await rescoreLead(lead.id);
  revalidatePath("/dashboard/leads");
  redirect(`/dashboard/leads/${lead.id}`);
}

export async function updateLeadAction(leadId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { organization: org } = await requireAuth();
  const parsed = parseForm(leadSchema, formData);
  if (!parsed.success) return parsed.state;

  const updated = await db
    .update(leads)
    .set(toValues(parsed.data))
    .where(and(eq(leads.id, leadId), eq(leads.organizationId, org.id)))
    .returning({ id: leads.id });
  if (updated.length === 0) return { error: "Lead no encontrado" };
  await rescoreLead(leadId);
  revalidatePath(`/dashboard/leads/${leadId}`);
  return { ok: true, message: "Lead actualizado" };
}

export async function resolveFollowUpAction(leadId: string) {
  const { organization: org } = await requireAuth();
  await db
    .update(leads)
    .set({ needsFollowUp: false, followUpReason: null })
    .where(and(eq(leads.id, leadId), eq(leads.organizationId, org.id)));
  revalidatePath(`/dashboard/leads/${leadId}`);
}

export async function deleteLeadAction(leadId: string) {
  const { organization: org } = await requireAuth();
  await db.delete(leads).where(and(eq(leads.id, leadId), eq(leads.organizationId, org.id)));
  revalidatePath("/dashboard/leads");
  redirect("/dashboard/leads");
}
