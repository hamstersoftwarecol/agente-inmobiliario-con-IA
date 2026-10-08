import { Field, Input, Select, SelectOptions, Textarea } from "@/components/ui/form";
import type { Lead } from "@/db/schema";
import {
  leadFinancingLabels,
  leadIntentLabels,
  leadStatusLabels,
  leadTimelineLabels,
  options,
  propertyTypeLabels,
} from "@/lib/labels";

/** Campos del formulario de lead (crear y editar). */
export function LeadFields({ lead, currency }: { lead?: Lead; currency: string }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Nombre" htmlFor="name">
        <Input id="name" name="name" defaultValue={lead?.name ?? ""} />
      </Field>
      <Field label="Teléfono" htmlFor="phone" hint="Formato internacional para llamadas: +573001234567">
        <Input id="phone" name="phone" type="tel" defaultValue={lead?.phone ?? ""} />
      </Field>
      <Field label="Correo" htmlFor="email">
        <Input id="email" name="email" type="email" defaultValue={lead?.email ?? ""} />
      </Field>
      <Field label="Estado" htmlFor="status">
        <Select id="status" name="status" defaultValue={lead?.status ?? "new"}>
          <SelectOptions options={options(leadStatusLabels)} />
        </Select>
      </Field>
      <Field label="Intención" htmlFor="intent">
        <Select id="intent" name="intent" defaultValue={lead?.intent ?? ""}>
          <SelectOptions options={options(leadIntentLabels)} placeholder="Sin definir" />
        </Select>
      </Field>
      <Field label="Tipo de inmueble" htmlFor="propertyType">
        <Select id="propertyType" name="propertyType" defaultValue={lead?.propertyType ?? ""}>
          <SelectOptions options={options(propertyTypeLabels)} placeholder="Sin definir" />
        </Select>
      </Field>
      <Field label={`Presupuesto mínimo (${currency})`} htmlFor="budgetMin">
        <Input id="budgetMin" name="budgetMin" inputMode="numeric" defaultValue={lead?.budgetMin ?? ""} />
      </Field>
      <Field label={`Presupuesto máximo (${currency})`} htmlFor="budgetMax">
        <Input id="budgetMax" name="budgetMax" inputMode="numeric" defaultValue={lead?.budgetMax ?? ""} />
      </Field>
      <Field label="Zonas de interés" htmlFor="zones">
        <Input id="zones" name="zones" defaultValue={lead?.zones ?? ""} placeholder="Chicó, Rosales…" />
      </Field>
      <Field label="Habitaciones" htmlFor="bedrooms">
        <Input id="bedrooms" name="bedrooms" type="number" min={0} defaultValue={lead?.bedrooms ?? ""} />
      </Field>
      <Field label="Plazo" htmlFor="timeline">
        <Select id="timeline" name="timeline" defaultValue={lead?.timeline ?? "unknown"}>
          <SelectOptions options={options(leadTimelineLabels)} />
        </Select>
      </Field>
      <Field label="Financiación" htmlFor="financing">
        <Select id="financing" name="financing" defaultValue={lead?.financing ?? "unknown"}>
          <SelectOptions options={options(leadFinancingLabels)} />
        </Select>
      </Field>
      <Field label="Notas" htmlFor="notes" className="sm:col-span-2">
        <Textarea id="notes" name="notes" rows={4} defaultValue={lead?.notes ?? ""} />
      </Field>
    </div>
  );
}
