import type {
  AppointmentStatus,
  AppointmentType,
  CallDirection,
  CallOutcome,
  CallStatus,
  LeadFinancing,
  LeadIntent,
  LeadSource,
  LeadStatus,
  LeadTemperature,
  LeadTimeline,
  PropertyOperation,
  PropertyStatus,
  PropertyType,
  Sentiment,
} from "@/db/schema";

export const leadStatusLabels: Record<LeadStatus, string> = {
  new: "Nuevo",
  contacted: "Contactado",
  qualified: "Calificado",
  appointment: "Cita agendada",
  won: "Cerrado (ganado)",
  lost: "Perdido",
};

export const leadIntentLabels: Record<LeadIntent, string> = {
  buy: "Comprar",
  sell: "Vender",
  rent: "Arrendar (inquilino)",
  rent_out: "Poner en arriendo",
  invest: "Invertir",
  other: "Otro",
};

export const leadTemperatureLabels: Record<LeadTemperature, string> = {
  hot: "Caliente",
  warm: "Tibio",
  cold: "Frío",
};

export const leadSourceLabels: Record<LeadSource, string> = {
  inbound_call: "Llamada entrante",
  outbound_call: "Llamada saliente",
  web_call: "Llamada web",
  simulator: "Simulador",
  manual: "Manual",
  website: "Sitio web",
};

export const leadTimelineLabels: Record<LeadTimeline, string> = {
  immediate: "Inmediato (< 1 mes)",
  "1_3_months": "1 a 3 meses",
  "3_6_months": "3 a 6 meses",
  "6_plus_months": "Más de 6 meses",
  unknown: "Sin definir",
};

export const leadFinancingLabels: Record<LeadFinancing, string> = {
  cash: "Recursos propios / contado",
  preapproved: "Crédito preaprobado",
  in_process: "Crédito en trámite",
  needs_financing: "Necesita financiación",
  unknown: "Sin definir",
};

export const callDirectionLabels: Record<CallDirection, string> = {
  inbound: "Entrante",
  outbound: "Saliente",
  web: "Web",
  simulator: "Simulador",
};

export const callStatusLabels: Record<CallStatus, string> = {
  queued: "En cola",
  ringing: "Timbrando",
  in_progress: "En curso",
  ended: "Finalizada",
  failed: "Fallida",
};

export const callOutcomeLabels: Record<CallOutcome, string> = {
  appointment_booked: "Cita agendada",
  qualified: "Lead calificado",
  info_provided: "Información entregada",
  callback_requested: "Pidió que lo llamen",
  not_interested: "No interesado",
  no_answer: "Sin respuesta",
  voicemail: "Buzón de voz",
  other: "Otro",
};

export const sentimentLabels: Record<Sentiment, string> = {
  positive: "Positivo",
  neutral: "Neutral",
  negative: "Negativo",
};

export const appointmentTypeLabels: Record<AppointmentType, string> = {
  visit: "Visita a inmueble",
  valuation: "Avalúo / captación",
  meeting: "Reunión en oficina",
  call: "Llamada con asesor",
};

export const appointmentStatusLabels: Record<AppointmentStatus, string> = {
  scheduled: "Agendada",
  confirmed: "Confirmada",
  completed: "Realizada",
  cancelled: "Cancelada",
  no_show: "No asistió",
};

export const propertyOperationLabels: Record<PropertyOperation, string> = {
  sale: "Venta",
  rent: "Arriendo",
};

export const propertyTypeLabels: Record<PropertyType, string> = {
  apartment: "Apartamento",
  house: "Casa",
  office: "Oficina",
  commercial: "Local comercial",
  lot: "Lote / terreno",
  warehouse: "Bodega",
  other: "Otro",
};

export const propertyStatusLabels: Record<PropertyStatus, string> = {
  available: "Disponible",
  reserved: "Reservado",
  sold: "Vendido",
  rented: "Arrendado",
  inactive: "Inactivo",
};

export function options<T extends string>(labels: Record<T, string>) {
  return (Object.entries(labels) as [T, string][]).map(([value, label]) => ({ value, label }));
}
