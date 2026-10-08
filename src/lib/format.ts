export function formatMoney(amount: number | null | undefined, currency = "COP"): string {
  if (amount === null || amount === undefined) return "—";
  try {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount.toLocaleString("es-CO")} ${currency}`;
  }
}

export function formatDateTime(date: Date | null | undefined, timeZone: string, opts?: Intl.DateTimeFormatOptions) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("es-CO", {
    timeZone,
    dateStyle: "medium",
    timeStyle: "short",
    ...opts,
  }).format(date);
}

export function formatDate(date: Date | null | undefined, timeZone: string) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("es-CO", { timeZone, weekday: "short", day: "numeric", month: "short" }).format(date);
}

export function formatTime(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("es-CO", { timeZone, hour: "numeric", minute: "2-digit" }).format(date);
}

/** Fecha larga en español, p. ej. "jueves 8 de octubre". */
export function formatLongDate(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("es-CO", { timeZone, weekday: "long", day: "numeric", month: "long" }).format(date);
}

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatRelative(date: Date, now: Date = new Date()): string {
  const diffSec = Math.round((date.getTime() - now.getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
  const abs = Math.abs(diffSec);
  if (abs < 60) return rtf.format(diffSec, "second");
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  return rtf.format(Math.round(diffSec / 86400), "day");
}

/** Normaliza un teléfono a formato cercano a E.164 (+57300…). */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const digits = trimmed.replace(/[^\d]/g, "");
  if (digits.length < 7) return null;
  return trimmed.startsWith("+") ? `+${digits}` : digits.length > 10 ? `+${digits}` : digits;
}

export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}
