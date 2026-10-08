import { ArrowLeft, MessageSquare, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Checkbox, Field, Input, Select, SelectOptions, Textarea } from "@/components/ui/form";
import { Alert, PageHeader } from "@/components/ui/misc";
import { requireAuth } from "@/lib/auth/session";
import { buildSystemPrompt } from "@/lib/ai/prompt";
import { VOICE_OPTIONS } from "@/lib/defaults";
import { env, features } from "@/lib/env";
import { getAgentWithOrg } from "@/lib/services/agents";
import { phoneWebhookUrl } from "@/lib/voice/vapi";
import { deleteAgentAction, updateAgentAction } from "../actions";

export const metadata: Metadata = { title: "Configurar agente" };

const VOICE_PROVIDERS = ["azure", "11labs", "cartesia", "openai", "vapi", "deepgram", "playht", "rime-ai"];

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-6 border-b border-slate-100 pb-8 last:border-0 lg:grid-cols-3">
      <div>
        <h2 className="font-semibold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      <div className="space-y-4 lg:col-span-2">{children}</div>
    </section>
  );
}

export default async function AgentPage({ params, searchParams }: PageProps<"/dashboard/agentes/[id]">) {
  const { organization: org } = await requireAuth();
  const { id } = await params;
  const sp = await searchParams;
  const found = await getAgentWithOrg(id, org.id);
  if (!found) notFound();
  const { agent } = found;

  const promptPreview = buildSystemPrompt({ org, agent, channel: "phone", direction: "inbound" });

  return (
    <>
      <Link href="/dashboard/agentes" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="size-4" /> Agentes
      </Link>
      <PageHeader
        title={agent.name}
        description="Configuración dinámica: los cambios se aplican en la siguiente llamada, sin redesplegar."
        actions={
          <>
            <ButtonLink href={`/dashboard/agentes/${agent.id}/probar`}>
              <MessageSquare className="size-4" /> Probar agente
            </ButtonLink>
            <form action={deleteAgentAction.bind(null, agent.id)}>
              <SubmitButton variant="ghost" size="md" confirm="¿Eliminar este agente?">
                <Trash2 className="size-4" /> Eliminar
              </SubmitButton>
            </form>
          </>
        }
      />
      {sp.error === "ultimo" ? (
        <Alert tone="warning" title="Debes conservar al menos un agente." className="mb-6" />
      ) : null}

      <div className="grid gap-6 xl:grid-cols-4">
        <Card className="xl:col-span-3">
          <CardBody className="py-6">
            <ActionForm action={updateAgentAction.bind(null, agent.id)} submitLabel="Guardar agente" className="space-y-8">
              <Section title="Identidad" description="Cómo se presenta y qué objetivo persigue en cada conversación.">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Nombre del agente" htmlFor="name">
                    <Input id="name" name="name" required defaultValue={agent.name} />
                  </Field>
                  <Field label="Idioma" htmlFor="language">
                    <Select id="language" name="language" defaultValue={agent.language}>
                      <option value="es">Español</option>
                      <option value="en">Inglés</option>
                    </Select>
                  </Field>
                </div>
                <Field label="Objetivo" htmlFor="goal">
                  <Textarea id="goal" name="goal" rows={2} defaultValue={agent.goal} />
                </Field>
                <Field label="Saludo inicial" htmlFor="greeting" hint="Es lo primero que dice al contestar.">
                  <Textarea id="greeting" name="greeting" rows={2} required defaultValue={agent.greeting} />
                </Field>
                <Field label="Personalidad y tono" htmlFor="personality">
                  <Textarea id="personality" name="personality" rows={2} defaultValue={agent.personality} />
                </Field>
                <Checkbox name="isActive" defaultChecked={agent.isActive} label="Agente activo (atiende llamadas)" />
              </Section>

              <Section
                title="Conocimiento"
                description="Lo que el agente debe saber de tu negocio. El inventario y la agenda los consulta en tiempo real."
              >
                <Field label="Información de la inmobiliaria" htmlFor="agencyInfo" hint="Servicios, comisiones, zonas en las que operan, requisitos de arriendo…">
                  <Textarea id="agencyInfo" name="agencyInfo" rows={5} defaultValue={agent.agencyInfo} />
                </Field>
                <Field label="Preguntas de calificación" htmlFor="qualificationQuestions" hint="Una por línea.">
                  <Textarea id="qualificationQuestions" name="qualificationQuestions" rows={5} defaultValue={agent.qualificationQuestions} />
                </Field>
                <Field label="Instrucciones adicionales" htmlFor="instructions">
                  <Textarea id="instructions" name="instructions" rows={4} defaultValue={agent.instructions} />
                </Field>
              </Section>

              <Section title="Voz y telefonía" description="Voz con la que habla y número de teléfono (Vapi) que atiende.">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Proveedor de voz" htmlFor="voiceProvider">
                    <Select id="voiceProvider" name="voiceProvider" defaultValue={agent.voiceProvider}>
                      <SelectOptions options={VOICE_PROVIDERS.map((p) => ({ value: p, label: p }))} />
                    </Select>
                  </Field>
                  <Field label="Voz" htmlFor="voiceId" hint="ID de la voz del proveedor. Sugerencias para Azure en la lista.">
                    <Input id="voiceId" name="voiceId" list="voice-options" required defaultValue={agent.voiceId} />
                    <datalist id="voice-options">
                      {VOICE_OPTIONS.map((v) => (
                        <option key={v.voiceId} value={v.voiceId}>
                          {v.label}
                        </option>
                      ))}
                    </datalist>
                  </Field>
                  <Field label="Número de teléfono" htmlFor="phoneNumber" hint="Solo informativo, ej. +576015550123">
                    <Input id="phoneNumber" name="phoneNumber" defaultValue={agent.phoneNumber ?? ""} />
                  </Field>
                  <Field label="ID del número en Vapi" htmlFor="vapiPhoneNumberId" hint="Phone Number ID del panel de Vapi.">
                    <Input id="vapiPhoneNumberId" name="vapiPhoneNumberId" defaultValue={agent.vapiPhoneNumberId ?? ""} />
                  </Field>
                  <Field label="Duración máxima de llamada (min)" htmlFor="maxCallDurationMin">
                    <Input
                      id="maxCallDurationMin"
                      name="maxCallDurationMin"
                      type="number"
                      min={1}
                      max={60}
                      defaultValue={agent.maxCallDurationMin}
                    />
                  </Field>
                </div>
                <div className="flex flex-wrap gap-6">
                  <Checkbox name="inboundEnabled" defaultChecked={agent.inboundEnabled} label="Atender llamadas entrantes" />
                  <Checkbox name="outboundEnabled" defaultChecked={agent.outboundEnabled} label="Permitir llamadas salientes" />
                </div>
              </Section>
            </ActionForm>
          </CardBody>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Conexión telefónica" />
            <CardBody className="space-y-3 text-sm text-slate-600">
              {features.vapi() ? (
                <>
                  <p>En el panel de Vapi, configura tu número con:</p>
                  <ol className="list-decimal space-y-1 pl-4 text-xs">
                    <li>Sin asistente asignado (lo enviamos dinámicamente).</li>
                    <li>
                      Server URL: <code className="break-all rounded bg-slate-100 px-1">{phoneWebhookUrl()}</code>
                    </li>
                    <li>
                      Server URL Secret: el valor de <code>VAPI_WEBHOOK_SECRET</code>.
                    </li>
                    <li>Copia el ID del número en el campo «ID del número en Vapi».</li>
                  </ol>
                </>
              ) : (
                <Alert tone="warning" title="Vapi no configurado">
                  Agrega <code>VAPI_API_KEY</code> y <code>VAPI_WEBHOOK_SECRET</code>. Mientras tanto puedes probar el agente
                  en el simulador de chat.
                </Alert>
              )}
              <p className="text-xs text-slate-500">URL pública actual: {env().APP_URL}</p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Prompt generado" description="Lo que recibe el modelo de IA" />
            <CardBody>
              <details>
                <summary className="cursor-pointer text-sm font-medium text-brand-600">Ver prompt de sistema</summary>
                <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-900 p-3 text-[11px] leading-relaxed text-slate-100">
                  {promptPreview}
                </pre>
              </details>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
