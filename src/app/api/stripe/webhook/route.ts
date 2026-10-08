import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import type Stripe from "stripe";
import { db } from "@/db";
import { organizations, webhookEvents } from "@/db/schema";
import { stripe, syncSubscription } from "@/lib/billing/stripe";
import { env } from "@/lib/env";

/** Webhook de Stripe: mantiene sincronizado el plan y el estado de la suscripción. */
export async function POST(request: NextRequest) {
  const secret = env().STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!secret || !signature) {
    return Response.json({ error: "Webhook de Stripe no configurado" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    // Se necesita el cuerpo sin procesar para verificar la firma.
    event = stripe().webhooks.constructEvent(await request.text(), signature, secret);
  } catch (err) {
    console.warn("[stripe-webhook] Firma inválida", err);
    return Response.json({ error: "Firma inválida" }, { status: 400 });
  }

  const [seen] = await db.select().from(webhookEvents).where(eq(webhookEvents.id, event.id)).limit(1);
  if (seen) return Response.json({ received: true, duplicate: true });

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const orgId = session.client_reference_id ?? session.metadata?.organizationId;
        const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
        if (orgId && customerId) {
          await db.update(organizations).set({ stripeCustomerId: customerId }).where(eq(organizations.id, orgId));
        }
        if (session.subscription) {
          const subscriptionId =
            typeof session.subscription === "string" ? session.subscription : session.subscription.id;
          await syncSubscription(await stripe().subscriptions.retrieve(subscriptionId));
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
      case "customer.subscription.paused":
      case "customer.subscription.resumed":
        await syncSubscription(event.data.object);
        break;
      default:
        break;
    }
  } catch (err) {
    console.error(`[stripe-webhook] Error procesando ${event.type}`, err);
    // 500 → Stripe reintentará el evento.
    return Response.json({ error: "Error procesando el evento" }, { status: 500 });
  }

  await db.insert(webhookEvents).values({ id: event.id, provider: "stripe", type: event.type }).onConflictDoNothing();
  return Response.json({ received: true });
}
