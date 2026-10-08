import { describe, expect, it } from "vitest";
import { DEFAULT_BUSINESS_HOURS } from "@/lib/defaults";
import { zonedTimeToUtc } from "@/lib/time";
import {
  computeDaySlots,
  findNextAvailableDays,
  isSlotAvailable,
  spreadSlots,
  type BookingSettings,
} from "./availability";

const TZ = "America/Bogota";
const settings: BookingSettings = {
  timeZone: TZ,
  businessHours: DEFAULT_BUSINESS_HOURS, // L-V 9-18, sábado 9-13, domingo cerrado
  durationMin: 60,
  bufferMin: 15,
  minNoticeHours: 2,
  bookingWindowDays: 30,
};
// Miércoles 7 de octubre de 2026, 8:00 en Bogotá.
const now = zonedTimeToUtc("2026-10-07", "08:00", TZ);

describe("computeDaySlots", () => {
  it("genera horarios cada 30 minutos dentro del horario laboral", () => {
    const slots = computeDaySlots("2026-10-08", settings, [], now);
    expect(slots[0].time).toBe("09:00");
    expect(slots.at(-1)?.time).toBe("17:00"); // la última cita de 60 min termina a las 18:00
    expect(slots).toHaveLength(17);
  });

  it("no ofrece horarios los domingos", () => {
    expect(computeDaySlots("2026-10-11", settings, [], now)).toEqual([]);
  });

  it("respeta la antelación mínima en el día actual", () => {
    const slots = computeDaySlots("2026-10-07", settings, [], now);
    expect(slots[0].time).toBe("10:00"); // 8:00 + 2 h
  });

  it("bloquea horarios que se cruzan con citas existentes, incluido el margen", () => {
    const busy = [
      { start: zonedTimeToUtc("2026-10-08", "11:00", TZ), end: zonedTimeToUtc("2026-10-08", "12:00", TZ) },
    ];
    const times = computeDaySlots("2026-10-08", settings, busy, now).map((s) => s.time);
    expect(times).not.toContain("10:00"); // terminaría 11:00, dentro del margen de 15 min
    expect(times).not.toContain("11:00");
    expect(times).not.toContain("11:30");
    expect(times).not.toContain("12:00"); // empieza dentro del margen posterior
    expect(times).toContain("09:30");
    expect(times).toContain("12:30");
  });

  it("no ofrece fechas fuera de la ventana de reserva ni en el pasado", () => {
    expect(computeDaySlots("2026-10-06", settings, [], now)).toEqual([]);
    expect(computeDaySlots("2026-12-01", settings, [], now)).toEqual([]);
  });
});

describe("isSlotAvailable", () => {
  it("valida horas exactas", () => {
    expect(isSlotAvailable("2026-10-08", "09:15", settings, [], now)).toBe(true);
    expect(isSlotAvailable("2026-10-08", "17:30", settings, [], now)).toBe(false); // terminaría 18:30
    expect(isSlotAvailable("2026-10-10", "12:00", settings, [], now)).toBe(true); // sábado
    expect(isSlotAvailable("2026-10-10", "12:30", settings, [], now)).toBe(false);
  });
});

describe("findNextAvailableDays", () => {
  it("salta los días sin disponibilidad", () => {
    const days = findNextAvailableDays("2026-10-10", settings, [], { now, maxDays: 2 });
    expect(days.map((d) => d.dateKey)).toEqual(["2026-10-10", "2026-10-12"]); // salta el domingo
    expect(days[0].slots.length).toBeLessThanOrEqual(6);
  });
});

describe("spreadSlots", () => {
  it("reparte los horarios a lo largo del día", () => {
    const slots = computeDaySlots("2026-10-08", settings, [], now);
    const picked = spreadSlots(slots, 4).map((s) => s.time);
    expect(picked[0]).toBe("09:00");
    expect(picked.at(-1)).toBe("17:00");
    expect(picked).toHaveLength(4);
  });
});
