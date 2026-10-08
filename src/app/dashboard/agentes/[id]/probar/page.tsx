import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert, PageHeader } from "@/components/ui/misc";
import { requireAuth } from "@/lib/auth/session";
import { features } from "@/lib/env";
import { getAgentWithOrg } from "@/lib/services/agents";
import { Simulator } from "./simulator";
import { WebCall } from "./web-call";

export const metadata: Metadata = { title: "Probar agente" };

export default async function TestAgentPage({ params }: PageProps<"/dashboard/agentes/[id]/probar">) {
  const { organization: org } = await requireAuth();
  const { id } = await params;
  const found = await getAgentWithOrg(id, org.id);
  if (!found) notFound();
  const { agent } = found;

  return (
    <>
      <Link href={`/dashboard/agentes/${agent.id}`} className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="size-4" /> Configuración de {agent.name}
      </Link>
      <PageHeader
        title={`Probar a ${agent.name}`}
        description="Conversa como si fueras un cliente. El agente usa tu inventario y agenda reales; los leads y citas que cree quedan marcados como «Simulador»."
      />
      {!features.ai() ? (
        <Alert tone="warning" title="Falta ANTHROPIC_API_KEY" className="mb-6">
          El agente necesita acceso al modelo de lenguaje para conversar.
        </Alert>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Simulator agentId={agent.id} greeting={agent.greeting} language={agent.language} aiEnabled={features.ai()} />
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Llamada de voz" description="Prueba la experiencia telefónica real desde el navegador." />
            <CardBody>
              <WebCall agentId={agent.id} enabled={features.vapiWeb()} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Qué puedes probar" />
            <CardBody>
              <ul className="list-disc space-y-1.5 pl-4 text-sm text-slate-600">
                <li>Preguntar por inmuebles por zona, precio o habitaciones.</li>
                <li>Pedir detalles de una referencia concreta.</li>
                <li>Agendar una visita o un avalúo (revisa luego la sección Citas).</li>
                <li>Pedir hablar con un asesor humano.</li>
                <li>Al terminar, la IA resume la conversación y califica el lead.</li>
              </ul>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
