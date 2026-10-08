import {
  ArrowRight,
  BarChart3,
  Bot,
  Building2,
  CalendarCheck,
  Check,
  Clock,
  CreditCard,
  Globe,
  Home,
  KeyRound,
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UserCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { ButtonLink } from "@/components/ui/button";
import { PLANS, TRIAL_LIMITS } from "@/lib/plans";
import { cn } from "@/lib/utils";

const features = [
  {
    icon: PhoneIncoming,
    title: "Recepcionista 24/7",
    text: "Contesta cada llamada al instante, incluso de noche, fines de semana y festivos.",
  },
  {
    icon: PhoneOutgoing,
    title: "Llamadas salientes",
    text: "Da seguimiento a tus leads con un clic: reactiva interesados y concreta visitas.",
  },
  {
    icon: Home,
    title: "Conoce tu inventario",
    text: "Responde precios, áreas y características reales de tus inmuebles. Nunca inventa.",
  },
  {
    icon: CalendarCheck,
    title: "Agenda automática",
    text: "Consulta tu disponibilidad y reserva visitas, avalúos y reuniones sin dobles reservas.",
  },
  {
    icon: UserCheck,
    title: "Calificación de leads",
    text: "Pregunta intención, zona, presupuesto, plazo y financiación, y puntúa cada contacto.",
  },
  {
    icon: Sparkles,
    title: "Análisis con IA",
    text: "Cada llamada termina con resumen, sentimiento, resultado y próximos pasos.",
  },
  {
    icon: SlidersHorizontal,
    title: "Agentes configurables",
    text: "Define personalidad, saludo, voz, preguntas e instrucciones para cada agente.",
  },
  {
    icon: BarChart3,
    title: "Panel de control",
    text: "Llamadas, leads y citas en un solo lugar, con métricas de conversión en tiempo real.",
  },
];

const steps = [
  {
    title: "Configura tu agente",
    text: "Elige una plantilla (recepcionista, captación o seguimiento), su voz y la información de tu inmobiliaria.",
  },
  {
    title: "Carga tus inmuebles y horarios",
    text: "Agrega tu inventario y tu horario de atención. El agente solo ofrecerá horarios realmente libres.",
  },
  {
    title: "Conecta tu número",
    text: "Desvía tu línea o usa un número nuevo. Desde ese momento ninguna llamada queda sin respuesta.",
  },
];

const faqs = [
  {
    q: "¿Suena como un robot?",
    a: "No. Usa voces neuronales naturales en español (Colombia, México, España, Argentina…) y un modelo de lenguaje de última generación que entiende el contexto y responde con frases cortas, como una persona.",
  },
  {
    q: "¿Qué pasa si el cliente quiere hablar con una persona?",
    a: "El agente registra la solicitud, marca el lead para seguimiento y le confirma al cliente que un asesor lo llamará. Verás la alerta en tu panel.",
  },
  {
    q: "¿Puede dar información incorrecta de un inmueble?",
    a: "El agente consulta tu inventario en cada respuesta y tiene instrucciones estrictas de no inventar precios ni características. Si no sabe algo, ofrece que un asesor lo contacte.",
  },
  {
    q: "¿Necesito cambiar de número?",
    a: "No necesariamente. Puedes desviar tu número actual cuando no contestes o fuera de horario, o usar un número nuevo dedicado.",
  },
  {
    q: "¿Cómo se cobran los minutos?",
    a: "Cada plan incluye una bolsa mensual de minutos de voz. El simulador de chat para probar tu agente no consume minutos.",
  },
];

const demo = [
  { who: "agent", text: "¡Hola! Gracias por llamar a Inmobiliaria Horizonte, te habla Sofía. ¿En qué te ayudo?" },
  { who: "client", text: "Hola, busco un apartamento de 3 habitaciones en Chicó, hasta 950 millones." },
  { who: "tool", text: "buscar_propiedades · 2 resultados" },
  { who: "agent", text: "Tengo el HZ-101: 98 m², balcón y dos parqueaderos, en 890 millones. ¿Te gustaría visitarlo?" },
  { who: "client", text: "Sí, ¿puede ser el jueves en la mañana?" },
  { who: "tool", text: "agendar_cita · jueves 10:00 ✓" },
  { who: "agent", text: "Listo, quedó tu visita el jueves a las 10 de la mañana. ¡Te esperamos!" },
];

export default function LandingPage() {
  return (
    <div className="bg-white">
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <nav className="hidden items-center gap-8 text-sm text-slate-600 md:flex">
            <a href="#funciones" className="hover:text-slate-900">
              Funciones
            </a>
            <a href="#como-funciona" className="hover:text-slate-900">
              Cómo funciona
            </a>
            <a href="#precios" className="hover:text-slate-900">
              Precios
            </a>
            <a href="#faq" className="hover:text-slate-900">
              Preguntas
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <ButtonLink href="/login" variant="ghost" size="sm">
              Iniciar sesión
            </ButtonLink>
            <ButtonLink href="/registro" size="sm">
              Probar gratis
            </ButtonLink>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-x-0 -top-40 -z-10 flex justify-center blur-3xl">
          <div className="aspect-[1.6] w-[60rem] bg-gradient-to-tr from-brand-200 via-violet-200 to-sky-200 opacity-60" />
        </div>
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:py-28">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 ring-1 ring-brand-200">
              <Bot className="size-3.5" /> Agente de voz con IA · disponible 24/7
            </span>
            <h1 className="mt-6 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
              La recepcionista con IA que <span className="text-brand-600">contesta, califica y agenda</span> por tu
              inmobiliaria.
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-slate-600">
              Cada llamada perdida es un comprador que llama a la competencia. InmoVoz atiende a compradores,
              vendedores y arrendatarios al instante, responde sobre tus inmuebles y reserva visitas en tu agenda.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/registro" size="lg">
                Empieza gratis <ArrowRight className="size-4" />
              </ButtonLink>
              <ButtonLink href="#como-funciona" size="lg" variant="secondary">
                Ver cómo funciona
              </ButtonLink>
            </div>
            <p className="mt-4 text-sm text-slate-500">
              {TRIAL_LIMITS.minutes} minutos de prueba · sin tarjeta · configuración en 10 minutos
            </p>
          </div>

          <div className="relative">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 pb-12 shadow-xl shadow-brand-900/5">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="relative flex size-10 items-center justify-center rounded-full bg-emerald-500 text-white">
                    <span className="pulse-ring absolute inset-0 rounded-full bg-emerald-400" />
                    <Phone className="relative size-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">Llamada entrante · +57 300 123 4567</p>
                    <p className="text-xs text-slate-500">Sofía (IA) · 02:14</p>
                  </div>
                </div>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">En vivo</span>
              </div>
              <div className="space-y-2.5">
                {demo.map((line, i) =>
                  line.who === "tool" ? (
                    <p key={i} className="text-center font-mono text-[11px] text-brand-600">
                      ⚙ {line.text}
                    </p>
                  ) : (
                    <div key={i} className={cn("flex", line.who === "client" ? "justify-end" : "justify-start")}>
                      <p
                        className={cn(
                          "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm",
                          line.who === "client" ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-800",
                        )}
                      >
                        {line.text}
                      </p>
                    </div>
                  ),
                )}
              </div>
            </div>
            <div className="absolute -bottom-6 left-6 hidden rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-lg sm:block">
              <p className="text-xs text-slate-500">Lead calificado</p>
              <p className="text-sm font-semibold">Carlos R. · 🔥 92/100</p>
            </div>
          </div>
        </div>
      </section>

      {/* Franja de valor */}
      <section className="border-y border-slate-200 bg-slate-50">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-10 text-center sm:px-6 md:grid-cols-4">
          {[
            { icon: Clock, label: "Disponible", value: "24/7/365" },
            { icon: Globe, label: "Idiomas", value: "Español e inglés" },
            { icon: Users, label: "Llamadas simultáneas", value: "Ilimitadas" },
            { icon: ShieldCheck, label: "Tus datos", value: "Aislados por cuenta" },
          ].map((item) => (
            <div key={item.label}>
              <item.icon className="mx-auto mb-2 size-5 text-brand-600" />
              <p className="text-lg font-semibold text-slate-900">{item.value}</p>
              <p className="text-sm text-slate-500">{item.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Funciones */}
      <section id="funciones" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight">Todo lo que hace tu mejor recepcionista, sin descanso</h2>
          <p className="mt-4 text-slate-600">
            Un agente de IA entrenado para el negocio inmobiliario, conectado a tu inventario, tu agenda y tu CRM.
          </p>
        </div>
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div key={f.title} className="rounded-xl border border-slate-200 p-6 transition hover:border-brand-200 hover:shadow-md">
              <f.icon className="size-6 text-brand-600" />
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Casos de uso */}
      <section className="bg-brand-950 text-white">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="text-3xl font-semibold tracking-tight">Habla con cada tipo de cliente</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              {
                icon: KeyRound,
                title: "Compradores y arrendatarios",
                text: "Entiende qué buscan, propone inmuebles del inventario que encajan con su presupuesto y agenda la visita.",
              },
              {
                icon: Building2,
                title: "Propietarios que venden",
                text: "Recoge datos del inmueble, plazos y expectativas, y reserva un avalúo sin costo con tu asesor.",
              },
              {
                icon: PhoneOutgoing,
                title: "Seguimiento de leads",
                text: "Llama a quienes mostraron interés, actualiza sus necesidades y los vuelve a poner en movimiento.",
              },
            ].map((c) => (
              <div key={c.title} className="rounded-xl bg-white/5 p-6 ring-1 ring-white/10">
                <c.icon className="size-6 text-brand-300" />
                <h3 className="mt-4 font-semibold">{c.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-brand-100">{c.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Cómo funciona */}
      <section id="como-funciona" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6">
        <h2 className="text-center text-3xl font-semibold tracking-tight">En marcha en tres pasos</h2>
        <ol className="mt-14 grid gap-8 md:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title} className="relative rounded-xl bg-slate-50 p-6">
              <span className="flex size-9 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">
                {i + 1}
              </span>
              <h3 className="mt-4 font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Precios */}
      <section id="precios" className="scroll-mt-20 border-t border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight">Precios simples, sin permanencia</h2>
            <p className="mt-4 text-slate-600">Empieza con 14 días gratis. Cambia de plan o cancela cuando quieras.</p>
          </div>
          <div className="mt-14 grid gap-6 lg:grid-cols-3">
            {PLANS.map((plan) => (
              <div
                key={plan.id}
                className={cn(
                  "flex flex-col rounded-2xl bg-white p-8 shadow-sm ring-1",
                  plan.highlighted ? "ring-2 ring-brand-600" : "ring-slate-200",
                )}
              >
                {plan.highlighted ? (
                  <span className="mb-4 w-fit rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
                    Más popular
                  </span>
                ) : null}
                <h3 className="text-lg font-semibold">{plan.name}</h3>
                <p className="mt-2 text-sm text-slate-600">{plan.description}</p>
                <p className="mt-6">
                  <span className="text-4xl font-semibold tracking-tight">${plan.priceUsd}</span>
                  <span className="text-sm text-slate-500"> USD/mes</span>
                </p>
                <ul className="mt-6 flex-1 space-y-3 text-sm text-slate-700">
                  {plan.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <Check className="size-4 shrink-0 text-brand-600" />
                      {f}
                    </li>
                  ))}
                </ul>
                <ButtonLink
                  href="/registro"
                  className="mt-8"
                  variant={plan.highlighted ? "primary" : "secondary"}
                >
                  Empezar prueba gratis
                </ButtonLink>
              </div>
            ))}
          </div>
          <p className="mt-8 flex items-center justify-center gap-2 text-sm text-slate-500">
            <CreditCard className="size-4" /> Pagos seguros con Stripe. Facturación mensual.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-24 sm:px-6">
        <h2 className="text-center text-3xl font-semibold tracking-tight">Preguntas frecuentes</h2>
        <div className="mt-10 divide-y divide-slate-200 rounded-xl border border-slate-200">
          {faqs.map((f) => (
            <details key={f.q} className="group p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between font-medium">
                {f.q}
                <span className="text-slate-400 transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA final */}
      <section className="px-4 pb-24 sm:px-6">
        <div className="mx-auto max-w-5xl rounded-3xl bg-gradient-to-br from-brand-600 to-violet-600 px-8 py-16 text-center text-white shadow-xl">
          <h2 className="text-3xl font-semibold tracking-tight">Deja de perder clientes por llamadas sin contestar</h2>
          <p className="mx-auto mt-4 max-w-xl text-brand-100">
            Configura tu recepcionista con IA hoy y deja que agende visitas mientras tu equipo se dedica a cerrar.
          </p>
          <ButtonLink href="/registro" size="lg" variant="secondary" className="mt-8">
            Crear mi agente gratis <ArrowRight className="size-4" />
          </ButtonLink>
        </div>
      </section>

      <footer className="border-t border-slate-200">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-slate-500 sm:flex-row sm:px-6">
          <Logo />
          <p>© {new Date().getFullYear()} InmoVoz. Recepcionista inmobiliaria con IA.</p>
          <div className="flex gap-4">
            <Link href="/login" className="hover:text-slate-900">
              Iniciar sesión
            </Link>
            <Link href="/registro" className="hover:text-slate-900">
              Crear cuenta
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
