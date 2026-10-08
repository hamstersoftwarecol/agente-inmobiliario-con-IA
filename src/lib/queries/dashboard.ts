import { and, count, desc, eq, gte, inArray, lt, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { agents, appointments, calls, leads, properties, type Organization } from "@/db/schema";
import { addDaysToDateKey, toDateKey, zonedTimeToUtc } from "@/lib/time";

export async function getDashboardData(org: Organization, now = new Date()) {
  const tz = org.timezone;
  const todayKey = toDateKey(now, tz);
  const startToday = zonedTimeToUtc(todayKey, "00:00", tz);
  const start14 = zonedTimeToUtc(addDaysToDateKey(todayKey, -13), "00:00", tz);
  const start30 = zonedTimeToUtc(addDaysToDateKey(todayKey, -29), "00:00", tz);
  const start7 = zonedTimeToUtc(addDaysToDateKey(todayKey, -6), "00:00", tz);
  const in7 = zonedTimeToUtc(addDaysToDateKey(todayKey, 7), "00:00", tz);
  const realCall = inArray(calls.direction, ["inbound", "outbound", "web"]);

  const dayExpr = sql<string>`to_char(${calls.createdAt} at time zone ${tz}, 'YYYY-MM-DD')`;

  const [
    [callsToday],
    [calls30],
    [booked30],
    [newLeads7],
    [upcoming7],
    perDay,
    recentCalls,
    upcomingAppointments,
    priorityLeads,
    [agentStats],
    [propertyCount],
    [simulatorCount],
  ] = await Promise.all([
    db.select({ n: count() }).from(calls).where(and(eq(calls.organizationId, org.id), realCall, gte(calls.createdAt, startToday))),
    db.select({ n: count() }).from(calls).where(and(eq(calls.organizationId, org.id), realCall, gte(calls.createdAt, start30))),
    db
      .select({ n: count() })
      .from(calls)
      .where(
        and(eq(calls.organizationId, org.id), realCall, gte(calls.createdAt, start30), eq(calls.outcome, "appointment_booked")),
      ),
    db.select({ n: count() }).from(leads).where(and(eq(leads.organizationId, org.id), gte(leads.createdAt, start7))),
    db
      .select({ n: count() })
      .from(appointments)
      .where(
        and(
          eq(appointments.organizationId, org.id),
          gte(appointments.startsAt, now),
          lt(appointments.startsAt, in7),
          ne(appointments.status, "cancelled"),
        ),
      ),
    db
      .select({ day: dayExpr, n: count() })
      .from(calls)
      .where(and(eq(calls.organizationId, org.id), realCall, gte(calls.createdAt, start14)))
      // Agrupamos por posición: la zona horaria va como parámetro y Postgres no reconoce
      // dos expresiones con parámetros distintos como la misma.
      .groupBy(sql`1`),
    db
      .select({ call: calls, leadName: leads.name })
      .from(calls)
      .leftJoin(leads, eq(leads.id, calls.leadId))
      .where(eq(calls.organizationId, org.id))
      .orderBy(desc(calls.createdAt))
      .limit(6),
    db
      .select({ appointment: appointments, leadName: leads.name, leadPhone: leads.phone })
      .from(appointments)
      .leftJoin(leads, eq(leads.id, appointments.leadId))
      .where(
        and(eq(appointments.organizationId, org.id), gte(appointments.startsAt, now), ne(appointments.status, "cancelled")),
      )
      .orderBy(appointments.startsAt)
      .limit(5),
    db
      .select()
      .from(leads)
      .where(and(eq(leads.organizationId, org.id), or(eq(leads.needsFollowUp, true), eq(leads.temperature, "hot"))))
      .orderBy(desc(leads.needsFollowUp), desc(leads.score))
      .limit(5),
    db
      .select({
        total: count(),
        withPhone: sql<number>`count(${agents.vapiPhoneNumberId})::int`,
      })
      .from(agents)
      .where(eq(agents.organizationId, org.id)),
    db.select({ n: count() }).from(properties).where(eq(properties.organizationId, org.id)),
    db.select({ n: count() }).from(calls).where(and(eq(calls.organizationId, org.id), eq(calls.direction, "simulator"))),
  ]);

  const counts = new Map(perDay.map((r) => [r.day, r.n]));
  const series = Array.from({ length: 14 }, (_, i) => {
    const day = addDaysToDateKey(todayKey, i - 13);
    return { day, count: counts.get(day) ?? 0 };
  });

  return {
    callsToday: callsToday.n,
    calls30: calls30.n,
    conversion30: calls30.n > 0 ? Math.round((booked30.n / calls30.n) * 100) : 0,
    newLeads7: newLeads7.n,
    upcoming7: upcoming7.n,
    series,
    recentCalls,
    upcomingAppointments,
    priorityLeads,
    setup: {
      agents: agentStats.total,
      agentsWithPhone: agentStats.withPhone,
      properties: propertyCount.n,
      simulations: simulatorCount.n,
    },
  };
}
