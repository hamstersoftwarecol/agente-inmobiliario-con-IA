import { and, count, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { agents, calls, type Organization } from "@/db/schema";
import { getEntitlements, type Entitlements } from "@/lib/plans";

export async function getMinutesUsed(organizationId: string, since: Date): Promise<number> {
  const [row] = await db
    .select({ seconds: sql<number>`coalesce(sum(${calls.durationSec}), 0)::int` })
    .from(calls)
    .where(
      and(
        eq(calls.organizationId, organizationId),
        inArray(calls.direction, ["inbound", "outbound", "web"]),
        gte(calls.createdAt, since),
      ),
    );
  return Math.ceil((row?.seconds ?? 0) / 60);
}

export type UsageSummary = Entitlements & {
  minutesUsed: number;
  minutesRemaining: number;
  agentsUsed: number;
  canUseVoice: boolean;
};

export async function getUsageSummary(org: Organization): Promise<UsageSummary> {
  const ent = getEntitlements(org);
  const [minutesUsed, [agentRow]] = await Promise.all([
    getMinutesUsed(org.id, ent.periodStart),
    db.select({ n: count() }).from(agents).where(eq(agents.organizationId, org.id)),
  ]);
  const minutesRemaining = Math.max(0, ent.minutes - minutesUsed);
  return {
    ...ent,
    minutesUsed,
    minutesRemaining,
    agentsUsed: agentRow?.n ?? 0,
    canUseVoice: ent.active && minutesRemaining > 0,
  };
}
