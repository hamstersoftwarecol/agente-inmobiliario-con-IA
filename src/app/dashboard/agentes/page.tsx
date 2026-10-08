import { asc, eq } from "drizzle-orm";
import { Bot, MessageSquare, Phone, PhoneIncoming, PhoneOutgoing } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { db } from "@/db";
import { agents } from "@/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { agentTemplates } from "@/lib/defaults";
import { getEntitlements } from "@/lib/plans";
import { createAgentAction } from "./actions";

export const metadata: Metadata = { title: "Agentes IA" };

export default async function AgentsPage() {
  const { organization: org } = await requireAuth();
  const rows = await db.select().from(agents).where(eq(agents.organizationId, org.id)).orderBy(asc(agents.createdAt));
  const ent = getEntitlements(org);
  const templates = agentTemplates(org.name);

  return (
    <>
      <PageHeader
        title="Agentes de IA"
        description={`Configura la personalidad, el conocimiento y la voz de tus recepcionistas virtuales. ${rows.length} de ${ent.agents} en tu plan.`}
      />

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((agent) => (
          <Card key={agent.id} className="flex flex-col">
            <CardBody className="flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-brand-600 text-white">
                    <Bot className="size-5" />
                  </span>
                  <div>
                    <h2 className="font-semibold">{agent.name}</h2>
                    <p className="text-xs text-slate-500">{agent.language === "en" ? "Inglés" : "Español"} · {agent.voiceId}</p>
                  </div>
                </div>
                <Badge tone={agent.isActive ? "green" : "gray"}>{agent.isActive ? "Activo" : "Pausado"}</Badge>
              </div>
              <p className="mt-4 line-clamp-3 text-sm text-slate-600">{agent.goal}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {agent.inboundEnabled ? (
                  <Badge tone="blue">
                    <PhoneIncoming className="size-3" /> Entrantes
                  </Badge>
                ) : null}
                {agent.outboundEnabled ? (
                  <Badge tone="purple">
                    <PhoneOutgoing className="size-3" /> Salientes
                  </Badge>
                ) : null}
                <Badge tone={agent.vapiPhoneNumberId ? "green" : "yellow"}>
                  <Phone className="size-3" /> {agent.phoneNumber ?? (agent.vapiPhoneNumberId ? "Número conectado" : "Sin número")}
                </Badge>
              </div>
            </CardBody>
            <div className="flex gap-2 border-t border-slate-100 px-5 py-3">
              <Link href={`/dashboard/agentes/${agent.id}`} className={buttonClass("secondary", "sm", "flex-1")}>
                Configurar
              </Link>
              <Link href={`/dashboard/agentes/${agent.id}/probar`} className={buttonClass("primary", "sm", "flex-1")}>
                <MessageSquare className="size-3.5" /> Probar
              </Link>
            </div>
          </Card>
        ))}

        <Card className="border-dashed">
          <CardHeader title="Nuevo agente" description="Parte de una plantilla y personalízala." />
          <CardBody>
            <ActionForm action={createAgentAction} submitLabel="Crear agente">
              <fieldset className="space-y-2">
                {templates.map((t, i) => (
                  <label
                    key={t.id}
                    className="flex cursor-pointer gap-3 rounded-lg p-3 ring-1 ring-slate-200 has-[:checked]:bg-brand-50 has-[:checked]:ring-brand-300"
                  >
                    <input type="radio" name="template" value={t.id} defaultChecked={i === 0} className="mt-1" />
                    <span>
                      <span className="block text-sm font-medium">{t.label}</span>
                      <span className="block text-xs text-slate-500">{t.description}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
            </ActionForm>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
