"use server";

import { and, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { isUniqueViolation } from "@/db/errors";
import { agents } from "@/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { agentTemplates } from "@/lib/defaults";
import { getEntitlements } from "@/lib/plans";
import { parseForm, zCheckbox, zOptText, type ActionState } from "@/lib/validation";

const agentSchema = z.object({
  name: z.string().trim().min(2, "Ingresa un nombre").max(40),
  isActive: zCheckbox(),
  language: z.enum(["es", "en"]),
  goal: z.string().trim().max(1000).default(""),
  greeting: z.string().trim().min(5, "Escribe un saludo").max(500),
  personality: z.string().trim().max(1000).default(""),
  agencyInfo: z.string().trim().max(6000).default(""),
  qualificationQuestions: z.string().trim().max(3000).default(""),
  instructions: z.string().trim().max(6000).default(""),
  voiceProvider: z.string().trim().min(2).max(30),
  voiceId: z.string().trim().min(1).max(100),
  phoneNumber: zOptText(30),
  vapiPhoneNumberId: zOptText(100),
  inboundEnabled: zCheckbox(),
  outboundEnabled: zCheckbox(),
  maxCallDurationMin: z.coerce.number().int().min(1).max(60),
});

export async function createAgentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { organization: org } = await requireAuth();
  const templateId = String(formData.get("template") ?? "receptionist");
  const template = agentTemplates(org.name).find((t) => t.id === templateId) ?? agentTemplates(org.name)[0];

  const ent = getEntitlements(org);
  const [{ n }] = await db.select({ n: count() }).from(agents).where(eq(agents.organizationId, org.id));
  if (n >= ent.agents) {
    return { error: `Tu plan (${ent.planName}) permite ${ent.agents} agente${ent.agents === 1 ? "" : "s"}. Mejora tu plan para crear más.` };
  }

  const [agent] = await db
    .insert(agents)
    .values({ organizationId: org.id, ...template.values })
    .returning({ id: agents.id });
  revalidatePath("/dashboard/agentes");
  redirect(`/dashboard/agentes/${agent.id}`);
}

export async function updateAgentAction(agentId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { organization: org } = await requireAuth();
  const parsed = parseForm(agentSchema, formData);
  if (!parsed.success) return parsed.state;

  try {
    const updated = await db
      .update(agents)
      .set(parsed.data)
      .where(and(eq(agents.id, agentId), eq(agents.organizationId, org.id)))
      .returning({ id: agents.id });
    if (updated.length === 0) return { error: "Agente no encontrado" };
  } catch (err) {
    if (isUniqueViolation(err)) return { error: "Ese número de Vapi ya está asignado a otro agente." };
    throw err;
  }
  revalidatePath(`/dashboard/agentes/${agentId}`);
  revalidatePath("/dashboard/agentes");
  return { ok: true, message: "Agente guardado. Los cambios aplican desde la próxima llamada." };
}

export async function deleteAgentAction(agentId: string) {
  const { organization: org } = await requireAuth();
  const [{ n }] = await db.select({ n: count() }).from(agents).where(eq(agents.organizationId, org.id));
  if (n <= 1) redirect(`/dashboard/agentes/${agentId}?error=ultimo`);
  await db.delete(agents).where(and(eq(agents.id, agentId), eq(agents.organizationId, org.id)));
  revalidatePath("/dashboard/agentes");
  redirect("/dashboard/agentes");
}
