import { Field, Input, Select, SelectOptions, Textarea } from "@/components/ui/form";
import type { Property } from "@/db/schema";
import { CURRENCY_OPTIONS } from "@/lib/defaults";
import { options, propertyOperationLabels, propertyStatusLabels, propertyTypeLabels } from "@/lib/labels";

export function PropertyFields({ property, currency }: { property?: Property; currency: string }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Referencia" htmlFor="reference" hint="Código único que el agente menciona (ej. HZ-101).">
        <Input id="reference" name="reference" required defaultValue={property?.reference ?? ""} />
      </Field>
      <Field label="Título" htmlFor="title">
        <Input id="title" name="title" required defaultValue={property?.title ?? ""} />
      </Field>
      <Field label="Operación" htmlFor="operation">
        <Select id="operation" name="operation" defaultValue={property?.operation ?? "sale"}>
          <SelectOptions options={options(propertyOperationLabels)} />
        </Select>
      </Field>
      <Field label="Tipo" htmlFor="type">
        <Select id="type" name="type" defaultValue={property?.type ?? "apartment"}>
          <SelectOptions options={options(propertyTypeLabels)} />
        </Select>
      </Field>
      <Field label="Precio" htmlFor="price" hint="Para arriendos, el canon mensual.">
        <Input id="price" name="price" required inputMode="numeric" defaultValue={property?.price ?? ""} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Moneda" htmlFor="currency">
          <Select id="currency" name="currency" defaultValue={property?.currency ?? currency}>
            <SelectOptions options={CURRENCY_OPTIONS.map((c) => ({ value: c, label: c }))} />
          </Select>
        </Field>
        <Field label="Estado" htmlFor="status">
          <Select id="status" name="status" defaultValue={property?.status ?? "available"}>
            <SelectOptions options={options(propertyStatusLabels)} />
          </Select>
        </Field>
      </div>
      <Field label="Ciudad" htmlFor="city">
        <Input id="city" name="city" required defaultValue={property?.city ?? ""} />
      </Field>
      <Field label="Barrio / sector" htmlFor="neighborhood">
        <Input id="neighborhood" name="neighborhood" defaultValue={property?.neighborhood ?? ""} />
      </Field>
      <Field label="Dirección" htmlFor="address" className="sm:col-span-2">
        <Input id="address" name="address" defaultValue={property?.address ?? ""} />
      </Field>
      <div className="grid grid-cols-4 gap-3 sm:col-span-2">
        <Field label="Habitaciones" htmlFor="bedrooms">
          <Input id="bedrooms" name="bedrooms" type="number" min={0} defaultValue={property?.bedrooms ?? ""} />
        </Field>
        <Field label="Baños" htmlFor="bathrooms">
          <Input id="bathrooms" name="bathrooms" type="number" min={0} defaultValue={property?.bathrooms ?? ""} />
        </Field>
        <Field label="Área (m²)" htmlFor="areaM2">
          <Input id="areaM2" name="areaM2" type="number" min={0} defaultValue={property?.areaM2 ?? ""} />
        </Field>
        <Field label="Parqueaderos" htmlFor="parking">
          <Input id="parking" name="parking" type="number" min={0} defaultValue={property?.parking ?? ""} />
        </Field>
      </div>
      <Field label="Descripción" htmlFor="description" className="sm:col-span-2" hint="El agente usa este texto para responder preguntas.">
        <Textarea id="description" name="description" rows={4} defaultValue={property?.description ?? ""} />
      </Field>
      <Field label="Características" htmlFor="features" className="sm:col-span-2" hint="Separadas por comas.">
        <Input id="features" name="features" defaultValue={property?.features.join(", ") ?? ""} placeholder="Balcón, Gimnasio, Piscina" />
      </Field>
      <Field label="URL de imagen" htmlFor="imageUrl" className="sm:col-span-2">
        <Input id="imageUrl" name="imageUrl" type="url" defaultValue={property?.imageUrl ?? ""} placeholder="https://…" />
      </Field>
    </div>
  );
}
