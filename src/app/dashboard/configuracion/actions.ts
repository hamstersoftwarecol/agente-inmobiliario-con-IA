"use server";

import { and, eq, ne } from "drizzle-orm";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createHash } from "node:crypto";
import { z } from "zod";
import { db } from "@/db";
import { organizations, sessions, users, type BusinessHours } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { requireAdmin, requireAuth, SESSION_COOKIE } from "@/lib/auth/session";
import { CURRENCY_OPTIONS } from "@/lib/defaults";
import { isValidTimeZone, timeToMinutes } from "@/lib/time";
import { parseForm, zOptText, type ActionState } from "@/lib/validation";

const orgSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: zOptText(40),
  address: zOptText(250),
  website: zOptText(200).refine((v) => !v || /^https?:\/\//.test(v), "La web debe empezar por http(s)://"),
  timezone: z.string().refine(isValidTimeZone, "Zona horaria inválida"),
  currency: z.enum(CURRENCY_OPTIONS),
});

export async function updateOrganizationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { organization: org } = await requireAdmin();
  const parsed = parseForm(orgSchema, formData);
  if (!parsed.success) return parsed.state;
  await db.update(organizations).set(parsed.data).where(eq(organizations.id, org.id));
  revalidatePath("/dashboard", "layout");
  return { ok: true, message: "Datos de la inmobiliaria actualizados" };
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const bookingSchema = z.object({
  appointmentDurationMin: z.coerce.number().int().min(15).max(240),
  appointmentBufferMin: z.coerce.number().int().min(0).max(120),
  minNoticeHours: z.coerce.number().int().min(0).max(168),
  bookingWindowDays: z.coerce.number().int().min(1).max(120),
});

export async function updateBookingAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { organization: org } = await requireAdmin();
  const parsed = parseForm(bookingSchema, formData);
  if (!parsed.success) return parsed.state;

  const hours = {} as BusinessHours;
  for (let day = 0; day < 7; day++) {
    const key = String(day) as keyof BusinessHours;
    const open = formData.get(`open_${day}`) === "on";
    const start = String(formData.get(`start_${day}`) ?? "");
    const end = String(formData.get(`end_${day}`) ?? "");
    if (!open) {
      hours[key] = [];
      continue;
    }
    if (!TIME_RE.test(start) || !TIME_RE.test(end) || timeToMinutes(start) >= timeToMinutes(end)) {
      return { error: "Revisa el horario: la hora de inicio debe ser anterior a la de cierre en cada día abierto." };
    }
    hours[key] = [{ start, end }];
  }

  await db
    .update(organizations)
    .set({ ...parsed.data, businessHours: hours })
    .where(eq(organizations.id, org.id));
  revalidatePath("/dashboard/configuracion");
  return { ok: true, message: "Agenda actualizada. El agente ofrecerá los nuevos horarios desde ya." };
}

const profileSchema = z.object({ name: z.string().trim().min(2).max(100) });

export async function updateProfileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user } = await requireAuth();
  const parsed = parseForm(profileSchema, formData);
  if (!parsed.success) return parsed.state;
  await db.update(users).set({ name: parsed.data.name }).where(eq(users.id, user.id));
  revalidatePath("/dashboard", "layout");
  return { ok: true, message: "Perfil actualizado" };
}

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Ingresa tu contraseña actual"),
    newPassword: z.string().min(8, "Mínimo 8 caracteres").max(200),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { message: "Las contraseñas no coinciden", path: ["confirmPassword"] });

export async function changePasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user } = await requireAuth();
  const parsed = parseForm(passwordSchema, formData);
  if (!parsed.success) return parsed.state;

  const [row] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, user.id)).limit(1);
  if (!row || !(await verifyPassword(parsed.data.currentPassword, row.passwordHash))) {
    return { error: "La contraseña actual no es correcta." };
  }
  await db.update(users).set({ passwordHash: await hashPassword(parsed.data.newPassword) }).where(eq(users.id, user.id));

  // Cierra las demás sesiones abiertas del usuario.
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const currentId = token ? createHash("sha256").update(token).digest("hex") : "";
  await db.delete(sessions).where(and(eq(sessions.userId, user.id), ne(sessions.id, currentId)));
  return { ok: true, message: "Contraseña actualizada. Cerramos tus otras sesiones." };
}
