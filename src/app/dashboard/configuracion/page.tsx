import { CheckCircle2, XCircle } from "lucide-react";
import type { Metadata } from "next";
import { ActionForm } from "@/components/action-form";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, SelectOptions } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/misc";
import { requireAuth } from "@/lib/auth/session";
import { CURRENCY_OPTIONS, TIMEZONE_OPTIONS, WEEKDAY_NAMES } from "@/lib/defaults";
import { env, features } from "@/lib/env";
import {
  changePasswordAction,
  updateBookingAction,
  updateOrganizationAction,
  updateProfileAction,
} from "./actions";

export const metadata: Metadata = { title: "Configuración" };

function Integration({ ok, name, detail }: { ok: boolean; name: string; detail: string }) {
  return (
    <li className="flex items-start gap-3">
      {ok ? <CheckCircle2 className="mt-0.5 size-5 text-emerald-500" /> : <XCircle className="mt-0.5 size-5 text-slate-300" />}
      <div>
        <p className="text-sm font-medium">{name}</p>
        <p className="text-xs text-slate-500">{detail}</p>
      </div>
    </li>
  );
}

export default async function SettingsPage() {
  const { organization: org, user, role } = await requireAuth();
  const isAdmin = role !== "agent";
  const timezones = TIMEZONE_OPTIONS.includes(org.timezone as (typeof TIMEZONE_OPTIONS)[number])
    ? [...TIMEZONE_OPTIONS]
    : [org.timezone, ...TIMEZONE_OPTIONS];

  return (
    <>
      <PageHeader title="Configuración" description="Datos de la inmobiliaria, agenda de citas, integraciones y tu perfil." />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader title="Inmobiliaria" description="El agente comparte estos datos con los clientes." />
            <CardBody>
              <ActionForm action={updateOrganizationAction} submitLabel="Guardar" hideSubmit={!isAdmin}>
                <fieldset disabled={!isAdmin} className="grid gap-4 sm:grid-cols-2">
                  <Field label="Nombre" htmlFor="name">
                    <Input id="name" name="name" required defaultValue={org.name} />
                  </Field>
                  <Field label="Teléfono" htmlFor="phone">
                    <Input id="phone" name="phone" defaultValue={org.phone ?? ""} />
                  </Field>
                  <Field label="Dirección de la oficina" htmlFor="address" className="sm:col-span-2">
                    <Input id="address" name="address" defaultValue={org.address ?? ""} />
                  </Field>
                  <Field label="Sitio web" htmlFor="website">
                    <Input id="website" name="website" type="url" defaultValue={org.website ?? ""} />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Zona horaria" htmlFor="timezone">
                      <Select id="timezone" name="timezone" defaultValue={org.timezone}>
                        <SelectOptions options={timezones.map((t) => ({ value: t, label: t }))} />
                      </Select>
                    </Field>
                    <Field label="Moneda" htmlFor="currency">
                      <Select id="currency" name="currency" defaultValue={org.currency}>
                        <SelectOptions options={CURRENCY_OPTIONS.map((c) => ({ value: c, label: c }))} />
                      </Select>
                    </Field>
                  </div>
                </fieldset>
              </ActionForm>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Agenda de citas"
              description="El agente solo ofrece horarios dentro de este horario y sin cruces con otras citas."
            />
            <CardBody>
              <ActionForm action={updateBookingAction} submitLabel="Guardar agenda" hideSubmit={!isAdmin}>
                <fieldset disabled={!isAdmin} className="space-y-6">
                  <div className="grid gap-4 sm:grid-cols-4">
                    <Field label="Duración (min)" htmlFor="appointmentDurationMin">
                      <Input id="appointmentDurationMin" name="appointmentDurationMin" type="number" min={15} max={240} defaultValue={org.appointmentDurationMin} />
                    </Field>
                    <Field label="Margen entre citas (min)" htmlFor="appointmentBufferMin">
                      <Input id="appointmentBufferMin" name="appointmentBufferMin" type="number" min={0} max={120} defaultValue={org.appointmentBufferMin} />
                    </Field>
                    <Field label="Antelación mínima (h)" htmlFor="minNoticeHours">
                      <Input id="minNoticeHours" name="minNoticeHours" type="number" min={0} max={168} defaultValue={org.minNoticeHours} />
                    </Field>
                    <Field label="Reservar hasta (días)" htmlFor="bookingWindowDays">
                      <Input id="bookingWindowDays" name="bookingWindowDays" type="number" min={1} max={120} defaultValue={org.bookingWindowDays} />
                    </Field>
                  </div>
                  <div className="divide-y divide-slate-100 rounded-lg ring-1 ring-slate-200">
                    {WEEKDAY_NAMES.map((day, i) => {
                      const range = org.businessHours[String(i) as keyof typeof org.businessHours]?.[0];
                      return (
                        <div key={day} className="flex flex-wrap items-center gap-4 px-4 py-2.5">
                          <label className="flex w-36 items-center gap-2 text-sm font-medium">
                            <input type="checkbox" name={`open_${i}`} defaultChecked={!!range} className="rounded border-slate-300" />
                            {day}
                          </label>
                          <Input name={`start_${i}`} type="time" defaultValue={range?.start ?? "09:00"} className="w-32" aria-label={`Apertura ${day}`} />
                          <span className="text-sm text-slate-400">a</span>
                          <Input name={`end_${i}`} type="time" defaultValue={range?.end ?? "18:00"} className="w-32" aria-label={`Cierre ${day}`} />
                        </div>
                      );
                    })}
                  </div>
                </fieldset>
              </ActionForm>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Integraciones" description="Se configuran con variables de entorno." />
            <CardBody>
              <ul className="space-y-4">
                <Integration ok={features.ai()} name="Claude (Anthropic)" detail={`LLM del agente · modelo ${env().ANTHROPIC_MODEL}`} />
                <Integration ok={features.vapi()} name="Vapi (voz y telefonía)" detail="Llamadas entrantes y salientes" />
                <Integration ok={features.vapiWeb()} name="Vapi Web" detail="Llamadas de prueba desde el navegador" />
                <Integration ok={features.stripe()} name="Stripe" detail="Suscripciones y facturación" />
              </ul>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Tu perfil" description={user.email} />
            <CardBody>
              <ActionForm action={updateProfileAction} submitLabel="Guardar">
                <Field label="Nombre" htmlFor="profile-name">
                  <Input id="profile-name" name="name" required defaultValue={user.name} />
                </Field>
              </ActionForm>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Cambiar contraseña" />
            <CardBody>
              <ActionForm action={changePasswordAction} submitLabel="Actualizar contraseña">
                <Field label="Contraseña actual" htmlFor="currentPassword">
                  <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required />
                </Field>
                <Field label="Nueva contraseña" htmlFor="newPassword">
                  <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" minLength={8} required />
                </Field>
                <Field label="Confirmar contraseña" htmlFor="confirmPassword">
                  <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required />
                </Field>
              </ActionForm>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
