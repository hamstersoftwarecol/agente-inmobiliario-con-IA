import { z } from "zod";

export type ActionState = {
  ok?: boolean;
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

const emptyToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

/** Texto obligatorio (recortado). */
export const zText = (max = 200, min = 1) => z.string().trim().min(min, "Este campo es obligatorio").max(max);

/** Texto opcional: cadena vacía → null. */
export const zOptText = (max = 2000) =>
  z.preprocess(emptyToUndefined, z.string().trim().max(max).optional()).transform((v) => v ?? null);

/** Entero opcional desde un input numérico. */
export const zOptInt = (min = 0, max = 1_000_000) =>
  z.preprocess(emptyToUndefined, z.coerce.number().int().min(min).max(max).optional()).transform((v) => v ?? null);

/** Monto opcional: admite separadores ("450.000.000"). */
export const zOptMoney = () =>
  z
    .preprocess(
      (v) => (typeof v === "string" ? (v.replace(/[^\d]/g, "") === "" ? undefined : Number(v.replace(/[^\d]/g, ""))) : v),
      z.number().int().min(0).max(1e13).optional(),
    )
    .transform((v) => v ?? null);

export const zMoney = () =>
  z.preprocess(
    (v) => (typeof v === "string" ? Number(v.replace(/[^\d]/g, "")) : v),
    z.number({ error: "Precio inválido" }).int().positive("El precio debe ser mayor que cero").max(1e13),
  );

/** Checkbox HTML: presente → true. */
export const zCheckbox = () => z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());

/** Enum opcional: cadena vacía → null. */
export const zOptEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess(emptyToUndefined, z.enum(values).optional()).transform((v) => v ?? null);

export function formToObject(formData: FormData): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("$ACTION")) continue;
    obj[key] = typeof value === "string" ? value : value;
  }
  return obj;
}

export function parseForm<T extends z.ZodType>(
  schema: T,
  formData: FormData,
): { success: true; data: z.infer<T> } | { success: false; state: ActionState } {
  const result = schema.safeParse(formToObject(formData));
  if (result.success) return { success: true, data: result.data };
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join(".") || "form";
    (fieldErrors[key] ??= []).push(`${FIELD_NAMES[key] ?? key}: ${issue.message}`);
  }
  return { success: false, state: { error: "Revisa los datos del formulario", fieldErrors } };
}

const FIELD_NAMES: Record<string, string> = {
  name: "Nombre",
  email: "Correo",
  password: "Contraseña",
  agencyName: "Inmobiliaria",
  phone: "Teléfono",
  title: "Título",
  reference: "Referencia",
  price: "Precio",
  city: "Ciudad",
  greeting: "Saludo",
  date: "Fecha",
  time: "Hora",
  timezone: "Zona horaria",
};
