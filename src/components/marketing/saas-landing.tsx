"use client";

/**
 * Landing principal del SaaS PlatoListo (dominio raíz).
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowRight,
  Check,
  ChefHat,
  ImageIcon,
  Palette,
  QrCode,
  Radio,
} from "lucide-react";
import { RegisterForm } from "@/components/marketing/RegisterForm";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=1600&h=1000&fit=crop&auto=format";

const FEATURES = [
  {
    icon: QrCode,
    title: "Menú QR ultra rápido",
    body: "El comensal escanea, ordena y paga el flujo sin esperar al mesero. Menos fricción, más tickets por mesa.",
  },
  {
    icon: Radio,
    title: "Cocina en tiempo real",
    body: "Comandas al instante por WebSockets. La cocina ve cada pedido vivo, sin refrescar ni gritar entre estaciones.",
  },
  {
    icon: ImageIcon,
    title: "Menú multimedia",
    body: "Fotos de platillos servidas desde Cloudflare R2: carga ligera, CDN global y menú que se ve tan bien como sabe.",
  },
  {
    icon: Palette,
    title: "Control de marca",
    body: "Colores, logo, horarios y módulos por restaurante. Cada local luce propio en su subdominio.",
  },
] as const;

const PLANS = [
  {
    id: "basico",
    name: "Básico",
    price: "$499",
    cadence: "/mes",
    blurb: "Para un local que quiere salir a digital ya.",
    featured: false,
    features: [
      "Menú digital + QR",
      "Pedidos y tracking",
      "Panel de cocina",
      "1 usuario admin",
      "Sitio en subdominio",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$999",
    cadence: "/mes",
    blurb: "El plan operativo para crecer ventas sin comisiones.",
    featured: true,
    features: [
      "Todo lo del Básico",
      "Analíticas y KPIs",
      "Multimedia R2 ilimitado*",
      "Marca y módulos a medida",
      "Hasta 5 usuarios",
      "Soporte prioritario",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "A medida",
    cadence: "",
    blurb: "Cadenas, multi-sucursal y requisitos a medida.",
    featured: false,
    features: [
      "Todo lo del Pro",
      "Multi-sucursal",
      "SLA y onboarding dedicado",
      "Integraciones custom",
      "Dominio propio",
      "Capacitación de equipo",
    ],
  },
] as const;

export function SaasLanding() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.documentElement.classList.add("scroll-smooth");
    return () => document.documentElement.classList.remove("scroll-smooth");
  }, []);

  return (
    <div className="saas-landing min-h-screen bg-[#0c1210] text-[#f3efe6]">
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
          scrolled
            ? "border-b border-[var(--saas-line)] bg-[#0c1210]/90 backdrop-blur-md"
            : "bg-transparent"
        }`}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <a
            href="#inicio"
            className="font-playfair-display text-xl font-bold tracking-tight text-[#f3efe6]"
          >
            PlatoListo
          </a>
          <nav className="hidden items-center gap-8 font-nunito-sans text-sm text-[var(--saas-muted)] md:flex">
            <a href="#beneficios" className="transition hover:text-[#f3efe6]">
              Beneficios
            </a>
            <a href="#planes" className="transition hover:text-[#f3efe6]">
              Planes
            </a>
            <a href="#registro" className="transition hover:text-[#f3efe6]">
              Registro
            </a>
          </nav>
          <a
            href="#registro"
            className="inline-flex items-center gap-2 rounded-sm bg-[var(--saas-amber)] px-4 py-2 font-nunito-sans text-xs font-bold tracking-widest text-[#1a1408] uppercase transition hover:bg-[#e0b96a]"
          >
            Empezar
          </a>
        </div>
      </header>

      <section
        id="inicio"
        className="relative flex min-h-[100svh] flex-col justify-end overflow-hidden"
      >
        <div className="absolute inset-0" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={HERO_IMAGE}
            alt=""
            className="size-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0c1210] via-[#0c1210]/75 to-[#0c1210]/35" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(61,122,85,0.28),transparent_55%)]" />
        </div>

        <div className="relative z-10 mx-auto w-full max-w-6xl px-5 pb-16 pt-28 sm:px-8 sm:pb-24">
          <p className="saas-rise font-playfair-display text-4xl font-bold tracking-tight text-[#f3efe6] sm:text-5xl md:text-6xl">
            PlatoListo
          </p>
          <h1 className="saas-rise saas-rise-delay-1 mt-5 max-w-3xl font-playfair-display text-3xl font-semibold leading-[1.15] tracking-tight text-[#f3efe6] sm:text-4xl md:text-5xl">
            Tu restaurante en internet. Tu menú en la mesa. Cero comisiones.
          </h1>
          <p className="saas-rise saas-rise-delay-2 mt-5 max-w-xl font-nunito-sans text-base leading-relaxed text-[var(--saas-muted)] sm:text-lg">
            Acelera la cocina, multiplica tickets y controla tu marca en un
            panel multi-tenant pensado para dueños que operan, no para
            marketplaces.
          </p>
          <div className="saas-rise saas-rise-delay-3 mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <a
              href="#registro"
              className="inline-flex items-center justify-center gap-2 rounded-sm bg-[var(--saas-amber)] px-6 py-3.5 font-nunito-sans text-sm font-bold tracking-wide text-[#1a1408] transition hover:bg-[#e0b96a]"
            >
              Registrar mi restaurante
              <ArrowRight className="size-4" aria-hidden />
            </a>
            <a
              href="#planes"
              className="inline-flex items-center justify-center rounded-sm border border-[var(--saas-line)] px-6 py-3.5 font-nunito-sans text-sm font-semibold text-[#f3efe6] transition hover:border-[var(--saas-amber)]/50 hover:text-[var(--saas-amber)]"
            >
              Ver planes
            </a>
          </div>
        </div>
      </section>

      <section
        id="beneficios"
        className="relative border-t border-[var(--saas-line)]"
      >
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
          <SectionIntro
            eyebrow="Propuesta de valor"
            title="Operación digital sin intermediarios"
            body="Todo lo que necesitas para vender más y servir más rápido, en el subdominio de tu restaurante."
          />
          <div className="mt-14 grid gap-x-10 gap-y-12 sm:grid-cols-2">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <Reveal key={feature.title}>
                  <article className="group flex gap-5">
                    <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-sm border border-[var(--saas-line)] bg-[var(--saas-panel)] text-[var(--saas-amber)] transition group-hover:border-[var(--saas-amber)]/40 group-hover:bg-[var(--saas-green)]/15">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <div>
                      <h3 className="font-playfair-display text-xl font-semibold tracking-tight">
                        {feature.title}
                      </h3>
                      <p className="mt-2 font-nunito-sans text-sm leading-relaxed text-[var(--saas-muted)] sm:text-[15px]">
                        {feature.body}
                      </p>
                    </div>
                  </article>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      <section
        id="planes"
        className="relative border-t border-[var(--saas-line)] bg-[#0a100e]"
      >
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
          <SectionIntro
            eyebrow="Planes"
            title="Precios claros. Sin comisiones por pedido."
            body="Elige el ritmo de tu operación. Los precios son de referencia; el alta te lleva directo al panel."
          />
          <div className="mt-14 grid gap-5 lg:grid-cols-3">
            {PLANS.map((plan) => (
              <Reveal key={plan.id}>
                <article
                  className={`flex h-full flex-col rounded-sm border p-7 transition ${
                    plan.featured
                      ? "border-[var(--saas-amber)]/55 bg-[var(--saas-panel)]"
                      : "border-[var(--saas-line)] bg-[#0c1210]"
                  }`}
                >
                  {plan.featured ? (
                    <p className="mb-3 font-nunito-sans text-[10px] font-bold tracking-[0.22em] text-[var(--saas-amber)] uppercase">
                      Recomendado
                    </p>
                  ) : (
                    <p className="mb-3 font-nunito-sans text-[10px] font-bold tracking-[0.22em] text-[var(--saas-muted)] uppercase">
                      Plan
                    </p>
                  )}
                  <h3 className="font-playfair-display text-2xl font-semibold">
                    {plan.name}
                  </h3>
                  <p className="mt-2 font-nunito-sans text-sm text-[var(--saas-muted)]">
                    {plan.blurb}
                  </p>
                  <p className="mt-6 font-playfair-display text-4xl font-bold tracking-tight">
                    {plan.price}
                    {plan.cadence ? (
                      <span className="ml-1 font-nunito-sans text-sm font-normal text-[var(--saas-muted)]">
                        {plan.cadence}
                      </span>
                    ) : null}
                  </p>
                  <ul className="mt-6 flex flex-1 flex-col gap-2.5 font-nunito-sans text-sm text-[var(--saas-muted)]">
                    {plan.features.map((item) => (
                      <li key={item} className="flex items-start gap-2.5">
                        <Check
                          className="mt-0.5 size-4 shrink-0 text-[var(--saas-green)]"
                          aria-hidden
                        />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <a
                    href="#registro"
                    className={`mt-8 inline-flex items-center justify-center gap-2 rounded-sm px-4 py-3 font-nunito-sans text-sm font-bold transition ${
                      plan.featured
                        ? "bg-[var(--saas-amber)] text-[#1a1408] hover:bg-[#e0b96a]"
                        : "border border-[var(--saas-line)] text-[#f3efe6] hover:border-[var(--saas-amber)]/50"
                    }`}
                  >
                    {plan.id === "enterprise"
                      ? "Hablar con ventas"
                      : "Empezar con este plan"}
                    <ArrowRight className="size-4" aria-hidden />
                  </a>
                </article>
              </Reveal>
            ))}
          </div>
          <p className="mt-6 font-nunito-sans text-xs text-[var(--saas-muted)]">
            *Límites de almacenamiento sujetos a política de uso razonable.
            Precios de maqueta — facturación se activa en onboarding.
          </p>
        </div>
      </section>

      <section
        id="registro"
        className="relative scroll-mt-20 border-t border-[var(--saas-line)]"
      >
        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-[1fr_1.05fr] lg:items-start">
          <div>
            <p className="font-nunito-sans text-[11px] font-bold tracking-[0.22em] text-[var(--saas-amber)] uppercase">
              Onboarding
            </p>
            <h2 className="mt-3 font-playfair-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Crea tu restaurante en minutos
            </h2>
            <p className="mt-4 max-w-md font-nunito-sans text-base leading-relaxed text-[var(--saas-muted)]">
              Registra el local, elige tu subdominio y entra al panel. Menú,
              cocina y marca quedan listos para operar el mismo día.
            </p>
            <ul className="mt-8 space-y-3 font-nunito-sans text-sm text-[var(--saas-muted)]">
              <li className="flex items-center gap-3">
                <ChefHat
                  className="size-4 text-[var(--saas-amber)]"
                  aria-hidden
                />
                Panel admin en{" "}
                <code className="rounded bg-white/5 px-1.5 py-0.5 text-[var(--saas-amber)]">
                  /admin/login
                </code>
              </li>
              <li className="flex items-center gap-3">
                <QrCode
                  className="size-4 text-[var(--saas-amber)]"
                  aria-hidden
                />
                Sitio y menú en tu propio subdominio
              </li>
              <li className="flex items-center gap-3">
                <Radio
                  className="size-4 text-[var(--saas-amber)]"
                  aria-hidden
                />
                Sin comisiones por pedido
              </li>
            </ul>
          </div>
          <div className="lg:sticky lg:top-24">
            <RegisterForm />
          </div>
        </div>
      </section>

      <footer className="border-t border-[var(--saas-line)]">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p className="font-playfair-display text-lg font-semibold">
            PlatoListo
          </p>
          <p className="font-nunito-sans text-sm text-[var(--saas-muted)]">
            SaaS multi-tenant para restaurantes. Cero comisiones.
          </p>
        </div>
      </footer>
    </div>
  );
}

function SectionIntro({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <div className="max-w-2xl">
      <p className="font-nunito-sans text-[11px] font-bold tracking-[0.22em] text-[var(--saas-amber)] uppercase">
        {eyebrow}
      </p>
      <h2 className="mt-3 font-playfair-display text-3xl font-semibold tracking-tight sm:text-4xl">
        {title}
      </h2>
      <p className="mt-4 font-nunito-sans text-base leading-relaxed text-[var(--saas-muted)]">
        {body}
      </p>
    </div>
  );
}

function Reveal({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transition duration-700 ease-out ${
        visible ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0"
      }`}
    >
      {children}
    </div>
  );
}
