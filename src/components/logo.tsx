import { AudioLines } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ className, href = "/", light }: { className?: string; href?: string; light?: boolean }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <span className="flex size-8 items-center justify-center rounded-lg bg-brand-600 text-white shadow-sm">
        <AudioLines className="size-4.5" />
      </span>
      <span className={cn("text-lg", light ? "text-white" : "text-slate-900")}>
        Inmo<span className={light ? "text-brand-300" : "text-brand-600"}>Voz</span>
      </span>
    </Link>
  );
}
