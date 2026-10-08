import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { Field, Input } from "@/components/ui/form";
import { getAuth } from "@/lib/auth/session";
import { signUp } from "../actions";

export const metadata: Metadata = { title: "Crear cuenta" };

export default async function RegisterPage() {
  if (await getAuth()) redirect("/dashboard");

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Crea tu recepcionista con IA</h1>
      <p className="mt-2 text-sm text-slate-500">
        14 días gratis, sin tarjeta. ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="font-medium text-brand-600 hover:text-brand-700">
          Inicia sesión
        </Link>
      </p>
      <ActionForm action={signUp} submitLabel="Crear cuenta gratis" className="mt-8">
        <Field label="Tu nombre" htmlFor="name">
          <Input id="name" name="name" autoComplete="name" required />
        </Field>
        <Field label="Nombre de la inmobiliaria" htmlFor="agencyName">
          <Input id="agencyName" name="agencyName" autoComplete="organization" required />
        </Field>
        <Field label="Correo electrónico" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label="Contraseña" htmlFor="password" hint="Mínimo 8 caracteres.">
          <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
        </Field>
      </ActionForm>
      <p className="mt-6 text-xs text-slate-500">
        Al crear tu cuenta aceptas los términos del servicio y la política de tratamiento de datos.
      </p>
    </>
  );
}
