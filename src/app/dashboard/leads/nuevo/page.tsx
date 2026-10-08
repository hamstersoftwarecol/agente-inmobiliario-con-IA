import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { requireAuth } from "@/lib/auth/session";
import { createLeadAction } from "../actions";
import { LeadFields } from "../lead-fields";

export const metadata: Metadata = { title: "Nuevo lead" };

export default async function NewLeadPage() {
  const { organization: org } = await requireAuth();
  return (
    <>
      <Link href="/dashboard/leads" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="size-4" /> Leads
      </Link>
      <PageHeader title="Nuevo lead" description="Registra un cliente potencial manualmente." />
      <Card className="max-w-3xl">
        <CardBody>
          <ActionForm action={createLeadAction} submitLabel="Crear lead">
            <LeadFields currency={org.currency} />
          </ActionForm>
        </CardBody>
      </Card>
    </>
  );
}
