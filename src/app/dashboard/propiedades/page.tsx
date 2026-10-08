import { and, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { Bath, BedDouble, Building2, Car, Plus, Ruler } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PropertyStatusBadge } from "@/components/domain-badges";
import { param } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import { ButtonLink, buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select, SelectOptions } from "@/components/ui/form";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { db } from "@/db";
import {
  properties,
  propertyOperationEnum,
  propertyStatusEnum,
  type PropertyOperation,
  type PropertyStatus,
} from "@/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { formatMoney } from "@/lib/format";
import { options, propertyOperationLabels, propertyStatusLabels, propertyTypeLabels } from "@/lib/labels";

export const metadata: Metadata = { title: "Propiedades" };

export default async function PropertiesPage({ searchParams }: PageProps<"/dashboard/propiedades">) {
  const { organization: org } = await requireAuth();
  const sp = await searchParams;
  const q = param(sp.q);
  const operation = param(sp.operacion) as PropertyOperation | undefined;
  const status = param(sp.estado) as PropertyStatus | undefined;

  const conditions: SQL[] = [eq(properties.organizationId, org.id)];
  if (q) {
    const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    conditions.push(
      or(
        ilike(properties.title, like),
        ilike(properties.reference, like),
        ilike(properties.city, like),
        ilike(properties.neighborhood, like),
      )!,
    );
  }
  if (operation && propertyOperationEnum.enumValues.includes(operation)) conditions.push(eq(properties.operation, operation));
  if (status && propertyStatusEnum.enumValues.includes(status)) conditions.push(eq(properties.status, status));

  const rows = await db
    .select()
    .from(properties)
    .where(and(...conditions))
    .orderBy(desc(properties.updatedAt))
    .limit(200);

  return (
    <>
      <PageHeader
        title="Propiedades"
        description="Inventario que tus agentes de IA consultan para responder y ofrecer inmuebles."
        actions={
          <ButtonLink href="/dashboard/propiedades/nueva">
            <Plus className="size-4" /> Nuevo inmueble
          </ButtonLink>
        }
      />

      <form className="mb-6 flex flex-wrap items-center gap-2">
        <Input name="q" defaultValue={q ?? ""} placeholder="Buscar por referencia, título o zona" className="h-9 max-w-xs" />
        <Select name="operacion" defaultValue={operation ?? ""} className="h-9 w-36">
          <SelectOptions options={options(propertyOperationLabels)} placeholder="Venta y arriendo" />
        </Select>
        <Select name="estado" defaultValue={status ?? ""} className="h-9 w-40">
          <SelectOptions options={options(propertyStatusLabels)} placeholder="Todos los estados" />
        </Select>
        <button type="submit" className={buttonClass("secondary")}>
          Filtrar
        </button>
      </form>

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={Building2}
            title="Aún no tienes inmuebles"
            description="Agrega tu inventario para que el agente pueda responder precios y características reales."
            action={<ButtonLink href="/dashboard/propiedades/nueva">Agregar inmueble</ButtonLink>}
          />
        </Card>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((p) => (
            <Link
              key={p.id}
              href={`/dashboard/propiedades/${p.id}`}
              className="group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
            >
              <div className="relative flex h-36 items-center justify-center bg-gradient-to-br from-brand-50 to-slate-100">
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- URLs externas arbitrarias del cliente
                  <img src={p.imageUrl} alt={p.title} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <Building2 className="size-10 text-brand-200" />
                )}
                <div className="absolute left-3 top-3 flex gap-1.5">
                  <Badge tone={p.operation === "sale" ? "blue" : "purple"}>{propertyOperationLabels[p.operation]}</Badge>
                  <PropertyStatusBadge status={p.status} />
                </div>
              </div>
              <div className="p-4">
                <p className="font-mono text-xs text-slate-400">{p.reference}</p>
                <h3 className="mt-0.5 line-clamp-1 font-medium text-slate-900 group-hover:text-brand-700">{p.title}</h3>
                <p className="text-xs text-slate-500">
                  {propertyTypeLabels[p.type]} · {[p.neighborhood, p.city].filter(Boolean).join(", ")}
                </p>
                <p className="mt-3 text-lg font-semibold text-slate-900">
                  {formatMoney(p.price, p.currency)}
                  {p.operation === "rent" ? <span className="text-xs font-normal text-slate-500"> /mes</span> : null}
                </p>
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                  {p.bedrooms != null ? (
                    <span className="inline-flex items-center gap-1">
                      <BedDouble className="size-3.5" /> {p.bedrooms}
                    </span>
                  ) : null}
                  {p.bathrooms != null ? (
                    <span className="inline-flex items-center gap-1">
                      <Bath className="size-3.5" /> {p.bathrooms}
                    </span>
                  ) : null}
                  {p.areaM2 != null ? (
                    <span className="inline-flex items-center gap-1">
                      <Ruler className="size-3.5" /> {p.areaM2} m²
                    </span>
                  ) : null}
                  {p.parking != null ? (
                    <span className="inline-flex items-center gap-1">
                      <Car className="size-3.5" /> {p.parking}
                    </span>
                  ) : null}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
