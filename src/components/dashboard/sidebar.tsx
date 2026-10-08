"use client";

import {
  Bot,
  Building2,
  CalendarDays,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  PhoneCall,
  Settings,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/logo";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Resumen", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/llamadas", label: "Llamadas", icon: PhoneCall },
  { href: "/dashboard/leads", label: "Leads", icon: Users },
  { href: "/dashboard/citas", label: "Citas", icon: CalendarDays },
  { href: "/dashboard/propiedades", label: "Propiedades", icon: Building2 },
  { href: "/dashboard/agentes", label: "Agentes IA", icon: Bot },
  { href: "/dashboard/facturacion", label: "Facturación", icon: CreditCard },
  { href: "/dashboard/configuracion", label: "Configuración", icon: Settings },
];

type Props = {
  orgName: string;
  userName: string;
  userEmail: string;
  planName: string;
  signOutAction: () => Promise<void>;
};

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-1 flex-col gap-1">
      {NAV.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
            )}
          >
            <item.icon className={cn("size-4.5", active ? "text-brand-600" : "text-slate-400")} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function Footer({ userName, userEmail, signOutAction }: Pick<Props, "userName" | "userEmail" | "signOutAction">) {
  return (
    <div className="border-t border-slate-200 pt-4">
      <div className="flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700">
          {initials(userName)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-900">{userName}</p>
          <p className="truncate text-xs text-slate-500">{userEmail}</p>
        </div>
        <form action={signOutAction}>
          <button
            type="submit"
            title="Cerrar sesión"
            className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <LogOut className="size-4" />
            <span className="sr-only">Cerrar sesión</span>
          </button>
        </form>
      </div>
    </div>
  );
}

export function Sidebar(props: Props) {
  const [open, setOpen] = useState(false);

  const content = (onNavigate?: () => void) => (
    <div className="flex h-full flex-col gap-6 p-4">
      <div className="px-2">
        <Logo href="/dashboard" />
        <div className="mt-4 rounded-lg bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
          <p className="truncate text-sm font-medium text-slate-900">{props.orgName}</p>
          <p className="text-xs text-slate-500">Plan: {props.planName}</p>
        </div>
      </div>
      <NavLinks onNavigate={onNavigate} />
      <Footer {...props} />
    </div>
  );

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200 bg-white lg:block">
        {content()}
      </aside>

      <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 lg:hidden">
        <Logo href="/dashboard" />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-md p-2 text-slate-600 hover:bg-slate-100"
          aria-label="Abrir menú"
        >
          <Menu className="size-5" />
        </button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-white shadow-xl">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3 rounded-md p-2 text-slate-500 hover:bg-slate-100"
              aria-label="Cerrar menú"
            >
              <X className="size-5" />
            </button>
            {content(() => setOpen(false))}
          </aside>
        </div>
      ) : null}
    </>
  );
}
