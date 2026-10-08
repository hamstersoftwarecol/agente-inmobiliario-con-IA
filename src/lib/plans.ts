import type { Organization, Plan } from "@/db/schema";

export type PlanDefinition = {
  id: Exclude<Plan, "trial">;
  name: string;
  priceUsd: number;
  minutes: number;
  agents: number;
  description: string;
  features: string[];
  highlighted?: boolean;
};

export const TRIAL_LIMITS = { minutes: 30, agents: 1 } as const;

export const PLANS: PlanDefinition[] = [
  {
    id: "starter",
    name: "Starter",
    priceUsd: 49,
    minutes: 300,
    agents: 1,
    description: "Para agentes independientes que no quieren perder ni una llamada.",
    features: [
      "300 minutos de voz al mes",
      "1 agente de IA",
      "1 número de teléfono",
      "Agenda de citas automática",
      "CRM de leads con calificación",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    priceUsd: 149,
    minutes: 1000,
    agents: 3,
    highlighted: true,
    description: "Para inmobiliarias en crecimiento con varios asesores.",
    features: [
      "1.000 minutos de voz al mes",
      "3 agentes de IA",
      "Llamadas salientes de seguimiento",
      "Análisis de llamadas con IA",
      "Soporte prioritario",
    ],
  },
  {
    id: "agency",
    name: "Agency",
    priceUsd: 399,
    minutes: 3000,
    agents: 10,
    description: "Para redes de oficinas y alto volumen de llamadas.",
    features: [
      "3.000 minutos de voz al mes",
      "10 agentes de IA",
      "Múltiples números y oficinas",
      "Campañas salientes",
      "Onboarding dedicado",
    ],
  },
];

export function getPlan(id: Plan | null | undefined): PlanDefinition | undefined {
  return PLANS.find((p) => p.id === id);
}

const ACTIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

export type Entitlements = {
  plan: Plan;
  planName: string;
  active: boolean;
  /** Motivo por el que el servicio está bloqueado, si lo está. */
  blockedReason?: "trial_expired" | "subscription_inactive";
  minutes: number;
  agents: number;
  periodStart: Date;
  periodEnd: Date | null;
};

/** Determina qué puede usar una inmobiliaria según su suscripción o prueba gratuita. */
export function getEntitlements(org: Pick<
  Organization,
  "plan" | "subscriptionStatus" | "trialEndsAt" | "currentPeriodStart" | "currentPeriodEnd" | "createdAt"
>, now: Date = new Date()): Entitlements {
  const paid = getPlan(org.plan);
  if (paid && org.subscriptionStatus && ACTIVE_STATUSES.has(org.subscriptionStatus)) {
    return {
      plan: paid.id,
      planName: paid.name,
      active: true,
      minutes: paid.minutes,
      agents: paid.agents,
      periodStart: org.currentPeriodStart ?? startOfMonth(now),
      periodEnd: org.currentPeriodEnd,
    };
  }

  if (paid) {
    // Tuvo una suscripción de pago que ya no está activa.
    return {
      plan: paid.id,
      planName: paid.name,
      active: false,
      blockedReason: "subscription_inactive",
      minutes: 0,
      agents: paid.agents,
      periodStart: org.currentPeriodStart ?? startOfMonth(now),
      periodEnd: org.currentPeriodEnd,
    };
  }

  const trialActive = !!org.trialEndsAt && org.trialEndsAt.getTime() > now.getTime();
  return {
    plan: "trial",
    planName: "Prueba gratuita",
    active: trialActive,
    blockedReason: trialActive ? undefined : "trial_expired",
    minutes: TRIAL_LIMITS.minutes,
    agents: TRIAL_LIMITS.agents,
    periodStart: org.createdAt,
    periodEnd: org.trialEndsAt,
  };
}

/** Días restantes de la prueba gratuita (null si no está en prueba). */
export function trialDaysLeft(org: Pick<Organization, "plan" | "trialEndsAt">, now: Date = new Date()): number | null {
  if (org.plan !== "trial" || !org.trialEndsAt) return null;
  return Math.max(0, Math.ceil((org.trialEndsAt.getTime() - now.getTime()) / 86_400_000));
}

function startOfMonth(now: Date) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export function planFromPriceId(priceId: string | null | undefined, priceIds: Record<string, string | undefined>) {
  if (!priceId) return undefined;
  const entry = Object.entries(priceIds).find(([, id]) => id === priceId);
  return entry?.[0] as PlanDefinition["id"] | undefined;
}
