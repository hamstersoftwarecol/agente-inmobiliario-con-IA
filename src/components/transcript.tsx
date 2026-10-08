import { cn } from "@/lib/utils";

/** Muestra una transcripción "Hablante: texto" como conversación. */
export function Transcript({ transcript, agentName }: { transcript: string | null; agentName: string }) {
  if (!transcript?.trim()) {
    return <p className="text-sm text-slate-500">No hay transcripción disponible.</p>;
  }

  const lines = transcript
    .split("\n")
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((raw) => {
      const idx = raw.indexOf(":");
      if (idx > 0 && idx < 40) {
        const speaker = raw.slice(0, idx).trim();
        return { speaker, text: raw.slice(idx + 1).trim(), isClient: /^(cliente|user|customer)$/i.test(speaker) };
      }
      return { speaker: "", text: raw, isClient: false };
    });

  return (
    <div className="space-y-3">
      {lines.map((line, i) => (
        <div key={i} className={cn("flex", line.isClient ? "justify-end" : "justify-start")}>
          <div className="max-w-[85%]">
            <p className={cn("mb-0.5 text-[11px] font-medium text-slate-400", line.isClient && "text-right")}>
              {line.speaker || agentName}
            </p>
            <p
              className={cn(
                "whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                line.isClient ? "rounded-tr-sm bg-brand-600 text-white" : "rounded-tl-sm bg-slate-100 text-slate-800",
              )}
            >
              {line.text}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
