import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Sidebar } from "@/components/dashboard/sidebar";
import { requireAuth } from "@/lib/auth/session";
import { getEntitlements, trialDaysLeft } from "@/lib/plans";
import { signOut } from "../(auth)/actions";

export const metadata: Metadata = { title: "Panel", robots: { index: false } };

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, organization } = await requireAuth();
  const ent = getEntitlements(organization);
  const daysLeft = trialDaysLeft(organization);

  return (
    <div className="min-h-screen">
      <Sidebar
        orgName={organization.name}
        userName={user.name}
        userEmail={user.email}
        planName={ent.planName}
        signOutAction={signOut}
      />
      <div className="lg:pl-64">
        {!ent.active ? (
          <div className="bg-red-600 px-4 py-2 text-center text-sm text-white">
            {ent.blockedReason === "trial_expired"
              ? "Tu prueba gratuita terminó: el agente no atenderá llamadas."
              : "Tu suscripción no está activa: el agente no atenderá llamadas."}{" "}
            <Link href="/dashboard/facturacion" className="font-semibold underline">
              Elegir un plan
            </Link>
          </div>
        ) : daysLeft !== null ? (
          <div className="bg-brand-600 px-4 py-2 text-center text-sm text-white">
            Te quedan {daysLeft} {daysLeft === 1 ? "día" : "días"} de prueba gratuita.{" "}
            <Link href="/dashboard/facturacion" className="font-semibold underline">
              Ver planes
            </Link>
          </div>
        ) : null}
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
