import type { BusinessHours } from "@/db/schema";
import {
  addDaysToDateKey,
  minutesToTime,
  timeToMinutes,
  toDateKey,
  weekdayOfDateKey,
  zonedTimeToUtc,
} from "@/lib/time";

export type BookingSettings = {
  timeZone: string;
  businessHours: BusinessHours;
  durationMin: number;
  bufferMin: number;
  minNoticeHours: number;
  bookingWindowDays: number;
  /** Granularidad de los horarios ofrecidos. Por defecto 30 minutos. */
  stepMin?: number;
};

export type BusyInterval = { start: Date; end: Date };

export type Slot = { start: Date; end: Date; dateKey: string; time: string };

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Calcula los horarios libres de un día concreto (fecha de calendario en la zona de la inmobiliaria),
 * respetando horario laboral, duración, margen entre citas, antelación mínima y ventana de reserva.
 */
export function computeDaySlots(
  dateKey: string,
  settings: BookingSettings,
  busy: BusyInterval[],
  now: Date = new Date(),
): Slot[] {
  const { timeZone, businessHours, durationMin, bufferMin, minNoticeHours, bookingWindowDays } = settings;
  const step = settings.stepMin ?? 30;

  const today = toDateKey(now, timeZone);
  const lastDay = addDaysToDateKey(today, bookingWindowDays);
  if (dateKey < today || dateKey > lastDay) return [];

  const ranges = businessHours[String(weekdayOfDateKey(dateKey)) as keyof BusinessHours] ?? [];
  const earliest = now.getTime() + minNoticeHours * 60 * 60 * 1000;
  const bufferMs = bufferMin * 60 * 1000;
  const slots: Slot[] = [];

  for (const range of ranges) {
    const startMin = timeToMinutes(range.start);
    const endMin = timeToMinutes(range.end);
    for (let m = startMin; m + durationMin <= endMin; m += step) {
      const time = minutesToTime(m);
      const start = zonedTimeToUtc(dateKey, time, timeZone);
      const end = new Date(start.getTime() + durationMin * 60 * 1000);
      if (start.getTime() < earliest) continue;
      const blocked = busy.some((b) =>
        overlaps(start.getTime(), end.getTime(), b.start.getTime() - bufferMs, b.end.getTime() + bufferMs),
      );
      if (!blocked) slots.push({ start, end, dateKey, time });
    }
  }
  return slots;
}

/** Busca los próximos días con disponibilidad a partir de `fromDateKey`. */
export function findNextAvailableDays(
  fromDateKey: string,
  settings: BookingSettings,
  busy: BusyInterval[],
  options: { maxDays?: number; maxSlotsPerDay?: number; now?: Date } = {},
): { dateKey: string; slots: Slot[] }[] {
  const { maxDays = 3, maxSlotsPerDay = 6, now = new Date() } = options;
  const result: { dateKey: string; slots: Slot[] }[] = [];
  for (let i = 0; i <= settings.bookingWindowDays && result.length < maxDays; i++) {
    const dateKey = addDaysToDateKey(fromDateKey, i);
    const slots = computeDaySlots(dateKey, settings, busy, now);
    if (slots.length > 0) result.push({ dateKey, slots: spreadSlots(slots, maxSlotsPerDay) });
  }
  return result;
}

/** Elige `max` horarios repartidos a lo largo del día (mañana y tarde) en lugar de los primeros. */
export function spreadSlots(slots: Slot[], max: number): Slot[] {
  if (slots.length <= max) return slots;
  if (max <= 1) return slots.slice(0, Math.max(0, max));
  const picked: Slot[] = [];
  const stride = (slots.length - 1) / (max - 1);
  for (let i = 0; i < max; i++) picked.push(slots[Math.round(i * stride)]);
  return picked;
}

/** Comprueba si una hora concreta está libre. */
export function isSlotAvailable(
  dateKey: string,
  time: string,
  settings: BookingSettings,
  busy: BusyInterval[],
  now: Date = new Date(),
): boolean {
  // Para validar horas exactas usamos paso de 5 minutos.
  return computeDaySlots(dateKey, { ...settings, stepMin: 5 }, busy, now).some((s) => s.time === time);
}
