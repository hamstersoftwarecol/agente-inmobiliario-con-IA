"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { agents, memberships, organizations, users } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { rateLimit } from "@/lib/auth/rate-limit";
import { createSession, destroySession } from "@/lib/auth/session";
import { DEFAULT_BUSINESS_HOURS, defaultAgentValues } from "@/lib/defaults";
import { env } from "@/lib/env";
import { parseForm, type ActionState } from "@/lib/validation";

const signUpSchema = z.object({
  name: z.string().trim().min(2, "Ingresa tu nombre").max(100),
  agencyName: z.string().trim().min(2, "Ingresa el nombre de tu inmobiliaria").max(120),
  email: z.string().trim().toLowerCase().max(200).pipe(z.email("Correo inválido")),
  password: z.string().min(8, "Mínimo 8 caracteres").max(200),
});

const signInSchema = z.object({
  email: z.string().trim().toLowerCase().max(200).pipe(z.email("Correo inválido")),
  password: z.string().min(1, "Ingresa tu contraseña").max(200),
  next: z.string().optional(),
});

async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "local";
}

function safeNext(next: string | undefined) {
  return next && next.startsWith("/dashboard") && !next.startsWith("//") ? next : "/dashboard";
}

export async function signUp(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseForm(signUpSchema, formData);
  if (!parsed.success) return parsed.state;
  const { name, agencyName, email, password } = parsed.data;

  const limit = rateLimit(`signup:${await clientIp()}`, 5, 60 * 60 * 1000);
  if (!limit.ok) return { error: "Demasiados registros desde esta red. Intenta más tarde." };

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) return { error: "Ya existe una cuenta con ese correo." };

  const passwordHash = await hashPassword(password);
  const userId = await db.transaction(async (tx) => {
    const [user] = await tx.insert(users).values({ name, email, passwordHash }).returning({ id: users.id });
    const [org] = await tx
      .insert(organizations)
      .values({
        name: agencyName,
        businessHours: DEFAULT_BUSINESS_HOURS,
        trialEndsAt: new Date(Date.now() + env().TRIAL_DAYS * 24 * 60 * 60 * 1000),
      })
      .returning({ id: organizations.id });
    await tx.insert(memberships).values({ userId: user.id, organizationId: org.id, role: "owner" });
    await tx.insert(agents).values({ organizationId: org.id, ...defaultAgentValues(agencyName) });
    return user.id;
  });

  await createSession(userId);
  redirect("/dashboard?bienvenida=1");
}

export async function signIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseForm(signInSchema, formData);
  if (!parsed.success) return parsed.state;
  const { email, password, next } = parsed.data;

  const limit = rateLimit(`login:${await clientIp()}:${email}`, 10, 15 * 60 * 1000);
  if (!limit.ok) {
    return { error: `Demasiados intentos. Intenta de nuevo en ${Math.ceil(limit.retryAfterSec / 60)} minutos.` };
  }

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  // Verificamos siempre para no filtrar por tiempo de respuesta si el correo existe.
  const valid = await verifyPassword(password, user?.passwordHash ?? "scrypt$16384$8$1$AAAA$AAAA");
  if (!user || !valid) return { error: "Correo o contraseña incorrectos." };

  await createSession(user.id);
  redirect(safeNext(next));
}

export async function signOut() {
  await destroySession();
  redirect("/");
}
