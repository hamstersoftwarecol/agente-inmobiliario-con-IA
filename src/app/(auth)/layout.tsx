import { CalendarCheck, PhoneCall, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <Logo className="mb-10" />
          {children}
        </div>
      </div>
      <div className="relative hidden overflow-hidden bg-brand-950 lg:flex lg:flex-col lg:justify-center lg:px-16">
        <div className="absolute -right-24 -top-24 size-96 rounded-full bg-brand-600/30 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 size-96 rounded-full bg-violet-600/20 blur-3xl" />
        <div className="relative max-w-md space-y-8 text-white">
          <h2 className="text-3xl font-semibold leading-tight">
            Tu inmobiliaria atiende cada llamada, de día y de noche.
          </h2>
          <ul className="space-y-5 text-brand-100">
            <li className="flex gap-3">
              <PhoneCall className="mt-0.5 size-5 shrink-0 text-brand-300" />
              Contesta llamadas entrantes en segundos y hace seguimiento a tus leads.
            </li>
            <li className="flex gap-3">
              <Sparkles className="mt-0.5 size-5 shrink-0 text-brand-300" />
              Califica compradores y vendedores con preguntas naturales.
            </li>
            <li className="flex gap-3">
              <CalendarCheck className="mt-0.5 size-5 shrink-0 text-brand-300" />
              Agenda visitas y avalúos directamente en tu calendario.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
