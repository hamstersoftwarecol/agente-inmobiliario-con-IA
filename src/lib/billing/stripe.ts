import { eq } from "drizzle-orm";
import Stripe from "stripe";
import { db } from "@/db";
import { organizations, type Organization } from "@/db/schema";
import { env } from "@/lib/env";
import { planFromPriceId, type PlanDefinition } from "@/lib/plans";

let client: Stripe | undefined;

/** Cliente de Stripe perezoso para que el build no requiera la clave. */
export function stripe(): Stripe {
  const key = env().STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY no está configurada");
  client ??= new Stripe(key, { appInfo: { name: "InmoVoz" } });
  return client;
}

export function priceIds(): Record<PlanDefinition["id"], string | undefined> {
  return {
    starter: env().STRIPE_PRICE_STARTER,
    pro: env().STRIPE_PRICE_PRO,
    agency: env().STRIPE_PRICE_AGENCY,
  };
}

export async function ensureStripeCustomer(org: Organization, email: string): Promise<string> {
  if (org.stripeCustomerId) return org.stripeCustomerId;
  const customer = await stripe().customers.create(
    { email, name: org.name, metadata: { organizationId: org.id } },
    { idempotencyKey: `customer-${org.id}` },
  );
  await db.update(organizations).set({ stripeCustomerId: customer.id }).where(eq(organizations.id, org.id));
  return customer.id;
}

export async function createCheckoutSession(org: Organization, email: string, plan: PlanDefinition["id"]) {
  const price = priceIds()[plan];
  if (!price) throw new Error(`No hay precio de Stripe configurado para el plan ${plan}`);
  const customer = await ensureStripeCustomer(org, email);
  const appUrl = env().APP_URL;
  return stripe().checkout.sessions.create({
    mode: "subscription",
    customer,
    client_reference_id: org.id,
    line_items: [{ price, quantity: 1 }],
    allow_promotion_codes: true,
    subscription_data: { metadata: { organizationId: org.id } },
    metadata: { organizationId: org.id },
    success_url: `${appUrl}/dashboard/facturacion?estado=exito`,
    cancel_url: `${appUrl}/dashboard/facturacion?estado=cancelado`,
  });
}

export async function createPortalSession(org: Organization) {
  if (!org.stripeCustomerId) throw new Error("La inmobiliaria aún no tiene cliente en Stripe");
  return stripe().billingPortal.sessions.create({
    customer: org.stripeCustomerId,
    return_url: `${env().APP_URL}/dashboard/facturacion`,
  });
}

/** Sincroniza el estado de una suscripción de Stripe con la inmobiliaria. */
export async function syncSubscription(subscription: Stripe.Subscription) {
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const item = subscription.items.data[0];
  const plan = planFromPriceId(item?.price.id, priceIds());
  const orgId = subscription.metadata?.organizationId;

  const values = {
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    subscriptionStatus: subscription.status,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    // Desde la API 2025-03-31 los periodos viven en cada ítem de la suscripción.
    currentPeriodStart: item ? new Date(item.current_period_start * 1000) : null,
    currentPeriodEnd: item ? new Date(item.current_period_end * 1000) : null,
    ...(plan ? { plan } : {}),
  };

  const where = orgId ? eq(organizations.id, orgId) : eq(organizations.stripeCustomerId, customerId);
  const updated = await db.update(organizations).set(values).where(where).returning({ id: organizations.id });
  if (updated.length === 0) {
    console.warn(`[stripe] No se encontró la inmobiliaria para la suscripción ${subscription.id}`);
  }
}
