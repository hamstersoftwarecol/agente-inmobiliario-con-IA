import type { LeadFinancing, LeadIntent, LeadTemperature, LeadTimeline } from "@/db/schema";

export type ScoringInput = {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  intent?: LeadIntent | null;
  propertyType?: string | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  zones?: string | null;
  timeline?: LeadTimeline | null;
  financing?: LeadFinancing | null;
  hasAppointment?: boolean;
};

const INTENT_POINTS: Record<LeadIntent, number> = {
  buy: 15,
  sell: 15,
  invest: 15,
  rent: 10,
  rent_out: 12,
  other: 3,
};

const TIMELINE_POINTS: Record<LeadTimeline, number> = {
  immediate: 20,
  "1_3_months": 15,
  "3_6_months": 8,
  "6_plus_months": 3,
  unknown: 0,
};

const FINANCING_POINTS: Record<LeadFinancing, number> = {
  cash: 15,
  preapproved: 15,
  in_process: 8,
  needs_financing: 3,
  unknown: 0,
};

/**
 * Puntuación de calificación (0-100) determinista y explicable.
 * Combina datos de contacto, intención, presupuesto, urgencia, financiación y si ya agendó cita.
 */
export function scoreLead(input: ScoringInput): { score: number; temperature: LeadTemperature; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  const add = (points: number, reason: string) => {
    if (points > 0) {
      score += points;
      reasons.push(`+${points} ${reason}`);
    }
  };

  if (input.phone) add(10, "teléfono de contacto");
  if (input.email) add(5, "correo electrónico");
  if (input.name) add(3, "nombre");
  if (input.intent) add(INTENT_POINTS[input.intent], "intención definida");
  if (input.budgetMin || input.budgetMax) add(12, "presupuesto conocido");
  if (input.zones) add(5, "zona de interés");
  if (input.propertyType) add(5, "tipo de inmueble");
  if (input.timeline) add(TIMELINE_POINTS[input.timeline], "plazo de decisión");
  if (input.financing) add(FINANCING_POINTS[input.financing], "capacidad de pago");
  if (input.hasAppointment) add(15, "cita agendada");

  score = Math.min(100, score);
  return { score, temperature: temperatureFor(score), reasons };
}

export function temperatureFor(score: number): LeadTemperature {
  if (score >= 70) return "hot";
  if (score >= 40) return "warm";
  return "cold";
}
