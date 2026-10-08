import { and, desc, eq } from "drizzle-orm";
import { ArrowLeft, CalendarPlus, PhoneOutgoing, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { AppointmentStatusBadge, DirectionBadge, LeadStatusBadge, OutcomeBadge, TemperatureBadge } from "@/components/domain-badges";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert, PageHeader, ScoreBar } from "@/components/ui/misc";
import { db } from "@/db";
import { appointments, calls, leads } from "@/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { formatDateTime, formatDuration } from "@/lib/format";
import { scoreLead } from "@/lib/leads/scoring";
import { appointmentTypeLabels, leadSourceLabels } from "@/lib/labels";
import { deleteLeadAction, resolveFollowUpAction, updateLeadAction } from "../actions";
import { LeadFields } from "../lead-fields";

export const metadata: Metadata = { title: "Lead" };

export default async function LeadDetailPage({ params }: PageProps<"/dashboard/leads/[id]">) {
  const { organization: org } = await requireAuth();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const [lead] = await db
    .select()
    .from(leads)
    .where(and(eq(leads.id, id), eq(leads.organizationId, org.id)))
    .limit(1);
  if (!lead) notFound();

  const [leadCalls, leadAppointments] = await Promise.all([
    db.select().from(calls).where(eq(calls.leadId, lead.id)).orderBy(desc(calls.createdAt)).limit(20),
    db.select().from(appointments).where(eq(appointments.leadId, lead.id)).orderBy(desc(appointments.startsAt)).limit(20),
  ]);

  const tz = org.timezone;
  const { reasons } = scoreLead({
    ...lead,
    hasAppointment: leadAppointments.some((a) => a.status !== "cancelled"),
  });

  return (
    <>
      <Link href="/dashboard/leads" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="size-4" /> Leads
      </Link>
      <PageHeader
        title={lead.name ?? lead.phone ?? "Lead sin nombre"}
        description={`${leadSourceLabels[lead.source]} · creado ${formatDateTime(lead.createdAt, tz)}`}
        actions={
          <>
            <ButtonLink href={`/dashboard/llamadas?lead=${lead.id}`} variant="secondary">
              <PhoneOutgoing className="size-4" /> Llamar con IA
            </ButtonLink>
            <ButtonLink href={`/dashboard/citas?lead=${lead.id}`}>
              <CalendarPlus className="size-4" /> Agendar cita
            </ButtonLink>
          </>
        }
      />

      {lead.needsFollowUp ? (
        <Alert tone="warning" title="Este cliente pidió que lo llame un asesor" className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{lead.followUpReason}</span>
            <form action={resolveFollowUpAction.bind(null, lead.id)}>
              <SubmitButton variant="secondary">Marcar como atendido</SubmitButton>
            </form>
          </div>
        </Alert>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Información del lead" />
          <CardBody>
            <ActionForm action={updateLeadAction.bind(null, lead.id)} submitLabel="Guardar cambios">
              <LeadFields lead={lead} currency={org.currency} />
            </ActionForm>
          </CardBody>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Calificación" action={<TemperatureBadge temperature={lead.temperature} />} />
            <CardBody className="space-y-3">
              <div className="flex items-center justify-between">
                <LeadStatusBadge status={lead.status} />
                <ScoreBar score={lead.score} />
              </div>
              {reasons.length > 0 ? (
                <ul className="space-y-1 text-xs text-slate-600">
                  {reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-500">Aún no hay datos suficientes para calificar.</p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Citas" />
            <CardBody>
              {leadAppointments.length === 0 ? (
                <p className="text-sm text-slate-500">Sin citas.</p>
              ) : (
                <ul className="space-y-3">
                  {leadAppointments.map((a) => (
                    <li key={a.id} className="text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{appointmentTypeLabels[a.type]}</span>
                        <AppointmentStatusBadge status={a.status} />
                      </div>
                      <p className="text-xs text-slate-500">{formatDateTime(a.startsAt, tz, { dateStyle: "full" })}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Conversaciones" />
            {leadCalls.length === 0 ? (
              <CardBody>
                <p className="text-sm text-slate-500">Sin conversaciones registradas.</p>
              </CardBody>
            ) : (
              <ul className="divide-y divide-slate-100">
                {leadCalls.map((c) => (
                  <li key={c.id}>
                    <Link href={`/dashboard/llamadas/${c.id}`} className="block px-5 py-3 hover:bg-slate-50">
                      <div className="flex items-center justify-between gap-2">
                        <DirectionBadge direction={c.direction} />
                        <OutcomeBadge outcome={c.outcome} />
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-slate-600">{c.summary ?? "Sin resumen"}</p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        {formatDateTime(c.createdAt, tz)} · {formatDuration(c.durationSec)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <form action={deleteLeadAction.bind(null, lead.id)}>
            <SubmitButton variant="ghost" size="md" confirm="¿Eliminar este lead? Sus llamadas y citas se conservarán sin asociar.">
              <Trash2 className="size-4" /> Eliminar lead
            </SubmitButton>
          </form>
        </div>
      </div>
    </>
  );
}
