import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-sm font-semibold text-brand-600">404</p>
      <h1 className="text-2xl font-semibold">No encontramos esta página</h1>
      <p className="text-sm text-slate-500">Puede que el enlace esté roto o que el recurso haya sido eliminado.</p>
      <ButtonLink href="/dashboard">Volver al panel</ButtonLink>
    </div>
  );
}
