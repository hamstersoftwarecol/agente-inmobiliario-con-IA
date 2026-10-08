import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock,
  PhoneCall,
  TrendingUp,
  UserPlus,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { DirectionBadge, OutcomeBadge, TemperatureBadge } from "@/components/domain-badges";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert, EmptyState, PageHeader, ScoreBar, StatCard } from "@/components/ui/misc";
import { requireAuth } from "@/lib/auth/session";
import { features } from "@/lib/env";
import { formatDate, formatDuration, formatTime } from "@/lib/format";
import { appointmentTypeLabels } from "@/lib/labels";
import { getDashboardData } from "@/lib/queries/dashboard";
import { getUsageSummary } from "@/lib/services/usage";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Resumen" };

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const { organization: org, user } = await requireAuth();
  const [data, usage, params] = await Promise.all([getDashboardData(org), getUsageSummary(org), searchParams]);
  const tz = org.timezone;
  const maxDay = Math.max(1, ...data.series.map((d) => d.count));

  const checklist = [
    { done: data.setup.agents > 0, label: "Configura tu agente de IA", href: "/dashboard/agentes" },
    { done: data.setup.properties > 0, label: "Carga tus inmuebles", href: "/dashboard/propiedades/nueva" },
    { done: data.setup.simulations > 0, label: "Prueba el agente en el simulador", href: "/dashboard/agentes" },
    { done: data.setup.agentsWithPhone > 0, label: "Conecta un número de teléfono", href: "/dashboard/agentes" },
    { done: usage.plan !== "trial" && usage.active, label: "Activa tu suscripción", href: "/dashboard/facturacion" },
  ];
  const pending = checklist.filter((c) => !c.done).length;

  return (
    <>
      <PageHeader
        title={`Hola, ${user.name.split(" ")[0]} 👋`}
        description={`Esto es lo que tu recepcionista con IA ha hecho por ${org.name}.`}
        actions={
          <>
            <ButtonLink href="/dashboard/llamadas" variant="secondary">
              Ver llamadas
            </ButtonLink>
            <ButtonLink href="/dashboard/agentes">Probar agente</ButtonLink>
          </>
        }
      />

      {params.bienvenida ? (
        <Alert tone="success" title="¡Tu cuenta está lista!" className="mb-6">
          Creamos un agente recepcionista con una configuración inicial. Agrega tus inmuebles, ajusta su personalidad
          y pruébalo en el simulador.
        </Alert>
      ) : null}
      {!features.ai() ? (
        <Alert tone="warning" title="Falta configurar la IA" className="mb-6">
          Define <code>ANTHROPIC_API_KEY</code> en el entorno para que el agente pueda conversar y analizar llamadas.
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={PhoneCall} label="Llamadas hoy" value={data.callsToday} hint={`${data.calls30} en los últimos 30 días`} />
        <StatCard icon={UserPlus} label="Leads nuevos (7 días)" value={data.newLeads7} hint="Capturados por el agente y tu equipo" />
        <StatCard icon={CalendarDays} label="Citas próximas (7 días)" value={data.upcoming7} hint="Visitas, avalúos y reuniones" />
        <StatCard
          icon={TrendingUp}
          label="Llamadas → cita"
          value={`${data.conversion30}%`}
          hint={`Minutos usados: ${usage.minutesUsed} de ${usage.minutes}`}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Llamadas de los últimos 14 días" description="Entrantes, salientes y web" />
          <CardBody>
            <div className="flex h-48 items-end gap-1.5">
              {data.series.map((d) => (
                <div key={d.day} className="group flex flex-1 flex-col items-center gap-1">
                  <span className="text-[10px] tabular-nums text-slate-500 opacity-0 group-hover:opacity-100">{d.count}</span>
                  <div
                    className="w-full rounded-t-md bg-brand-500/80 transition-colors group-hover:bg-brand-600"
                    style={{ height: `${Math.max(4, (d.count / maxDay) * 160)}px` }}
                    title={`${d.day}: ${d.count} llamadas`}
                  />
                  <span className="text-[10px] text-slate-400">{d.day.slice(8)}</span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Primeros pasos"
            description={pending === 0 ? "¡Todo listo!" : `${pending} pendiente${pending === 1 ? "" : "s"}`}
          />
          <CardBody>
            <ul className="space-y-3">
              {checklist.map((item) => (
                <li key={item.label}>
                  <Link href={item.href} className="group flex items-center gap-3 text-sm">
                    {item.done ? (
                      <CheckCircle2 className="size-5 text-emerald-500" />
                    ) : (
                      <Circle className="size-5 text-slate-300" />
                    )}
                    <span className={cn(item.done ? "text-slate-400 line-through" : "text-slate-700 group-hover:text-brand-700")}>
                      {item.label}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Llamadas recientes"
            action={
              <Link href="/dashboard/llamadas" className="inline-flex items-center gap-1 text-sm font-medium text-brand-600">
                Ver todas <ArrowRight className="size-3.5" />
              </Link>
            }
          />
          {data.recentCalls.length === 0 ? (
            <EmptyState icon={PhoneCall} title="Aún no hay llamadas" description="Prueba tu agente en el simulador o conecta un número." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.recentCalls.map(({ call, leadName }) => (
                <li key={call.id}>
                  <Link href={`/dashboard/llamadas/${call.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {leadName ?? call.fromNumber ?? "Cliente sin identificar"}
                      </p>
                      <p className="truncate text-xs text-slate-500">{call.summary ?? "Sin resumen todavía"}</p>
                    </div>
                    <div className="hidden shrink-0 items-center gap-2 sm:flex">
                      <DirectionBadge direction={call.direction} />
                      <OutcomeBadge outcome={call.outcome} />
                    </div>
                    <div className="w-24 shrink-0 whitespace-nowrap text-right text-xs text-slate-500">
                      <p>{formatDate(call.createdAt, tz)}</p>
                      <p className="tabular-nums">
                        {formatTime(call.createdAt, tz)} · {formatDuration(call.durationSec)}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Próximas citas" />
            {data.upcomingAppointments.length === 0 ? (
              <EmptyState icon={CalendarDays} title="Sin citas próximas" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.upcomingAppointments.map(({ appointment, leadName }) => (
                  <li key={appointment.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="flex w-20 shrink-0 flex-col items-center rounded-lg bg-brand-50 py-1.5 text-brand-700">
                      <span className="text-[10px] font-medium uppercase">{formatDate(appointment.startsAt, tz)}</span>
                      <span className="whitespace-nowrap text-xs font-semibold">{formatTime(appointment.startsAt, tz)}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{leadName ?? appointment.title}</p>
                      <p className="text-xs text-slate-500">
                        {appointmentTypeLabels[appointment.type]}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Leads prioritarios"
              description="Calientes o que pidieron que los llamen"
            />
            {data.priorityLeads.length === 0 ? (
              <EmptyState icon={Clock} title="Nada urgente por ahora" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.priorityLeads.map((lead) => (
                  <li key={lead.id}>
                    <Link href={`/dashboard/leads/${lead.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{lead.name ?? lead.phone ?? "Sin nombre"}</p>
                        <p className="truncate text-xs text-slate-500">
                          {lead.needsFollowUp ? `📞 ${lead.followUpReason ?? "Pidió que lo llamen"}` : (lead.zones ?? "—")}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <TemperatureBadge temperature={lead.temperature} />
                        <ScoreBar score={lead.score} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
