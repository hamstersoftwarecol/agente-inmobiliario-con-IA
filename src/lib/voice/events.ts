import type { CallStatus } from "@/db/schema";

/** Mensaje de servidor de Vapi (solo los campos que usamos; el resto se ignora). */
export type VapiServerMessage = {
  type: string;
  status?: string;
  endedReason?: string;
  transcript?: string;
  recordingUrl?: string;
  summary?: string;
  startedAt?: string;
  endedAt?: string;
  durationSeconds?: number;
  cost?: number;
  artifact?: {
    transcript?: string;
    recordingUrl?: string;
    recording?: { mono?: { combinedUrl?: string } };
  };
  analysis?: { summary?: string };
  call?: {
    id?: string;
    type?: string;
    phoneNumberId?: string;
    customer?: { number?: string; name?: string };
    assistant?: { metadata?: Record<string, string> };
    metadata?: Record<string, string>;
    startedAt?: string;
    endedAt?: string;
    endedReason?: string;
    cost?: number;
  };
  phoneNumber?: { id?: string; number?: string };
  assistant?: { metadata?: Record<string, string> };
  customer?: { number?: string };
};

export function mapVapiStatus(status: string | undefined, endedReason?: string): CallStatus | undefined {
  switch (status) {
    case "queued":
    case "scheduled":
      return "queued";
    case "ringing":
      return "ringing";
    case "in-progress":
    case "forwarding":
      return "in_progress";
    case "ended":
      return isFailure(endedReason) ? "failed" : "ended";
    default:
      return undefined;
  }
}

function isFailure(reason: string | undefined) {
  return !!reason && /error|failed|fault|unavailable/i.test(reason);
}

function toDate(value: string | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Normaliza la transcripción de Vapi ("AI: … / User: …") a etiquetas en español. */
export function normalizeTranscript(transcript: string | null | undefined, agentName: string): string | null {
  if (!transcript) return null;
  return transcript
    .split("\n")
    .map((line) => line.replace(/^\s*(AI|Assistant|Bot)\s*:/i, `${agentName}:`).replace(/^\s*(User|Customer)\s*:/i, "Cliente:"))
    .join("\n")
    .trim();
}

/** Extrae los datos relevantes del informe de fin de llamada. */
export function parseEndOfCallReport(message: VapiServerMessage, agentName: string) {
  const startedAt = toDate(message.startedAt ?? message.call?.startedAt);
  const endedAt = toDate(message.endedAt ?? message.call?.endedAt) ?? new Date();
  const durationSec =
    typeof message.durationSeconds === "number"
      ? Math.round(message.durationSeconds)
      : startedAt
        ? Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 1000))
        : 0;
  const endedReason = message.endedReason ?? message.call?.endedReason ?? null;

  return {
    status: (isFailure(endedReason ?? undefined) ? "failed" : "ended") as CallStatus,
    transcript: normalizeTranscript(message.artifact?.transcript ?? message.transcript, agentName),
    recordingUrl:
      message.artifact?.recordingUrl ?? message.recordingUrl ?? message.artifact?.recording?.mono?.combinedUrl ?? null,
    startedAt,
    endedAt,
    durationSec,
    endedReason,
    cost: typeof message.cost === "number" ? message.cost : (message.call?.cost ?? null),
    providerSummary: message.analysis?.summary ?? message.summary ?? null,
  };
}
