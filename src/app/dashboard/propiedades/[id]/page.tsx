import { and, eq } from "drizzle-orm";
import { ArrowLeft, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { db } from "@/db";
import { properties } from "@/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { deletePropertyAction, updatePropertyAction } from "../actions";
import { PropertyFields } from "../property-fields";

export const metadata: Metadata = { title: "Editar inmueble" };

export default async function EditPropertyPage({ params }: PageProps<"/dashboard/propiedades/[id]">) {
  const { organization: org } = await requireAuth();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [property] = await db
    .select()
    .from(properties)
    .where(and(eq(properties.id, id), eq(properties.organizationId, org.id)))
    .limit(1);
  if (!property) notFound();

  return (
    <>
      <Link href="/dashboard/propiedades" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="size-4" /> Propiedades
      </Link>
      <PageHeader
        title={`${property.reference} · ${property.title}`}
        actions={
          <form action={deletePropertyAction.bind(null, property.id)}>
            <SubmitButton variant="ghost" size="md" confirm="¿Eliminar este inmueble?">
              <Trash2 className="size-4" /> Eliminar
            </SubmitButton>
          </form>
        }
      />
      <Card className="max-w-3xl">
        <CardBody>
          <ActionForm action={updatePropertyAction.bind(null, property.id)} submitLabel="Guardar cambios">
            <PropertyFields property={property} currency={org.currency} />
          </ActionForm>
        </CardBody>
      </Card>
    </>
  );
}
