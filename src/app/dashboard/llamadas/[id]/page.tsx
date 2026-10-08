import { and, eq } from "drizzle-orm";
import { ArrowLeft, CalendarCheck, ListChecks, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SubmitButton } from "@/components/action-form";
import { AppointmentStatusBadge, DirectionBadge, OutcomeBadge, SentimentBadge, TemperatureBadge } from "@/components/domain-badges";
import { Transcript } from "@/components/transcript";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DefinitionList, PageHeader, ScoreBar } from "@/components/ui/misc";
import { db } from "@/db";
import { agents, appointments, calls, leads } from "@/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { features } from "@/lib/env";
import { formatDateTime, formatDuration } from "@/lib/format";
import { appointmentTypeLabels, callStatusLabels, leadIntentLabels } from "@/lib/labels";
import { deleteCallAction, reanalyzeCallAction } from "../actions";

export const metadata: Metadata = { title: "Detalle de llamada" };

export default async function CallDetailPage({ params }: PageProps<"/dashboard/llamadas/[id]">) {
  const { organization: org } = await requireAuth();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const [row] = await db
    .select({ call: calls, agentName: agents.name, lead: leads })
    .from(calls)
    .leftJoin(agents, eq(agents.id, calls.agentId))
    .leftJoin(leads, eq(leads.id, calls.leadId))
    .where(and(eq(calls.id, id), eq(calls.organizationId, org.id)))
    .limit(1);
  if (!row) notFound();
  const { call, agentName, lead } = row;

  const booked = await db
    .select()
    .from(appointments)
    .where(and(eq(appointments.callId, call.id), eq(appointments.organizationId, org.id)));

  const tz = org.timezone;
  const customer = call.direction === "outbound" ? call.toNumber : call.fromNumber;

  return (
    <>
      <Link href="/dashboard/llamadas" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="size-4" /> Llamadas
      </Link>
      <PageHeader
        title={lead?.name ?? customer ?? "Conversación"}
        description={`${formatDateTime(call.createdAt, tz, { dateStyle: "full" })} · ${agentName ?? "Agente eliminado"}`}
        actions={
          <>
            {features.ai() && call.status !== "in_progress" ? (
              <form action={reanalyzeCallAction.bind(null, call.id)}>
                <SubmitButton variant="secondary" size="md">
                  <RefreshCw className="size-4" /> Re-analizar con IA
                </SubmitButton>
              </form>
            ) : null}
            <form action={deleteCallAction.bind(null, call.id)}>
              <SubmitButton variant="ghost" size="md" confirm="¿Eliminar esta llamada? No se puede deshacer.">
                <Trash2 className="size-4" /> Eliminar
              </SubmitButton>
            </form>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader
              title={
                <span className="inline-flex items-center gap-2">
                  <Sparkles className="size-4 text-brand-600" /> Resumen de la IA
                </span>
              }
              action={
                <div className="flex gap-1.5">
                  <OutcomeBadge outcome={call.outcome} />
                  <SentimentBadge sentiment={call.sentiment} />
                </div>
              }
            />
            <CardBody className="space-y-5">
              <p className="text-sm leading-relaxed text-slate-700">
                {call.summary ??
                  (call.status === "in_progress" || call.status === "queued" || call.status === "ringing"
                    ? "La llamada aún está en curso."
                    : call.analyzedAt
                      ? "Sin resumen: la conversación fue muy corta o el análisis con IA no está configurado."
                      : "El análisis se está generando…")}
              </p>
              {call.analysis && (call.analysis.keyPoints.length > 0 || call.analysis.followUpActions.length > 0) ? (
                <div className="grid gap-5 sm:grid-cols-2">
                  {call.analysis.keyPoints.length > 0 ? (
                    <div>
                      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Puntos clave</h3>
                      <ul className="list-disc space-y-1 pl-4 text-sm text-slate-700">
                        {call.analysis.keyPoints.map((p) => (
                          <li key={p}>{p}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {call.analysis.followUpActions.length > 0 ? (
                    <div>
                      <h3 className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <ListChecks className="size-3.5" /> Próximos pasos
                      </h3>
                      <ul className="list-disc space-y-1 pl-4 text-sm text-slate-700">
                        {call.analysis.followUpActions.map((p) => (
                          <li key={p}>{p}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Transcripción" />
            <CardBody>
              {call.recordingUrl ? (
                <audio controls preload="none" src={call.recordingUrl} className="mb-5 w-full">
                  Tu navegador no soporta audio.
                </audio>
              ) : null}
              <Transcript transcript={call.transcript} agentName={agentName ?? "Agente"} />
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Detalles" />
            <CardBody>
              <DefinitionList
                items={[
                  { label: "Tipo", value: <DirectionBadge direction={call.direction} /> },
                  { label: "Estado", value: callStatusLabels[call.status] },
                  { label: "Duración", value: formatDuration(call.durationSec) },
                  { label: "Cliente", value: customer ?? "—" },
                  { label: "Motivo", value: call.purpose ?? "—" },
                  { label: "Fin", value: call.endedReason ?? "—" },
                  { label: "Costo proveedor", value: call.cost != null ? `$${call.cost.toFixed(3)} USD` : "—" },
                ]}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Lead" />
            <CardBody>
              {lead ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{lead.name ?? lead.phone ?? "Sin nombre"}</p>
                    <TemperatureBadge temperature={lead.temperature} />
                  </div>
                  <ScoreBar score={lead.score} />
                  <p className="text-sm text-slate-600">
                    {lead.intent ? leadIntentLabels[lead.intent] : "Intención sin definir"}
                    {lead.zones ? ` · ${lead.zones}` : ""}
                  </p>
                  <ButtonLink href={`/dashboard/leads/${lead.id}`} variant="secondary" size="sm">
                    Ver lead
                  </ButtonLink>
                </div>
              ) : (
                <p className="text-sm text-slate-500">Esta llamada no está asociada a un lead.</p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title={
                <span className="inline-flex items-center gap-2">
                  <CalendarCheck className="size-4 text-brand-600" /> Citas agendadas
                </span>
              }
            />
            <CardBody>
              {booked.length === 0 ? (
                <p className="text-sm text-slate-500">No se agendaron citas en esta llamada.</p>
              ) : (
                <ul className="space-y-3">
                  {booked.map((a) => (
                    <li key={a.id} className="text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{appointmentTypeLabels[a.type]}</span>
                        <AppointmentStatusBadge status={a.status} />
                      </div>
                      <p className="text-slate-500">{formatDateTime(a.startsAt, tz, { dateStyle: "full" })}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          {call.direction === "simulator" ? <Badge tone="gray">Conversación del simulador (no consume minutos)</Badge> : null}
        </div>
      </div>
    </>
  );
}
