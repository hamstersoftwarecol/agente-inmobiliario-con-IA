import { z } from "zod";

const optional = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== "" ? v.trim() : undefined));

const effort = z.enum(["low", "medium", "high", "xhigh", "max"]);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z
    .string()
    .default("http://localhost:3000")
    .transform((v) => v.replace(/\/+$/, "")),
  DATABASE_URL: optional,

  ANTHROPIC_API_KEY: optional,
  ANTHROPIC_AUTH_TOKEN: optional,
  ANTHROPIC_MODEL: z.string().default("claude-opus-5-5"),
  ANTHROPIC_VOICE_MODEL: optional,
  AI_CHAT_EFFORT: effort.default("low"),
  AI_ANALYSIS_EFFORT: effort.default("medium"),

  VAPI_API_KEY: optional,
  VAPI_WEBHOOK_SECRET: optional,
  NEXT_PUBLIC_VAPI_PUBLIC_KEY: optional,

  STRIPE_SECRET_KEY: optional,
  STRIPE_WEBHOOK_SECRET: optional,
  STRIPE_PRICE_STARTER: optional,
  STRIPE_PRICE_PRO: optional,
  STRIPE_PRICE_AGENCY: optional,

  TRIAL_DAYS: z.coerce.number().int().min(0).max(90).default(14),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

/**
 * Variables de entorno validadas. Se evalúan de forma perezosa para que
 * `next build` no falle cuando faltan secretos que solo se usan en runtime.
 */
export function env(): Env {
  if (!cached) {
    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
      throw new Error(`Variables de entorno inválidas:\n${issues.join("\n")}`);
    }
    cached = parsed.data;
  }
  return cached;
}

export const features = {
  ai: () => Boolean(env().ANTHROPIC_API_KEY || env().ANTHROPIC_AUTH_TOKEN),
  vapi: () => Boolean(env().VAPI_API_KEY && env().VAPI_WEBHOOK_SECRET),
  vapiWeb: () => Boolean(env().NEXT_PUBLIC_VAPI_PUBLIC_KEY && env().VAPI_WEBHOOK_SECRET),
  stripe: () => Boolean(env().STRIPE_SECRET_KEY),
};
