import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { Field, Input } from "@/components/ui/form";
import { getAuth } from "@/lib/auth/session";
import { signIn } from "../actions";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await getAuth()) redirect("/dashboard");
  const { next } = await searchParams;

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Inicia sesión</h1>
      <p className="mt-2 text-sm text-slate-500">
        ¿No tienes cuenta?{" "}
        <Link href="/registro" className="font-medium text-brand-600 hover:text-brand-700">
          Prueba gratis 14 días
        </Link>
      </p>
      <ActionForm action={signIn} submitLabel="Entrar" className="mt-8">
        <input type="hidden" name="next" value={typeof next === "string" ? next : ""} />
        <Field label="Correo electrónico" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" required placeholder="tu@inmobiliaria.com" />
        </Field>
        <Field label="Contraseña" htmlFor="password">
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </Field>
      </ActionForm>
      <p className="mt-8 rounded-lg bg-slate-100 px-4 py-3 text-xs text-slate-600">
        Demo local: <span className="font-mono">demo@inmovoz.com</span> / <span className="font-mono">demo12345</span>{" "}
        (tras ejecutar <span className="font-mono">npm run db:seed</span>).
      </p>
    </>
  );
}
