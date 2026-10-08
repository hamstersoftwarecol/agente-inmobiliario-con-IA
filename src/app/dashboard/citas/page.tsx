import { and, asc, desc, eq, gte, inArray, lt, type SQL } from "drizzle-orm";
import { CalendarDays, Clock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { AppointmentStatusBadge } from "@/components/domain-badges";
import { param } from "@/components/pagination";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Checkbox, Field, Input, Select, SelectOptions, Textarea } from "@/components/ui/form";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { db } from "@/db";
import { appointments, leads, properties, type Appointment } from "@/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { findNextAvailableDays } from "@/lib/booking/availability";
import { formatLongDate, formatTime } from "@/lib/format";
import { appointmentTypeLabels, options } from "@/lib/labels";
import { bookingSettings, getBusyForWindow } from "@/lib/services/booking";
import { addDaysToDateKey, toDateKey, zonedTimeToUtc } from "@/lib/time";
import { createAppointmentAction, setAppointmentStatusAction } from "./actions";

export const metadata: Metadata = { title: "Citas" };

type Row = { appointment: Appointment; leadName: string | null; leadPhone: string | null; propertyRef: string | null };

function groupByDay(rows: Row[], tz: string) {
  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    const key = toDateKey(row.appointment.startsAt, tz);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.entries()];
}

function AppointmentItem({ row, tz, past }: { row: Row; tz: string; past?: boolean }) {
  const { appointment: a } = row;
  const nextStatuses: { status: string; label: string }[] = past
    ? [
        { status: "completed", label: "Realizada" },
        { status: "no_show", label: "No asistió" },
      ]
    : [
        { status: "confirmed", label: "Confirmar" },
        { status: "cancelled", label: "Cancelar" },
      ];
  return (
    <li className="flex flex-wrap items-center gap-4 px-5 py-3">
      <div className="w-20 shrink-0 whitespace-nowrap text-sm font-semibold tabular-nums text-slate-900">{formatTime(a.startsAt, tz)}</div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {a.leadId ? (
            <Link href={`/dashboard/leads/${a.leadId}`} className="hover:text-brand-700">
              {row.leadName ?? a.title}
            </Link>
          ) : (
            a.title
          )}
        </p>
        <p className="truncate text-xs text-slate-500">
          {appointmentTypeLabels[a.type]}
          {row.propertyRef ? ` · ${row.propertyRef}` : ""}
          {row.leadPhone ? ` · ${row.leadPhone}` : ""}
          {a.source === "ai" ? " · agendada por IA" : ""}
        </p>
      </div>
      <AppointmentStatusBadge status={a.status} />
      {a.status !== "cancelled" && a.status !== "completed" ? (
        <div className="flex gap-1">
          {nextStatuses
            .filter((s) => s.status !== a.status)
            .map((s) => (
              <form key={s.status} action={setAppointmentStatusAction.bind(null, a.id, s.status)}>
                <SubmitButton variant={s.status === "cancelled" ? "ghost" : "secondary"}>{s.label}</SubmitButton>
              </form>
            ))}
        </div>
      ) : null}
    </li>
  );
}

export default async function AppointmentsPage({ searchParams }: PageProps<"/dashboard/citas">) {
  const { organization: org } = await requireAuth();
  const sp = await searchParams;
  const preselectedLead = param(sp.lead);
  const tz = org.timezone;
  const now = new Date();
  const todayKey = toDateKey(now, tz);
  const startToday = zonedTimeToUtc(todayKey, "00:00", tz);

  const select = {
    appointment: appointments,
    leadName: leads.name,
    leadPhone: leads.phone,
    propertyRef: properties.reference,
  };
  const base = (extra: SQL) =>
    db
      .select(select)
      .from(appointments)
      .leftJoin(leads, eq(leads.id, appointments.leadId))
      .leftJoin(properties, eq(properties.id, appointments.propertyId))
      .where(and(eq(appointments.organizationId, org.id), extra));

  const [upcoming, past, leadOptions, propertyOptions, busy] = await Promise.all([
    base(gte(appointments.startsAt, startToday)).orderBy(asc(appointments.startsAt)).limit(100),
    base(
      and(
        lt(appointments.startsAt, startToday),
        gte(appointments.startsAt, zonedTimeToUtc(addDaysToDateKey(todayKey, -14), "00:00", tz)),
      )!,
    )
      .orderBy(desc(appointments.startsAt))
      .limit(50),
    db
      .select({ id: leads.id, name: leads.name, phone: leads.phone })
      .from(leads)
      .where(eq(leads.organizationId, org.id))
      .orderBy(desc(leads.updatedAt))
      .limit(200),
    db
      .select({ id: properties.id, reference: properties.reference, title: properties.title })
      .from(properties)
      .where(and(eq(properties.organizationId, org.id), inArray(properties.status, ["available", "reserved"])))
      .orderBy(asc(properties.reference)),
    getBusyForWindow(org, now),
  ]);

  const nextSlots = findNextAvailableDays(todayKey, bookingSettings(org), busy, { maxDays: 3, maxSlotsPerDay: 6, now });

  return (
    <>
      <PageHeader title="Citas" description="Visitas, avalúos y reuniones agendadas por tus agentes de IA y tu equipo." />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader title="Próximas citas" />
            {upcoming.length === 0 ? (
              <EmptyState icon={CalendarDays} title="No hay citas próximas" description="Cuando el agente agende visitas aparecerán aquí." />
            ) : (
              groupByDay(upcoming, tz).map(([day, rows]) => (
                <div key={day}>
                  <h3 className="bg-slate-50 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {day === todayKey ? "Hoy · " : ""}
                    {formatLongDate(rows[0].appointment.startsAt, tz)}
                  </h3>
                  <ul className="divide-y divide-slate-100">
                    {rows.map((row) => (
                      <AppointmentItem key={row.appointment.id} row={row} tz={tz} />
                    ))}
                  </ul>
                </div>
              ))
            )}
          </Card>

          {past.length > 0 ? (
            <Card>
              <CardHeader title="Últimos 14 días" description="Marca si la cita se realizó" />
              <ul className="divide-y divide-slate-100">
                {past.map((row) => (
                  <AppointmentItem key={row.appointment.id} row={row} tz={tz} past />
                ))}
              </ul>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Nueva cita" />
            <CardBody>
              <ActionForm action={createAppointmentAction} submitLabel="Agendar">
                <Field label="Lead" htmlFor="leadId">
                  <Select id="leadId" name="leadId" defaultValue={preselectedLead ?? ""}>
                    <SelectOptions
                      placeholder="Sin lead"
                      options={leadOptions.map((l) => ({ value: l.id, label: l.name ?? l.phone ?? "Sin nombre" }))}
                    />
                  </Select>
                </Field>
                <Field label="Tipo" htmlFor="type">
                  <Select id="type" name="type" defaultValue="visit">
                    <SelectOptions options={options(appointmentTypeLabels)} />
                  </Select>
                </Field>
                <Field label="Inmueble" htmlFor="propertyId">
                  <Select id="propertyId" name="propertyId" defaultValue="">
                    <SelectOptions
                      placeholder="Ninguno"
                      options={propertyOptions.map((p) => ({ value: p.id, label: `${p.reference} · ${p.title}` }))}
                    />
                  </Select>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Fecha" htmlFor="date">
                    <Input id="date" name="date" type="date" required min={todayKey} defaultValue={nextSlots[0]?.dateKey ?? todayKey} />
                  </Field>
                  <Field label="Hora" htmlFor="time">
                    <Input id="time" name="time" type="time" required step={300} defaultValue={nextSlots[0]?.slots[0]?.time ?? "10:00"} />
                  </Field>
                </div>
                <Field label="Notas" htmlFor="notes">
                  <Textarea id="notes" name="notes" rows={2} />
                </Field>
                <Checkbox name="allowOutside" label="Permitir fuera de disponibilidad" />
              </ActionForm>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title={
                <span className="inline-flex items-center gap-2">
                  <Clock className="size-4 text-brand-600" /> Próximos horarios libres
                </span>
              }
              description={`Citas de ${org.appointmentDurationMin} min · margen de ${org.appointmentBufferMin} min`}
            />
            <CardBody className="space-y-3">
              {nextSlots.length === 0 ? (
                <p className="text-sm text-slate-500">No hay disponibilidad. Revisa tu horario en Configuración.</p>
              ) : (
                nextSlots.map((day) => (
                  <div key={day.dateKey}>
                    <p className="text-xs font-medium text-slate-500 first-letter:uppercase">
                      {formatLongDate(zonedTimeToUtc(day.dateKey, "12:00", tz), tz)}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {day.slots.map((s) => (
                        <span key={s.time} className="rounded-md bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                          {s.time}
                        </span>
                      ))}
                    </div>
                  </div>
                ))
              )}
              <Link href="/dashboard/configuracion" className="block text-xs font-medium text-brand-600">
                Ajustar horario de atención →
              </Link>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
