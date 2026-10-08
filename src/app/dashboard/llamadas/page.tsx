import { and, count, desc, eq, isNotNull, type SQL } from "drizzle-orm";
import { PhoneCall, PhoneOutgoing } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { DirectionBadge, OutcomeBadge, SentimentBadge } from "@/components/domain-badges";
import { Pagination, pageFromParam, param } from "@/components/pagination";
import { buttonClass } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Select, SelectOptions, Textarea } from "@/components/ui/form";
import { Alert, EmptyState, PageHeader } from "@/components/ui/misc";
import { db } from "@/db";
import { agents, callDirectionEnum, callOutcomeEnum, calls, leads, type CallDirection, type CallOutcome } from "@/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { features } from "@/lib/env";
import { formatDateTime, formatDuration } from "@/lib/format";
import { callDirectionLabels, callOutcomeLabels, options } from "@/lib/labels";
import { startOutboundCallAction } from "./actions";

export const metadata: Metadata = { title: "Llamadas" };

const PAGE_SIZE = 20;

export default async function CallsPage({ searchParams }: PageProps<"/dashboard/llamadas">) {
  const { organization: org } = await requireAuth();
  const sp = await searchParams;
  const direction = param(sp.direccion) as CallDirection | undefined;
  const outcome = param(sp.resultado) as CallOutcome | undefined;
  const leadParam = param(sp.lead);
  const page = pageFromParam(sp.pagina);

  const conditions: SQL[] = [eq(calls.organizationId, org.id)];
  if (direction && callDirectionEnum.enumValues.includes(direction)) conditions.push(eq(calls.direction, direction));
  if (outcome && callOutcomeEnum.enumValues.includes(outcome)) conditions.push(eq(calls.outcome, outcome));
  const where = and(...conditions);

  const [rows, [{ total }], leadOptions, agentOptions] = await Promise.all([
    db
      .select({ call: calls, leadName: leads.name, agentName: agents.name })
      .from(calls)
      .leftJoin(leads, eq(leads.id, calls.leadId))
      .leftJoin(agents, eq(agents.id, calls.agentId))
      .where(where)
      .orderBy(desc(calls.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(calls).where(where),
    db
      .select({ id: leads.id, name: leads.name, phone: leads.phone })
      .from(leads)
      .where(and(eq(leads.organizationId, org.id), isNotNull(leads.phone)))
      .orderBy(desc(leads.updatedAt))
      .limit(200),
    db
      .select({ id: agents.id, name: agents.name })
      .from(agents)
      .where(and(eq(agents.organizationId, org.id), eq(agents.outboundEnabled, true), isNotNull(agents.vapiPhoneNumberId))),
  ]);

  const tz = org.timezone;

  return (
    <>
      <PageHeader title="Llamadas" description="Historial de conversaciones de tus agentes de IA, con resumen y resultado." />

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Historial"
            action={
              <form className="flex flex-wrap gap-2">
                <Select name="direccion" defaultValue={direction ?? ""} className="h-8 w-36 text-xs">
                  <SelectOptions options={options(callDirectionLabels)} placeholder="Todas las direcciones" />
                </Select>
                <Select name="resultado" defaultValue={outcome ?? ""} className="h-8 w-40 text-xs">
                  <SelectOptions options={options(callOutcomeLabels)} placeholder="Todos los resultados" />
                </Select>
                <button type="submit" className={buttonClass("secondary", "sm")}>
                  Filtrar
                </button>
              </form>
            }
          />
          {rows.length === 0 ? (
            <EmptyState
              icon={PhoneCall}
              title="No hay llamadas"
              description="Cuando tu agente atienda llamadas (o lo pruebes en el simulador) aparecerán aquí."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-2.5">Cliente</th>
                    <th className="px-3 py-2.5">Tipo</th>
                    <th className="px-3 py-2.5">Resultado</th>
                    <th className="px-3 py-2.5">Duración</th>
                    <th className="px-5 py-2.5 text-right">Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map(({ call, leadName, agentName }) => (
                    <tr key={call.id} className="hover:bg-slate-50">
                      <td className="max-w-xs px-5 py-3">
                        <Link href={`/dashboard/llamadas/${call.id}`} className="block">
                          <span className="font-medium text-slate-900">
                            {leadName ?? (call.direction === "outbound" ? call.toNumber : call.fromNumber) ?? "Sin identificar"}
                          </span>
                          <span className="block truncate text-xs text-slate-500">
                            {agentName ? `${agentName} · ` : ""}
                            {call.summary ?? (call.status === "ended" ? "Analizando…" : "En curso")}
                          </span>
                        </Link>
                      </td>
                      <td className="px-3 py-3">
                        <DirectionBadge direction={call.direction} />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1">
                          <OutcomeBadge outcome={call.outcome} />
                          <SentimentBadge sentiment={call.sentiment} />
                        </div>
                      </td>
                      <td className="px-3 py-3 tabular-nums text-slate-600">{formatDuration(call.durationSec)}</td>
                      <td className="whitespace-nowrap px-5 py-3 text-right text-xs text-slate-500">
                        {formatDateTime(call.createdAt, tz)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            basePath="/dashboard/llamadas"
            params={{ direccion: direction, resultado: outcome }}
          />
        </Card>

        <Card className="h-fit">
          <CardHeader
            title={
              <span className="inline-flex items-center gap-2">
                <PhoneOutgoing className="size-4 text-brand-600" /> Nueva llamada saliente
              </span>
            }
            description="Tu agente de IA llama al lead y registra el resultado."
          />
          <CardBody>
            {!features.vapi() ? (
              <Alert tone="warning" title="Telefonía no configurada">
                Agrega <code>VAPI_API_KEY</code> y <code>VAPI_WEBHOOK_SECRET</code> para habilitar llamadas reales.
              </Alert>
            ) : agentOptions.length === 0 ? (
              <Alert tone="info" title="Ningún agente puede llamar">
                Asigna un número de Vapi a un agente y habilita las llamadas salientes en{" "}
                <Link href="/dashboard/agentes" className="underline">
                  Agentes IA
                </Link>
                .
              </Alert>
            ) : (
              <ActionForm action={startOutboundCallAction} submitLabel="Llamar ahora">
                <Field label="Lead" htmlFor="leadId">
                  <Select id="leadId" name="leadId" required defaultValue={leadParam ?? ""}>
                    <SelectOptions
                      placeholder="Selecciona un lead"
                      options={leadOptions.map((l) => ({ value: l.id, label: `${l.name ?? "Sin nombre"} · ${l.phone}` }))}
                    />
                  </Select>
                </Field>
                <Field label="Agente" htmlFor="agentId">
                  <Select id="agentId" name="agentId" required>
                    <SelectOptions options={agentOptions.map((a) => ({ value: a.id, label: a.name }))} />
                  </Select>
                </Field>
                <Field label="Motivo de la llamada" htmlFor="purpose">
                  <Textarea
                    id="purpose"
                    name="purpose"
                    required
                    rows={3}
                    defaultValue="Dar seguimiento a su búsqueda de inmueble y agendar una visita."
                  />
                </Field>
              </ActionForm>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
