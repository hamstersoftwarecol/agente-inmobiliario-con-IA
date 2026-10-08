import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "InmoVoz · Recepcionista inmobiliaria con IA 24/7",
    template: "%s · InmoVoz",
  },
  description:
    "Agente de voz con IA para inmobiliarias: responde llamadas, califica compradores y vendedores y agenda citas automáticamente las 24 horas.",
  applicationName: "InmoVoz",
};

export const viewport: Viewport = {
  themeColor: "#2146ee",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full bg-slate-50 font-sans text-slate-900">{children}</body>
    </html>
  );
}
