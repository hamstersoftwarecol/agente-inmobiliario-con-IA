import { sql } from "drizzle-orm";
import { db } from "@/db";
import { features } from "@/lib/env";

export const dynamic = "force-dynamic";

/** Health check para balanceadores y monitoreo. */
export async function GET() {
  let database = false;
  try {
    await db.execute(sql`select 1`);
    database = true;
  } catch {
    database = false;
  }
  const body = {
    status: database ? "ok" : "degraded",
    database,
    integrations: { ai: features.ai(), vapi: features.vapi(), stripe: features.stripe() },
    time: new Date().toISOString(),
  };
  return Response.json(body, { status: database ? 200 : 503 });
}
