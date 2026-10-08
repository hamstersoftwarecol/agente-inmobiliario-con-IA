import { relations, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// ─── Enums ────────────────────────────────────────────────────────────────

export const planEnum = pgEnum("plan", ["trial", "starter", "pro", "agency"]);
export const memberRoleEnum = pgEnum("member_role", ["owner", "admin", "agent"]);

export const leadStatusEnum = pgEnum("lead_status", [
  "new",
  "contacted",
  "qualified",
  "appointment",
  "won",
  "lost",
]);
export const leadIntentEnum = pgEnum("lead_intent", ["buy", "sell", "rent", "rent_out", "invest", "other"]);
export const leadTemperatureEnum = pgEnum("lead_temperature", ["cold", "warm", "hot"]);
export const leadSourceEnum = pgEnum("lead_source", [
  "inbound_call",
  "outbound_call",
  "web_call",
  "simulator",
  "manual",
  "website",
]);
export const leadTimelineEnum = pgEnum("lead_timeline", [
  "immediate",
  "1_3_months",
  "3_6_months",
  "6_plus_months",
  "unknown",
]);
export const leadFinancingEnum = pgEnum("lead_financing", [
  "cash",
  "preapproved",
  "in_process",
  "needs_financing",
  "unknown",
]);

export const callDirectionEnum = pgEnum("call_direction", ["inbound", "outbound", "web", "simulator"]);
export const callStatusEnum = pgEnum("call_status", ["queued", "ringing", "in_progress", "ended", "failed"]);
export const callOutcomeEnum = pgEnum("call_outcome", [
  "appointment_booked",
  "qualified",
  "info_provided",
  "callback_requested",
  "not_interested",
  "no_answer",
  "voicemail",
  "other",
]);
export const sentimentEnum = pgEnum("sentiment", ["positive", "neutral", "negative"]);

export const appointmentTypeEnum = pgEnum("appointment_type", ["visit", "valuation", "meeting", "call"]);
export const appointmentStatusEnum = pgEnum("appointment_status", [
  "scheduled",
  "confirmed",
  "completed",
  "cancelled",
  "no_show",
]);

export const propertyOperationEnum = pgEnum("property_operation", ["sale", "rent"]);
export const propertyTypeEnum = pgEnum("property_type", [
  "apartment",
  "house",
  "office",
  "commercial",
  "lot",
  "warehouse",
  "other",
]);
export const propertyStatusEnum = pgEnum("property_status", ["available", "reserved", "sold", "rented", "inactive"]);

// ─── Tipos JSON ───────────────────────────────────────────────────────────

export type TimeRange = { start: string; end: string };
/** Horario laboral por día de la semana (0 = domingo … 6 = sábado). */
export type BusinessHours = Record<"0" | "1" | "2" | "3" | "4" | "5" | "6", TimeRange[]>;

export type CallAnalysis = {
  keyPoints: string[];
  followUpActions: string[];
};

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
};

// ─── Autenticación ────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  ...timestamps,
});

export const sessions = pgTable(
  "sessions",
  {
    /** SHA-256 del token de sesión (el token en claro solo vive en la cookie). */
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

// ─── Tenencia (inmobiliarias) ─────────────────────────────────────────────

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  timezone: text("timezone").notNull().default("America/Bogota"),
  currency: text("currency").notNull().default("COP"),
  phone: text("phone"),
  address: text("address"),
  website: text("website"),

  plan: planEnum("plan").notNull().default("trial"),
  trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
  stripeCustomerId: text("stripe_customer_id").unique(),
  stripeSubscriptionId: text("stripe_subscription_id").unique(),
  subscriptionStatus: text("subscription_status"),
  currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),

  businessHours: jsonb("business_hours").$type<BusinessHours>().notNull(),
  appointmentDurationMin: integer("appointment_duration_min").notNull().default(60),
  appointmentBufferMin: integer("appointment_buffer_min").notNull().default(15),
  minNoticeHours: integer("min_notice_hours").notNull().default(2),
  bookingWindowDays: integer("booking_window_days").notNull().default(30),
  ...timestamps,
});

export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    role: memberRoleEnum("role").notNull().default("agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("memberships_user_org_idx").on(t.userId, t.organizationId)],
);

// ─── Agentes de IA ────────────────────────────────────────────────────────

export const agents = pgTable(
  "agents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    language: text("language").notNull().default("es"),
    goal: text("goal").notNull().default(""),
    greeting: text("greeting").notNull(),
    personality: text("personality").notNull().default(""),
    agencyInfo: text("agency_info").notNull().default(""),
    qualificationQuestions: text("qualification_questions").notNull().default(""),
    instructions: text("instructions").notNull().default(""),

    voiceProvider: text("voice_provider").notNull().default("azure"),
    voiceId: text("voice_id").notNull().default("es-CO-SalomeNeural"),
    phoneNumber: text("phone_number"),
    vapiPhoneNumberId: text("vapi_phone_number_id"),
    inboundEnabled: boolean("inbound_enabled").notNull().default(true),
    outboundEnabled: boolean("outbound_enabled").notNull().default(true),
    maxCallDurationMin: integer("max_call_duration_min").notNull().default(10),
    ...timestamps,
  },
  (t) => [
    index("agents_org_idx").on(t.organizationId),
    uniqueIndex("agents_vapi_phone_idx")
      .on(t.vapiPhoneNumberId)
      .where(sql`${t.vapiPhoneNumberId} is not null`),
  ],
);

// ─── Inventario de propiedades ────────────────────────────────────────────

export const properties = pgTable(
  "properties",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    reference: text("reference").notNull(),
    title: text("title").notNull(),
    operation: propertyOperationEnum("operation").notNull(),
    type: propertyTypeEnum("type").notNull(),
    status: propertyStatusEnum("status").notNull().default("available"),
    price: bigint("price", { mode: "number" }).notNull(),
    currency: text("currency").notNull().default("COP"),
    city: text("city").notNull(),
    neighborhood: text("neighborhood"),
    address: text("address"),
    bedrooms: integer("bedrooms"),
    bathrooms: integer("bathrooms"),
    areaM2: integer("area_m2"),
    parking: integer("parking"),
    description: text("description").notNull().default(""),
    features: text("features").array().notNull().default(sql`'{}'::text[]`),
    imageUrl: text("image_url"),
    ...timestamps,
  },
  (t) => [
    index("properties_org_idx").on(t.organizationId, t.status),
    uniqueIndex("properties_org_ref_idx").on(t.organizationId, t.reference),
  ],
);

// ─── CRM: leads, llamadas y citas ─────────────────────────────────────────

export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name"),
    phone: text("phone"),
    email: text("email"),
    source: leadSourceEnum("source").notNull().default("manual"),
    status: leadStatusEnum("status").notNull().default("new"),
    intent: leadIntentEnum("intent"),
    propertyType: propertyTypeEnum("property_type"),
    budgetMin: bigint("budget_min", { mode: "number" }),
    budgetMax: bigint("budget_max", { mode: "number" }),
    zones: text("zones"),
    bedrooms: integer("bedrooms"),
    timeline: leadTimelineEnum("timeline").notNull().default("unknown"),
    financing: leadFinancingEnum("financing").notNull().default("unknown"),
    notes: text("notes"),
    score: integer("score").notNull().default(0),
    temperature: leadTemperatureEnum("temperature").notNull().default("cold"),
    needsFollowUp: boolean("needs_follow_up").notNull().default(false),
    followUpReason: text("follow_up_reason"),
    lastContactAt: timestamp("last_contact_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("leads_org_created_idx").on(t.organizationId, t.createdAt),
    index("leads_org_phone_idx").on(t.organizationId, t.phone),
  ],
);

export const calls = pgTable(
  "calls",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id").references(() => agents.id, { onDelete: "set null" }),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
    providerCallId: text("provider_call_id").unique(),
    direction: callDirectionEnum("direction").notNull(),
    status: callStatusEnum("status").notNull().default("queued"),
    fromNumber: text("from_number"),
    toNumber: text("to_number"),
    purpose: text("purpose"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    durationSec: integer("duration_sec").notNull().default(0),
    endedReason: text("ended_reason"),
    transcript: text("transcript"),
    summary: text("summary"),
    sentiment: sentimentEnum("sentiment"),
    outcome: callOutcomeEnum("outcome"),
    analysis: jsonb("analysis").$type<CallAnalysis>(),
    recordingUrl: text("recording_url"),
    cost: doublePrecision("cost"),
    /** Prompt de sistema congelado al iniciar la conversación (simulador). */
    systemPrompt: text("system_prompt"),
    /** Historial exacto de mensajes enviado a Claude (JSON, solo se agrega). */
    aiMessages: text("ai_messages"),
    analyzedAt: timestamp("analyzed_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("calls_org_created_idx").on(t.organizationId, t.createdAt),
    index("calls_lead_idx").on(t.leadId),
  ],
);

export const appointments = pgTable(
  "appointments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
    propertyId: uuid("property_id").references(() => properties.id, { onDelete: "set null" }),
    callId: uuid("call_id").references(() => calls.id, { onDelete: "set null" }),
    type: appointmentTypeEnum("type").notNull().default("visit"),
    status: appointmentStatusEnum("status").notNull().default("scheduled"),
    title: text("title").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    notes: text("notes"),
    source: text("source").notNull().default("manual"),
    ...timestamps,
  },
  (t) => [
    index("appointments_org_starts_idx").on(t.organizationId, t.startsAt),
    index("appointments_lead_idx").on(t.leadId),
  ],
);

/** Idempotencia de webhooks (Stripe): cada evento se procesa una sola vez. */
export const webhookEvents = pgTable("webhook_events", {
  id: text("id").primaryKey(),
  provider: text("provider").notNull(),
  type: text("type").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Relaciones (para la API de consultas relacional) ─────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(memberships),
  sessions: many(sessions),
}));

export const organizationsRelations = relations(organizations, ({ many }) => ({
  memberships: many(memberships),
  agents: many(agents),
  properties: many(properties),
  leads: many(leads),
  calls: many(calls),
  appointments: many(appointments),
}));

export const membershipsRelations = relations(memberships, ({ one }) => ({
  user: one(users, { fields: [memberships.userId], references: [users.id] }),
  organization: one(organizations, {
    fields: [memberships.organizationId],
    references: [organizations.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const agentsRelations = relations(agents, ({ one, many }) => ({
  organization: one(organizations, { fields: [agents.organizationId], references: [organizations.id] }),
  calls: many(calls),
}));

export const leadsRelations = relations(leads, ({ one, many }) => ({
  organization: one(organizations, { fields: [leads.organizationId], references: [organizations.id] }),
  calls: many(calls),
  appointments: many(appointments),
}));

export const callsRelations = relations(calls, ({ one }) => ({
  organization: one(organizations, { fields: [calls.organizationId], references: [organizations.id] }),
  agent: one(agents, { fields: [calls.agentId], references: [agents.id] }),
  lead: one(leads, { fields: [calls.leadId], references: [leads.id] }),
}));

export const appointmentsRelations = relations(appointments, ({ one }) => ({
  organization: one(organizations, { fields: [appointments.organizationId], references: [organizations.id] }),
  lead: one(leads, { fields: [appointments.leadId], references: [leads.id] }),
  property: one(properties, { fields: [appointments.propertyId], references: [properties.id] }),
  call: one(calls, { fields: [appointments.callId], references: [calls.id] }),
}));

export const propertiesRelations = relations(properties, ({ one, many }) => ({
  organization: one(organizations, { fields: [properties.organizationId], references: [organizations.id] }),
  appointments: many(appointments),
}));

// ─── Tipos inferidos ──────────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type Organization = typeof organizations.$inferSelect;
export type Membership = typeof memberships.$inferSelect;
export type Agent = typeof agents.$inferSelect;
export type Property = typeof properties.$inferSelect;
export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
export type Call = typeof calls.$inferSelect;
export type Appointment = typeof appointments.$inferSelect;

export type Plan = (typeof planEnum.enumValues)[number];
export type LeadStatus = (typeof leadStatusEnum.enumValues)[number];
export type LeadIntent = (typeof leadIntentEnum.enumValues)[number];
export type LeadTemperature = (typeof leadTemperatureEnum.enumValues)[number];
export type LeadSource = (typeof leadSourceEnum.enumValues)[number];
export type LeadTimeline = (typeof leadTimelineEnum.enumValues)[number];
export type LeadFinancing = (typeof leadFinancingEnum.enumValues)[number];
export type CallDirection = (typeof callDirectionEnum.enumValues)[number];
export type CallStatus = (typeof callStatusEnum.enumValues)[number];
export type CallOutcome = (typeof callOutcomeEnum.enumValues)[number];
export type Sentiment = (typeof sentimentEnum.enumValues)[number];
export type AppointmentType = (typeof appointmentTypeEnum.enumValues)[number];
export type AppointmentStatus = (typeof appointmentStatusEnum.enumValues)[number];
export type PropertyOperation = (typeof propertyOperationEnum.enumValues)[number];
export type PropertyType = (typeof propertyTypeEnum.enumValues)[number];
export type PropertyStatus = (typeof propertyStatusEnum.enumValues)[number];
