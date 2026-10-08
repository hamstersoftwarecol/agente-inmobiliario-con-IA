import { describe, expect, it } from "vitest";
import { scoreLead, temperatureFor } from "./scoring";

describe("scoreLead", () => {
  it("un lead sin datos es frío", () => {
    expect(scoreLead({})).toMatchObject({ score: 0, temperature: "cold" });
  });

  it("un comprador con presupuesto, urgencia, crédito y cita es caliente", () => {
    const result = scoreLead({
      name: "Ana",
      phone: "+573001112233",
      intent: "buy",
      budgetMax: 500_000_000,
      zones: "Chapinero",
      timeline: "immediate",
      financing: "preapproved",
      hasAppointment: true,
    });
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.temperature).toBe("hot");
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it("no supera 100 puntos", () => {
    const { score } = scoreLead({
      name: "A",
      phone: "1234567",
      email: "a@b.co",
      intent: "invest",
      propertyType: "apartment",
      budgetMin: 1,
      budgetMax: 2,
      zones: "x",
      timeline: "immediate",
      financing: "cash",
      hasAppointment: true,
    });
    expect(score).toBe(100);
  });

  it("los valores 'unknown' no suman puntos", () => {
    expect(scoreLead({ timeline: "unknown", financing: "unknown" }).score).toBe(0);
  });
});

describe("temperatureFor", () => {
  it("usa los umbrales 40 y 70", () => {
    expect(temperatureFor(39)).toBe("cold");
    expect(temperatureFor(40)).toBe("warm");
    expect(temperatureFor(69)).toBe("warm");
    expect(temperatureFor(70)).toBe("hot");
  });
});
