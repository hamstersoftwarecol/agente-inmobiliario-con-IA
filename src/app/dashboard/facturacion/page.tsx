import { Check, CreditCard, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import { SubmitButton } from "@/components/action-form";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert, PageHeader } from "@/components/ui/misc";
import { requireAuth } from "@/lib/auth/session";
import { priceIds } from "@/lib/billing/stripe";
import { features } from "@/lib/env";
import { formatDate } from "@/lib/format";
import { PLANS } from "@/lib/plans";
import { getUsageSummary } from "@/lib/services/usage";
import { cn } from "@/lib/utils";
import { openPortalAction, startCheckoutAction } from "./actions";

export const metadata: Metadata = { title: "Facturación" };

const STATUS_LABELS: Record<string, string> = {
  active: "Activa",
  trialing: "En prueba",
  past_due: "Pago pendiente",
  canceled: "Cancelada",
  unpaid: "Impaga",
  incomplete: "Incompleta",
  incomplete_expired: "Expirada",
  paused: "Pausada",
};

function Meter({ label, used, total }: { label: string; used: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 100;
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-sm">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="tabular-nums text-slate-500">
          {used} / {total}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn("h-full rounded-full", pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-brand-600")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default async function BillingPage({ searchParams }: PageProps<"/dashboard/facturacion">) {
  const { organization: org, role } = await requireAuth();
  const [usage, sp] = await Promise.all([getUsageSummary(org), searchParams]);
  const stripeReady = features.stripe();
  const prices = stripeReady ? priceIds() : null;
  const isAdmin = role !== "agent";
  const tz = org.timezone;
  // Con una suscripción vigente, los cambios de plan se hacen en el portal de Stripe (prorrateo incluido).
  const hasSubscription = !!org.stripeSubscriptionId && usage.active && usage.plan !== "trial";

  return (
    <>
      <PageHeader title="Facturación" description="Tu plan, consumo de minutos y suscripción." />

      {sp.estado === "exito" ? (
        <Alert tone="success" title="¡Suscripción activada!" className="mb-6">
          Gracias. Tu plan se actualizará en unos segundos, cuando Stripe confirme el pago.
        </Alert>
      ) : null}
      {sp.estado === "cancelado" ? <Alert tone="info" title="Pago cancelado. No se realizó ningún cargo." className="mb-6" /> : null}
      {sp.estado === "error" ? <Alert tone="error" title="No se pudo conectar con Stripe. Intenta de nuevo." className="mb-6" /> : null}
      {!stripeReady || sp.estado === "no-configurado" ? (
        <Alert tone="warning" title="Stripe no está configurado" className="mb-6">
          Define <code>STRIPE_SECRET_KEY</code>, <code>STRIPE_WEBHOOK_SECRET</code> y los IDs de precio{" "}
          <code>STRIPE_PRICE_*</code> para habilitar los pagos.
        </Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Plan actual"
            action={
              <Badge tone={usage.active ? "green" : "red"}>
                {usage.active ? "Activo" : usage.blockedReason === "trial_expired" ? "Prueba vencida" : "Inactivo"}
              </Badge>
            }
          />
          <CardBody className="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-2xl font-semibold">{usage.planName}</p>
                <p className="text-sm text-slate-500">
                  {org.subscriptionStatus ? `Suscripción: ${STATUS_LABELS[org.subscriptionStatus] ?? org.subscriptionStatus}` : null}
                  {usage.periodEnd
                    ? ` · ${usage.plan === "trial" ? "Termina" : org.cancelAtPeriodEnd ? "Se cancela" : "Se renueva"} el ${formatDate(usage.periodEnd, tz)}`
                    : null}
                </p>
              </div>
              {org.stripeCustomerId && isAdmin && stripeReady ? (
                <form action={openPortalAction}>
                  <SubmitButton variant="secondary" size="md">
                    <ExternalLink className="size-4" /> Gestionar suscripción
                  </SubmitButton>
                </form>
              ) : null}
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Meter label="Minutos de voz este periodo" used={usage.minutesUsed} total={usage.minutes} />
              <Meter label="Agentes de IA" used={usage.agentsUsed} total={usage.agents} />
            </div>
            <p className="text-xs text-slate-500">
              El simulador de chat no consume minutos. Las llamadas telefónicas y web se cuentan por minuto.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Pagos seguros" />
          <CardBody className="space-y-3 text-sm text-slate-600">
            <CreditCard className="size-6 text-brand-600" />
            <p>
              Los pagos se procesan con Stripe. Puedes cambiar de plan, actualizar tu tarjeta o cancelar en cualquier
              momento desde el portal de cliente.
            </p>
          </CardBody>
        </Card>
      </div>

      <h2 className="mb-4 mt-10 text-lg font-semibold">Planes</h2>
      <div className="grid gap-6 lg:grid-cols-3">
        {PLANS.map((plan) => {
          const current = usage.plan === plan.id && usage.active;
          return (
            <Card key={plan.id} className={cn("flex flex-col", plan.highlighted && "ring-2 ring-brand-600")}>
              <CardBody className="flex flex-1 flex-col">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">{plan.name}</h3>
                  {current ? <Badge tone="green">Plan actual</Badge> : plan.highlighted ? <Badge tone="blue">Popular</Badge> : null}
                </div>
                <p className="mt-1 text-sm text-slate-500">{plan.description}</p>
                <p className="mt-4">
                  <span className="text-3xl font-semibold">${plan.priceUsd}</span>
                  <span className="text-sm text-slate-500"> USD/mes</span>
                </p>
                <ul className="mt-4 flex-1 space-y-2 text-sm text-slate-700">
                  {plan.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <Check className="size-4 shrink-0 text-brand-600" /> {f}
                    </li>
                  ))}
                </ul>
                {current ? (
                  <button type="button" disabled className={cn(buttonClass("secondary"), "mt-6 w-full")}>
                    Plan actual
                  </button>
                ) : (
                  <form
                    action={hasSubscription ? openPortalAction : startCheckoutAction.bind(null, plan.id)}
                    className="mt-6"
                  >
                    <SubmitButton variant={plan.highlighted ? "primary" : "secondary"} size="md" className="w-full">
                      {hasSubscription ? "Cambiar de plan" : "Suscribirme"}
                    </SubmitButton>
                  </form>
                )}
                {stripeReady && prices && !prices[plan.id] ? (
                  <p className="mt-2 text-xs text-amber-700">Falta STRIPE_PRICE_{plan.id.toUpperCase()}</p>
                ) : null}
              </CardBody>
            </Card>
          );
        })}
      </div>
    </>
  );
}
