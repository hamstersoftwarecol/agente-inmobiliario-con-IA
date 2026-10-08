import { describe, expect, it } from "vitest";
import {
  addDaysToDateKey,
  getTimeZoneOffsetMs,
  toDateKey,
  toLocalDateTimeKey,
  toTimeKey,
  weekdayOfDateKey,
  zonedTimeToUtc,
} from "./time";

describe("zonedTimeToUtc", () => {
  it("convierte hora de Bogotá (UTC-5, sin horario de verano) a UTC", () => {
    expect(zonedTimeToUtc("2026-10-08", "10:00", "America/Bogota").toISOString()).toBe("2026-10-08T15:00:00.000Z");
  });

  it("respeta el horario de verano de Nueva York", () => {
    // Julio: EDT (UTC-4); enero: EST (UTC-5).
    expect(zonedTimeToUtc("2026-07-15", "09:30", "America/New_York").toISOString()).toBe("2026-07-15T13:30:00.000Z");
    expect(zonedTimeToUtc("2026-01-15", "09:30", "America/New_York").toISOString()).toBe("2026-01-15T14:30:00.000Z");
  });

  it("es la inversa de toDateKey/toTimeKey", () => {
    const date = zonedTimeToUtc("2026-12-31", "23:45", "Europe/Madrid");
    expect(toDateKey(date, "Europe/Madrid")).toBe("2026-12-31");
    expect(toTimeKey(date, "Europe/Madrid")).toBe("23:45");
    expect(toLocalDateTimeKey(date, "Europe/Madrid")).toBe("2026-12-31 23:45");
  });
});

describe("utilidades de fecha", () => {
  it("calcula el desfase de una zona", () => {
    expect(getTimeZoneOffsetMs(new Date("2026-10-08T12:00:00Z"), "America/Bogota")).toBe(-5 * 3600 * 1000);
  });

  it("suma días cruzando meses y años", () => {
    expect(addDaysToDateKey("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDaysToDateKey("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysToDateKey("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("obtiene el día de la semana de una fecha", () => {
    expect(weekdayOfDateKey("2026-10-08")).toBe(4); // jueves
    expect(weekdayOfDateKey("2026-10-11")).toBe(0); // domingo
  });

  it("la fecha local puede diferir de la fecha UTC", () => {
    // 2026-10-09T03:00Z sigue siendo 8 de octubre en Bogotá.
    expect(toDateKey(new Date("2026-10-09T03:00:00Z"), "America/Bogota")).toBe("2026-10-08");
  });
});
