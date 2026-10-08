"use server";

import { redirect } from "next/navigation";
import { createCheckoutSession, createPortalSession } from "@/lib/billing/stripe";
import { requireAdmin } from "@/lib/auth/session";
import { features } from "@/lib/env";
import { getEntitlements, PLANS, type PlanDefinition } from "@/lib/plans";

export async function startCheckoutAction(planId: PlanDefinition["id"]) {
  const { organization: org, user } = await requireAdmin();
  if (!features.stripe() || !PLANS.some((p) => p.id === planId)) {
    redirect("/dashboard/facturacion?estado=no-configurado");
  }
  // Evita suscripciones duplicadas: con una suscripción vigente se cambia de plan en el portal.
  if (org.stripeSubscriptionId && getEntitlements(org).active && org.plan !== "trial") {
    return openPortalAction();
  }
  let url: string | null = null;
  try {
    const session = await createCheckoutSession(org, user.email, planId);
    url = session.url;
  } catch (err) {
    console.error("[facturacion] Error creando checkout", err);
  }
  redirect(url ?? "/dashboard/facturacion?estado=error");
}

export async function openPortalAction() {
  const { organization: org } = await requireAdmin();
  let url: string | null = null;
  try {
    url = (await createPortalSession(org)).url;
  } catch (err) {
    console.error("[facturacion] Error abriendo portal", err);
  }
  redirect(url ?? "/dashboard/facturacion?estado=error");
}
