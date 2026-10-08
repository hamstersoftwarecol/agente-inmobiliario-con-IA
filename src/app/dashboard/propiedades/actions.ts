"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { isUniqueViolation } from "@/db/errors";
import { properties, propertyOperationEnum, propertyStatusEnum, propertyTypeEnum } from "@/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { parseForm, zMoney, zOptInt, zOptText, zText, type ActionState } from "@/lib/validation";

const propertySchema = z.object({
  reference: zText(30).transform((v) => v.toUpperCase()),
  title: zText(200),
  operation: z.enum(propertyOperationEnum.enumValues),
  type: z.enum(propertyTypeEnum.enumValues),
  status: z.enum(propertyStatusEnum.enumValues),
  price: zMoney(),
  currency: z.string().trim().length(3).toUpperCase(),
  city: zText(100),
  neighborhood: zOptText(150),
  address: zOptText(250),
  bedrooms: zOptInt(0, 100),
  bathrooms: zOptInt(0, 100),
  areaM2: zOptInt(0, 1_000_000),
  parking: zOptInt(0, 100),
  description: z.string().trim().max(5000).default(""),
  features: z
    .string()
    .optional()
    .transform((v) =>
      (v ?? "")
        .split(",")
        .map((f) => f.trim())
        .filter(Boolean)
        .slice(0, 30),
    ),
  imageUrl: zOptText(500).refine((v) => !v || /^https?:\/\//.test(v), "La imagen debe ser una URL http(s)"),
});

export async function createPropertyAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { organization: org } = await requireAuth();
  const parsed = parseForm(propertySchema, formData);
  if (!parsed.success) return parsed.state;
  try {
    await db.insert(properties).values({ ...parsed.data, organizationId: org.id });
  } catch (err) {
    if (isUniqueViolation(err)) return { error: "Ya existe un inmueble con esa referencia." };
    throw err;
  }
  revalidatePath("/dashboard/propiedades");
  redirect("/dashboard/propiedades");
}

export async function updatePropertyAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { organization: org } = await requireAuth();
  const parsed = parseForm(propertySchema, formData);
  if (!parsed.success) return parsed.state;
  try {
    await db
      .update(properties)
      .set(parsed.data)
      .where(and(eq(properties.id, id), eq(properties.organizationId, org.id)));
  } catch (err) {
    if (isUniqueViolation(err)) return { error: "Ya existe un inmueble con esa referencia." };
    throw err;
  }
  revalidatePath("/dashboard/propiedades");
  return { ok: true, message: "Inmueble actualizado" };
}

export async function deletePropertyAction(id: string) {
  const { organization: org } = await requireAuth();
  await db.delete(properties).where(and(eq(properties.id, id), eq(properties.organizationId, org.id)));
  revalidatePath("/dashboard/propiedades");
  redirect("/dashboard/propiedades");
}
