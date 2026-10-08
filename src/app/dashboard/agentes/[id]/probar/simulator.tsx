"use client";

import { Loader2, Mic, MicOff, RotateCcw, Send, Square, Volume2, VolumeX, Wrench } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { buttonClass } from "@/components/ui/button";
import { Alert } from "@/components/ui/misc";
import { cn } from "@/lib/utils";
import { endSimulatorSession, sendSimulatorMessage, type EndSimulatorResult, type SimulatorToolEvent } from "./actions";

type Message = { role: "agent" | "client"; text: string; tools?: SimulatorToolEvent[] };

// Tipos mínimos de la Web Speech API (no incluidos en todas las versiones de lib.dom).
type RecognitionResultEvent = { results: ArrayLike<ArrayLike<{ transcript: string }>> };
type Recognition = {
  lang: string;
  interimResults: boolean;
  onresult: ((e: RecognitionResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type RecognitionCtor = new () => Recognition;

const TOOL_LABELS: Record<string, string> = {
  buscar_propiedades: "Buscó en el inventario",
  detalle_propiedad: "Consultó la ficha del inmueble",
  consultar_disponibilidad: "Revisó la agenda",
  agendar_cita: "Agendó una cita",
  guardar_lead: "Actualizó el CRM",
  solicitar_llamada_asesor: "Pidió llamada de un asesor",
};

const SUGGESTIONS = [
  "Hola, busco apartamento de 3 habitaciones para comprar",
  "Quiero vender mi casa, ¿cómo funciona?",
  "¿Qué tienen en arriendo por menos de 3 millones?",
  "¿Tienen disponibilidad para una visita mañana?",
];

export function Simulator({
  agentId,
  greeting,
  language,
  aiEnabled,
}: {
  agentId: string;
  greeting: string;
  language: string;
  aiEnabled: boolean;
}) {
  const [messages, setMessages] = useState<Message[]>([{ role: "agent", text: greeting }]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ended, setEnded] = useState<Extract<EndSimulatorResult, { ok: true }> | null>(null);
  const [speakReplies, setSpeakReplies] = useState(false);
  const [listening, setListening] = useState(false);
  const [pending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<Recognition | null>(null);
  const locale = language === "en" ? "en-US" : "es-CO";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, pending, ended]);

  useEffect(() => () => recognitionRef.current?.stop(), []);

  function speak(text: string) {
    if (!speakReplies || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = locale;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  function send(raw: string) {
    const text = raw.trim();
    if (!text || pending || ended) return;
    setError(null);
    setInput("");
    setMessages((m) => [...m, { role: "client", text }]);
    startTransition(async () => {
      const res = await sendSimulatorMessage(agentId, sessionId, text);
      if (!res.ok) {
        setError(res.error);
        setMessages((m) => m.slice(0, -1));
        setInput(text);
        return;
      }
      setSessionId(res.sessionId);
      setMessages((m) => [...m, { role: "agent", text: res.reply, tools: res.tools }]);
      speak(res.reply);
    });
  }

  function toggleListening() {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) {
      setError("Tu navegador no soporta reconocimiento de voz. Prueba con Chrome o Edge.");
      return;
    }
    const recognition = new Ctor();
    recognition.lang = locale;
    recognition.interimResults = false;
    recognition.onresult = (e) => {
      const transcript = e.results[0]?.[0]?.transcript;
      if (transcript) send(transcript);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  function endConversation() {
    if (!sessionId) return;
    startTransition(async () => {
      const res = await endSimulatorSession(sessionId);
      if (!res.ok) setError(res.error);
      else setEnded(res);
    });
  }

  function reset() {
    window.speechSynthesis?.cancel();
    setMessages([{ role: "agent", text: greeting }]);
    setSessionId(null);
    setEnded(null);
    setError(null);
    setInput("");
  }

  return (
    <div className="flex h-[calc(100vh-14rem)] min-h-[32rem] flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <p className="text-sm font-medium text-slate-700">Simulador de conversación</p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setSpeakReplies((v) => !v)}
            className={buttonClass("ghost", "sm")}
            title="Leer respuestas en voz alta"
          >
            {speakReplies ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
            <span className="hidden sm:inline">{speakReplies ? "Voz activada" : "Voz apagada"}</span>
          </button>
          <button type="button" onClick={reset} className={buttonClass("ghost", "sm")} disabled={pending}>
            <RotateCcw className="size-4" /> <span className="hidden sm:inline">Reiniciar</span>
          </button>
          <button
            type="button"
            onClick={endConversation}
            className={buttonClass("secondary", "sm")}
            disabled={!sessionId || pending || !!ended}
          >
            <Square className="size-3.5" /> Terminar y analizar
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5">
        {messages.map((m, i) => (
          <div key={i} className={cn("flex flex-col", m.role === "client" ? "items-end" : "items-start")}>
            {m.tools && m.tools.length > 0 ? (
              <div className="mb-1.5 flex flex-wrap gap-1.5">
                {m.tools.map((t, j) => (
                  <details key={j} className="group max-w-md">
                    <summary
                      className={cn(
                        "inline-flex cursor-pointer list-none items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                        t.isError ? "bg-red-50 text-red-700" : "bg-violet-50 text-violet-700",
                      )}
                    >
                      <Wrench className="size-3" /> {TOOL_LABELS[t.name] ?? t.name}
                    </summary>
                    <pre className="mt-1 whitespace-pre-wrap rounded-lg bg-slate-50 p-2 text-[11px] text-slate-600 ring-1 ring-slate-200">
                      {t.result}
                    </pre>
                  </details>
                ))}
              </div>
            ) : null}
            <p
              className={cn(
                "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                m.role === "client" ? "rounded-br-sm bg-brand-600 text-white" : "rounded-bl-sm bg-slate-100 text-slate-800",
              )}
            >
              {m.text}
            </p>
          </div>
        ))}
        {pending && !ended ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="size-4 animate-spin" /> El agente está pensando…
          </div>
        ) : null}
        {ended ? (
          <Alert tone="success" title={`Conversación analizada${ended.outcome ? ` · ${ended.outcome}` : ""}`}>
            <p>{ended.summary ?? "Sin resumen."}</p>
            <div className="mt-2 flex gap-3">
              <Link href={`/dashboard/llamadas/${ended.callId}`} className="font-medium underline">
                Ver conversación
              </Link>
              {ended.leadId ? (
                <Link href={`/dashboard/leads/${ended.leadId}`} className="font-medium underline">
                  Ver lead en el CRM
                </Link>
              ) : null}
            </div>
          </Alert>
        ) : null}
        <div ref={bottomRef} />
      </div>

      {error ? (
        <div className="px-4 pb-2">
          <Alert tone="error" title={error} />
        </div>
      ) : null}

      {messages.length === 1 && aiEnabled ? (
        <div className="flex flex-wrap gap-2 px-4 pb-3">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => send(s)}
              className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700 hover:bg-slate-200"
            >
              {s}
            </button>
          ))}
        </div>
      ) : null}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-center gap-2 border-t border-slate-100 p-3"
      >
        <button
          type="button"
          onClick={toggleListening}
          disabled={!aiEnabled || pending || !!ended}
          className={cn(buttonClass(listening ? "danger" : "secondary"), "px-3")}
          title="Hablar con el micrófono"
        >
          {listening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
        </button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={aiEnabled ? (listening ? "Escuchando…" : "Escribe como si fueras el cliente…") : "Configura ANTHROPIC_API_KEY"}
          disabled={!aiEnabled || !!ended}
          maxLength={2000}
          className="h-10 flex-1 rounded-lg border-0 px-3 text-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-brand-600"
        />
        <button type="submit" disabled={!aiEnabled || pending || !input.trim() || !!ended} className={buttonClass("primary")}>
          <Send className="size-4" />
          <span className="sr-only">Enviar</span>
        </button>
      </form>
    </div>
  );
}
