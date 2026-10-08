CREATE TYPE "public"."appointment_status" AS ENUM('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."appointment_type" AS ENUM('visit', 'valuation', 'meeting', 'call');--> statement-breakpoint
CREATE TYPE "public"."call_direction" AS ENUM('inbound', 'outbound', 'web', 'simulator');--> statement-breakpoint
CREATE TYPE "public"."call_outcome" AS ENUM('appointment_booked', 'qualified', 'info_provided', 'callback_requested', 'not_interested', 'no_answer', 'voicemail', 'other');--> statement-breakpoint
CREATE TYPE "public"."call_status" AS ENUM('queued', 'ringing', 'in_progress', 'ended', 'failed');--> statement-breakpoint
CREATE TYPE "public"."lead_financing" AS ENUM('cash', 'preapproved', 'in_process', 'needs_financing', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."lead_intent" AS ENUM('buy', 'sell', 'rent', 'rent_out', 'invest', 'other');--> statement-breakpoint
CREATE TYPE "public"."lead_source" AS ENUM('inbound_call', 'outbound_call', 'web_call', 'simulator', 'manual', 'website');--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('new', 'contacted', 'qualified', 'appointment', 'won', 'lost');--> statement-breakpoint
CREATE TYPE "public"."lead_temperature" AS ENUM('cold', 'warm', 'hot');--> statement-breakpoint
CREATE TYPE "public"."lead_timeline" AS ENUM('immediate', '1_3_months', '3_6_months', '6_plus_months', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('owner', 'admin', 'agent');--> statement-breakpoint
CREATE TYPE "public"."plan" AS ENUM('trial', 'starter', 'pro', 'agency');--> statement-breakpoint
CREATE TYPE "public"."property_operation" AS ENUM('sale', 'rent');--> statement-breakpoint
CREATE TYPE "public"."property_status" AS ENUM('available', 'reserved', 'sold', 'rented', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."property_type" AS ENUM('apartment', 'house', 'office', 'commercial', 'lot', 'warehouse', 'other');--> statement-breakpoint
CREATE TYPE "public"."sentiment" AS ENUM('positive', 'neutral', 'negative');--> statement-breakpoint
CREATE TABLE "agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"language" text DEFAULT 'es' NOT NULL,
	"goal" text DEFAULT '' NOT NULL,
	"greeting" text NOT NULL,
	"personality" text DEFAULT '' NOT NULL,
	"agency_info" text DEFAULT '' NOT NULL,
	"qualification_questions" text DEFAULT '' NOT NULL,
	"instructions" text DEFAULT '' NOT NULL,
	"voice_provider" text DEFAULT 'azure' NOT NULL,
	"voice_id" text DEFAULT 'es-CO-SalomeNeural' NOT NULL,
	"phone_number" text,
	"vapi_phone_number_id" text,
	"inbound_enabled" boolean DEFAULT true NOT NULL,
	"outbound_enabled" boolean DEFAULT true NOT NULL,
	"max_call_duration_min" integer DEFAULT 10 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"lead_id" uuid,
	"property_id" uuid,
	"call_id" uuid,
	"type" "appointment_type" DEFAULT 'visit' NOT NULL,
	"status" "appointment_status" DEFAULT 'scheduled' NOT NULL,
	"title" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"notes" text,
	"source" text DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"agent_id" uuid,
	"lead_id" uuid,
	"provider_call_id" text,
	"direction" "call_direction" NOT NULL,
	"status" "call_status" DEFAULT 'queued' NOT NULL,
	"from_number" text,
	"to_number" text,
	"purpose" text,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"duration_sec" integer DEFAULT 0 NOT NULL,
	"ended_reason" text,
	"transcript" text,
	"summary" text,
	"sentiment" "sentiment",
	"outcome" "call_outcome",
	"analysis" jsonb,
	"recording_url" text,
	"cost" double precision,
	"system_prompt" text,
	"ai_messages" text,
	"analyzed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "calls_provider_call_id_unique" UNIQUE("provider_call_id")
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text,
	"phone" text,
	"email" text,
	"source" "lead_source" DEFAULT 'manual' NOT NULL,
	"status" "lead_status" DEFAULT 'new' NOT NULL,
	"intent" "lead_intent",
	"property_type" "property_type",
	"budget_min" bigint,
	"budget_max" bigint,
	"zones" text,
	"bedrooms" integer,
	"timeline" "lead_timeline" DEFAULT 'unknown' NOT NULL,
	"financing" "lead_financing" DEFAULT 'unknown' NOT NULL,
	"notes" text,
	"score" integer DEFAULT 0 NOT NULL,
	"temperature" "lead_temperature" DEFAULT 'cold' NOT NULL,
	"needs_follow_up" boolean DEFAULT false NOT NULL,
	"follow_up_reason" text,
	"last_contact_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"role" "member_role" DEFAULT 'agent' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"timezone" text DEFAULT 'America/Bogota' NOT NULL,
	"currency" text DEFAULT 'COP' NOT NULL,
	"phone" text,
	"address" text,
	"website" text,
	"plan" "plan" DEFAULT 'trial' NOT NULL,
	"trial_ends_at" timestamp with time zone,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"subscription_status" text,
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"business_hours" jsonb NOT NULL,
	"appointment_duration_min" integer DEFAULT 60 NOT NULL,
	"appointment_buffer_min" integer DEFAULT 15 NOT NULL,
	"min_notice_hours" integer DEFAULT 2 NOT NULL,
	"booking_window_days" integer DEFAULT 30 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_stripe_customer_id_unique" UNIQUE("stripe_customer_id"),
	CONSTRAINT "organizations_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"reference" text NOT NULL,
	"title" text NOT NULL,
	"operation" "property_operation" NOT NULL,
	"type" "property_type" NOT NULL,
	"status" "property_status" DEFAULT 'available' NOT NULL,
	"price" bigint NOT NULL,
	"currency" text DEFAULT 'COP' NOT NULL,
	"city" text NOT NULL,
	"neighborhood" text,
	"address" text,
	"bedrooms" integer,
	"bathrooms" integer,
	"area_m2" integer,
	"parking" integer,
	"description" text DEFAULT '' NOT NULL,
	"features" text[] DEFAULT '{}'::text[] NOT NULL,
	"image_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_call_id_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."calls"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agents_org_idx" ON "agents" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "agents_vapi_phone_idx" ON "agents" USING btree ("vapi_phone_number_id") WHERE "agents"."vapi_phone_number_id" is not null;--> statement-breakpoint
CREATE INDEX "appointments_org_starts_idx" ON "appointments" USING btree ("organization_id","starts_at");--> statement-breakpoint
CREATE INDEX "appointments_lead_idx" ON "appointments" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "calls_org_created_idx" ON "calls" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "calls_lead_idx" ON "calls" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "leads_org_created_idx" ON "leads" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "leads_org_phone_idx" ON "leads" USING btree ("organization_id","phone");--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_user_org_idx" ON "memberships" USING btree ("user_id","organization_id");--> statement-breakpoint
CREATE INDEX "properties_org_idx" ON "properties" USING btree ("organization_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "properties_org_ref_idx" ON "properties" USING btree ("organization_id","reference");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");