import { and, count, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { Plus, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { LeadStatusBadge, TemperatureBadge } from "@/components/domain-badges";
import { Pagination, pageFromParam, param } from "@/components/pagination";
import { ButtonLink, buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select, SelectOptions } from "@/components/ui/form";
import { EmptyState, PageHeader, ScoreBar } from "@/components/ui/misc";
import { db } from "@/db";
import { leads, leadStatusEnum, leadTemperatureEnum, type LeadStatus, type LeadTemperature } from "@/db/schema";
import { requireAuth } from "@/lib/auth/session";
import { formatMoney, formatRelative } from "@/lib/format";
import { leadIntentLabels, leadSourceLabels, leadStatusLabels, leadTemperatureLabels, options } from "@/lib/labels";

export const metadata: Metadata = { title: "Leads" };

const PAGE_SIZE = 25;

export default async function LeadsPage({ searchParams }: PageProps<"/dashboard/leads">) {
  const { organization: org } = await requireAuth();
  const sp = await searchParams;
  const q = param(sp.q);
  const status = param(sp.estado) as LeadStatus | undefined;
  const temperature = param(sp.temperatura) as LeadTemperature | undefined;
  const followUp = param(sp.seguimiento) === "1";
  const page = pageFromParam(sp.pagina);

  const conditions: SQL[] = [eq(leads.organizationId, org.id)];
  if (q) {
    const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    conditions.push(or(ilike(leads.name, like), ilike(leads.phone, like), ilike(leads.email, like), ilike(leads.zones, like))!);
  }
  if (status && leadStatusEnum.enumValues.includes(status)) conditions.push(eq(leads.status, status));
  if (temperature && leadTemperatureEnum.enumValues.includes(temperature)) conditions.push(eq(leads.temperature, temperature));
  if (followUp) conditions.push(eq(leads.needsFollowUp, true));
  const where = and(...conditions);

  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(leads)
      .where(where)
      .orderBy(desc(leads.needsFollowUp), desc(leads.updatedAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(leads).where(where),
  ]);

  return (
    <>
      <PageHeader
        title="Leads"
        description="Clientes potenciales capturados y calificados por tus agentes de IA."
        actions={
          <ButtonLink href="/dashboard/leads/nuevo">
            <Plus className="size-4" /> Nuevo lead
          </ButtonLink>
        }
      />

      <Card>
        <form className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-3">
          <Input name="q" defaultValue={q ?? ""} placeholder="Buscar por nombre, teléfono, correo o zona" className="h-8 max-w-xs text-xs" />
          <Select name="estado" defaultValue={status ?? ""} className="h-8 w-40 text-xs">
            <SelectOptions options={options(leadStatusLabels)} placeholder="Todos los estados" />
          </Select>
          <Select name="temperatura" defaultValue={temperature ?? ""} className="h-8 w-36 text-xs">
            <SelectOptions options={options(leadTemperatureLabels)} placeholder="Temperatura" />
          </Select>
          <label className="flex items-center gap-1.5 text-xs text-slate-600">
            <input type="checkbox" name="seguimiento" value="1" defaultChecked={followUp} className="rounded border-slate-300" />
            Solo pendientes de llamar
          </label>
          <button type="submit" className={buttonClass("secondary", "sm")}>
            Filtrar
          </button>
        </form>

        {rows.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No hay leads"
            description="Los clientes que hablen con tu agente se registrarán automáticamente aquí."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-2.5">Lead</th>
                  <th className="px-3 py-2.5">Interés</th>
                  <th className="px-3 py-2.5">Presupuesto</th>
                  <th className="px-3 py-2.5">Calificación</th>
                  <th className="px-3 py-2.5">Estado</th>
                  <th className="px-5 py-2.5 text-right">Último contacto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <Link href={`/dashboard/leads/${lead.id}`} className="block">
                        <span className="font-medium text-slate-900">
                          {lead.needsFollowUp ? "📞 " : ""}
                          {lead.name ?? "Sin nombre"}
                        </span>
                        <span className="block text-xs text-slate-500">
                          {lead.phone ?? lead.email ?? "—"} · {leadSourceLabels[lead.source]}
                        </span>
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {lead.intent ? leadIntentLabels[lead.intent] : "—"}
                      {lead.zones ? <span className="block max-w-40 truncate text-xs text-slate-400">{lead.zones}</span> : null}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-600">
                      {lead.budgetMax || lead.budgetMin
                        ? `${lead.budgetMin ? formatMoney(lead.budgetMin, org.currency) : ""}${lead.budgetMin && lead.budgetMax ? " – " : ""}${lead.budgetMax ? formatMoney(lead.budgetMax, org.currency) : ""}`
                        : "—"}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col gap-1">
                        <TemperatureBadge temperature={lead.temperature} />
                        <ScoreBar score={lead.score} />
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <LeadStatusBadge status={lead.status} />
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-right text-xs text-slate-500">
                      {lead.lastContactAt ? formatRelative(lead.lastContactAt) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          total={total}
          basePath="/dashboard/leads"
          params={{ q, estado: status, temperatura: temperature, seguimiento: followUp ? "1" : undefined }}
        />
      </Card>
    </>
  );
}
