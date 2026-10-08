import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { requireAuth } from "@/lib/auth/session";
import { createPropertyAction } from "../actions";
import { PropertyFields } from "../property-fields";

export const metadata: Metadata = { title: "Nuevo inmueble" };

export default async function NewPropertyPage() {
  const { organization: org } = await requireAuth();
  return (
    <>
      <Link href="/dashboard/propiedades" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="size-4" /> Propiedades
      </Link>
      <PageHeader title="Nuevo inmueble" description="El agente de IA podrá ofrecerlo y responder preguntas sobre él." />
      <Card className="max-w-3xl">
        <CardBody>
          <ActionForm action={createPropertyAction} submitLabel="Crear inmueble">
            <PropertyFields currency={org.currency} />
          </ActionForm>
        </CardBody>
      </Card>
    </>
  );
}
