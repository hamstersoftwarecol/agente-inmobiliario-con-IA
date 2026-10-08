import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { agents, organizations, type Agent, type Organization } from "@/db/schema";

export type AgentWithOrg = { agent: Agent; org: Organization };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getAgentWithOrg(agentId: string, organizationId?: string): Promise<AgentWithOrg | undefined> {
  if (!UUID_RE.test(agentId)) return undefined;
  const [row] = await db
    .select({ agent: agents, org: organizations })
    .from(agents)
    .innerJoin(organizations, eq(organizations.id, agents.organizationId))
    .where(organizationId ? and(eq(agents.id, agentId), eq(agents.organizationId, organizationId)) : eq(agents.id, agentId))
    .limit(1);
  return row;
}

export async function getAgentByVapiPhoneNumber(phoneNumberId: string): Promise<AgentWithOrg | undefined> {
  const [row] = await db
    .select({ agent: agents, org: organizations })
    .from(agents)
    .innerJoin(organizations, eq(organizations.id, agents.organizationId))
    .where(eq(agents.vapiPhoneNumberId, phoneNumberId))
    .limit(1);
  return row;
}

export function isUuid(value: string | null | undefined): value is string {
  return !!value && UUID_RE.test(value);
}
