import { and, eq, gt, lt, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { appointments, type AppointmentType, type Organization } from "@/db/schema";
import { isSlotAvailable, type BookingSettings, type BusyInterval } from "@/lib/booking/availability";
import { addDaysToDateKey, toDateKey, toTimeKey, zonedTimeToUtc } from "@/lib/time";

export function bookingSettings(org: Organization): BookingSettings {
  return {
    timeZone: org.timezone,
    businessHours: org.businessHours,
    durationMin: org.appointmentDurationMin,
    bufferMin: org.appointmentBufferMin,
    minNoticeHours: org.minNoticeHours,
    bookingWindowDays: org.bookingWindowDays,
  };
}

export async function getBusyIntervals(
  organizationId: string,
  from: Date,
  to: Date,
  executor: Pick<typeof db, "select"> = db,
): Promise<BusyInterval[]> {
  const rows = await executor
    .select({ start: appointments.startsAt, end: appointments.endsAt })
    .from(appointments)
    .where(
      and(
        eq(appointments.organizationId, organizationId),
        ne(appointments.status, "cancelled"),
        lt(appointments.startsAt, to),
        gt(appointments.endsAt, from),
      ),
    );
  return rows;
}

/** Intervalos ocupados que cubren toda la ventana de reservas de la inmobiliaria. */
export async function getBusyForWindow(org: Organization, now = new Date()) {
  const from = zonedTimeToUtc(addDaysToDateKey(toDateKey(now, org.timezone), -1), "00:00", org.timezone);
  const to = zonedTimeToUtc(addDaysToDateKey(toDateKey(now, org.timezone), org.bookingWindowDays + 2), "00:00", org.timezone);
  return getBusyIntervals(org.id, from, to);
}

export class SlotUnavailableError extends Error {
  constructor() {
    super("El horario solicitado ya no está disponible.");
  }
}

/**
 * Reserva una cita validando disponibilidad dentro de una transacción con bloqueo
 * por inmobiliaria, para evitar dobles reservas cuando dos llamadas agendan a la vez.
 */
export async function bookAppointment(input: {
  org: Organization;
  dateKey: string;
  time: string;
  type: AppointmentType;
  title: string;
  leadId: string | null;
  propertyId?: string | null;
  callId?: string | null;
  notes?: string | null;
  source: "ai" | "manual";
  enforceAvailability?: boolean;
}) {
  const { org } = input;
  const settings = bookingSettings(org);
  const startsAt = zonedTimeToUtc(input.dateKey, input.time, org.timezone);
  const endsAt = new Date(startsAt.getTime() + org.appointmentDurationMin * 60 * 1000);

  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${org.id}))`);

    if (input.enforceAvailability !== false) {
      const dayStart = zonedTimeToUtc(input.dateKey, "00:00", org.timezone);
      const dayEnd = zonedTimeToUtc(addDaysToDateKey(input.dateKey, 1), "00:00", org.timezone);
      const busy = await getBusyIntervals(org.id, dayStart, dayEnd, tx);
      if (!isSlotAvailable(input.dateKey, input.time, settings, busy)) {
        throw new SlotUnavailableError();
      }
    }

    const [appointment] = await tx
      .insert(appointments)
      .values({
        organizationId: org.id,
        leadId: input.leadId,
        propertyId: input.propertyId ?? null,
        callId: input.callId ?? null,
        type: input.type,
        title: input.title,
        startsAt,
        endsAt,
        notes: input.notes ?? null,
        source: input.source,
      })
      .returning();
    return appointment;
  });
}

export function describeSlot(date: Date, timeZone: string) {
  return { dateKey: toDateKey(date, timeZone), time: toTimeKey(date, timeZone) };
}
