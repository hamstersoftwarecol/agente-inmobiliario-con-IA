import { describe, expect, it } from "vitest";
import { getEntitlements, planFromPriceId, trialDaysLeft, TRIAL_LIMITS } from "./plans";

const now = new Date("2026-10-08T12:00:00Z");
const base = {
  plan: "trial" as const,
  subscriptionStatus: null,
  trialEndsAt: new Date("2026-10-15T12:00:00Z"),
  currentPeriodStart: null,
  currentPeriodEnd: null,
  createdAt: new Date("2026-10-01T12:00:00Z"),
};

describe("getEntitlements", () => {
  it("prueba gratuita vigente", () => {
    const ent = getEntitlements(base, now);
    expect(ent).toMatchObject({ plan: "trial", active: true, minutes: TRIAL_LIMITS.minutes });
    expect(trialDaysLeft(base, now)).toBe(7);
  });

  it("prueba gratuita vencida bloquea el servicio", () => {
    const ent = getEntitlements({ ...base, trialEndsAt: new Date("2026-10-01T00:00:00Z") }, now);
    expect(ent).toMatchObject({ active: false, blockedReason: "trial_expired" });
  });

  it("suscripción de pago activa", () => {
    const start = new Date("2026-10-01T00:00:00Z");
    const ent = getEntitlements(
      { ...base, plan: "pro", subscriptionStatus: "active", currentPeriodStart: start, currentPeriodEnd: new Date("2026-11-01T00:00:00Z") },
      now,
    );
    expect(ent).toMatchObject({ plan: "pro", active: true, minutes: 1000, agents: 3, periodStart: start });
    expect(trialDaysLeft({ plan: "pro", trialEndsAt: null }, now)).toBeNull();
  });

  it("suscripción cancelada bloquea el servicio", () => {
    const ent = getEntitlements({ ...base, plan: "starter", subscriptionStatus: "canceled" }, now);
    expect(ent).toMatchObject({ active: false, blockedReason: "subscription_inactive", minutes: 0 });
  });
});

describe("planFromPriceId", () => {
  it("encuentra el plan por su precio de Stripe", () => {
    const prices = { starter: "price_a", pro: "price_b", agency: undefined };
    expect(planFromPriceId("price_b", prices)).toBe("pro");
    expect(planFromPriceId("price_x", prices)).toBeUndefined();
    expect(planFromPriceId(null, prices)).toBeUndefined();
  });
});
