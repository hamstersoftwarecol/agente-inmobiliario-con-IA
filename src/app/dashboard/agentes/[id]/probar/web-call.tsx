"use client";

import type Vapi from "@vapi-ai/web";
import { Loader2, Phone, PhoneOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { buttonClass } from "@/components/ui/button";
import { Alert } from "@/components/ui/misc";
import { cn } from "@/lib/utils";
import { getWebCallConfig } from "./actions";

type Status = "idle" | "connecting" | "active" | "ended";
type Line = { role: string; text: string };

/** Llamada de voz real con el agente desde el navegador usando el Web SDK de Vapi. */
export function WebCall({ agentId, enabled }: { agentId: string; enabled: boolean }) {
  const [status, setStatus] = useState<Status>("idle");
  const [lines, setLines] = useState<Line[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const vapiRef = useRef<Vapi | null>(null);

  useEffect(() => () => void vapiRef.current?.stop(), []);

  async function start() {
    setError(null);
    setLines([]);
    setStatus("connecting");
    try {
      const config = await getWebCallConfig(agentId);
      if (!config.ok) throw new Error(config.error);
      const { default: VapiClient } = await import("@vapi-ai/web");
      const vapi = new VapiClient(config.publicKey);
      vapiRef.current = vapi;
      vapi.on("call-start", () => setStatus("active"));
      vapi.on("call-end", () => {
        setStatus("ended");
        setSpeaking(false);
      });
      vapi.on("speech-start", () => setSpeaking(true));
      vapi.on("speech-end", () => setSpeaking(false));
      vapi.on("error", (e: unknown) => {
        console.error("[web-call]", e);
        setError("La llamada se interrumpió. Revisa el micrófono y la configuración de Vapi.");
        setStatus("idle");
      });
      vapi.on("message", (message: { type?: string; transcriptType?: string; role?: string; transcript?: string }) => {
        if (message.type === "transcript" && message.transcriptType === "final" && message.transcript) {
          setLines((l) => [...l, { role: message.role ?? "assistant", text: message.transcript! }]);
        }
      });
      await vapi.start(config.assistant);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar la llamada.");
      setStatus("idle");
    }
  }

  function stop() {
    void vapiRef.current?.stop();
  }

  return (
    <div className="space-y-4">
      {!enabled ? (
        <Alert tone="info" title="Llamadas web desactivadas">
          Agrega <code>NEXT_PUBLIC_VAPI_PUBLIC_KEY</code> y <code>VAPI_WEBHOOK_SECRET</code>, y publica la app en una URL
          accesible por Vapi (<code>APP_URL</code>) para hablar con el agente desde el navegador.
        </Alert>
      ) : null}

      <div className="flex flex-col items-center gap-4 rounded-xl bg-slate-50 py-8">
        <div className="relative">
          {status === "active" && speaking ? (
            <span className="pulse-ring absolute inset-0 rounded-full bg-brand-400" />
          ) : null}
          <span
            className={cn(
              "relative flex size-20 items-center justify-center rounded-full text-white shadow-lg",
              status === "active" ? "bg-emerald-500" : "bg-brand-600",
            )}
          >
            {status === "connecting" ? <Loader2 className="size-8 animate-spin" /> : <Phone className="size-8" />}
          </span>
        </div>
        <p className="text-sm text-slate-600">
          {status === "idle" && "Habla con tu agente usando el micrófono"}
          {status === "connecting" && "Conectando…"}
          {status === "active" && (speaking ? "El agente está hablando…" : "Te escucho…")}
          {status === "ended" && "Llamada finalizada. El análisis aparecerá en Llamadas."}
        </p>
        {status === "active" || status === "connecting" ? (
          <button type="button" onClick={stop} className={buttonClass("danger")}>
            <PhoneOff className="size-4" /> Colgar
          </button>
        ) : (
          <button type="button" onClick={start} disabled={!enabled} className={buttonClass("primary")}>
            <Phone className="size-4" /> Iniciar llamada web
          </button>
        )}
      </div>

      {error ? <Alert tone="error" title={error} /> : null}

      {lines.length > 0 ? (
        <div className="max-h-64 space-y-2 overflow-y-auto text-sm">
          {lines.map((l, i) => (
            <p key={i}>
              <span className="font-medium text-slate-500">{l.role === "user" ? "Tú" : "Agente"}:</span> {l.text}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
