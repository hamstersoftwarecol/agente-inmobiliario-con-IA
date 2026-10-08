"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <AlertTriangle className="size-8 text-amber-500" />
      <h1 className="text-xl font-semibold">Algo salió mal</h1>
      <p className="max-w-md text-sm text-slate-500">
        No pudimos cargar esta sección. Si el problema persiste, revisa la conexión con la base de datos.
        {error.digest ? <span className="mt-1 block font-mono text-xs">Ref: {error.digest}</span> : null}
      </p>
      <Button onClick={reset}>Reintentar</Button>
    </div>
  );
}
