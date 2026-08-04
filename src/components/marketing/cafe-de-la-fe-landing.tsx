"use client";

/**
 * THESIS: Warm specialty-café institutional site for Café de la Fe — community and
 * faith around the cup; refuses SaaS emerald and generic QR-menu chrome.
 * OWN-WORLD: Cream parchment (#f5efe6), espresso (#2c1a0e), gold (#b8963e); Lora display + Nunito body.
 * STORY: Visitor feels the place, samples featured drinks, then opens the digital menu.
 * FIRST VIEWPORT: Full-bleed coffee hero, brand name, “Unión / Aroma / Gracia”, CTAs to menu + esencia.
 * FORM: Migrated from `cafedelafe/` Figma Make prototype; wired to tenant brand + catalog.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  AtSign,
  Clock,
  Coffee,
  HeartHandshake,
  Mail,
  MapPin,
  Menu,
  Phone,
  Sparkles,
  X,
} from "lucide-react";
import { QaEnvBadge } from "@/components/env-qa-badge";
import {
  mapsEmbedSrc,
  mapsExternalHref,
  telHref,
  whatsappChatUrl,
} from "@/lib/contact-links";
import type { Product } from "@/types/api";
import type { RestaurantBrand } from "@/types/restaurant-brand";

type CafeDeLaFeLandingProps = {
  brand: RestaurantBrand;
  products: Product[];
};

const HERO_IMG =
  "https://images.unsplash.com/photo-1742549626436-bf3c11dab212?w=1600&h=900&fit=crop&auto=format";

const ESENCIA_MAIN_IMG =
  "https://images.unsplash.com/photo-1771596378772-858323ca698f?w=700&h=600&fit=crop&auto=format";

const ESENCIA_SIDE_IMG =
  "https://images.unsplash.com/photo-1686315715890-9083c5c5c861?w=400&h=450&fit=crop&auto=format";

const MENU_PLACEHOLDER_IMAGE =
  "https://images.unsplash.com/photo-1525391832543-432b7e058cb0?w=600&h=500&fit=crop&auto=format";

type FallbackMenuItem = {
  name: string;
  desc: string;
  priceLabel: string;
  img: string;
  alt: string;
  tag: string;
};

const FALLBACK_MENU: FallbackMenuItem[] = [
  {
    name: "Cappuccino Gracia",
    desc: "Espresso de origen único con leche vaporizada sedosa y arte en la crema. Cada sorbo, una pequeña bendición.",
    priceLabel: "$4.50",
    img: "https://images.unsplash.com/photo-1525391832543-432b7e058cb0?w=600&h=500&fit=crop&auto=format",
    alt: "Cappuccino con arte en la crema",
    tag: "Más pedido",
  },
  {
    name: "Latte Espiritual",
    desc: "Latte de temporada con vainilla de Madagascar y canela. Cálido por dentro, luminoso por fuera.",
    priceLabel: "$5.20",
    img: "https://images.unsplash.com/photo-1681838853984-697bbb001257?w=600&h=500&fit=crop&auto=format",
    alt: "Latte sobre mesa de madera",
    tag: "Favorito",
  },
  {
    name: "Pan de Vida",
    desc: "Pan artesanal de masa madre horneado cada mañana. Crujiente por fuera, tierno por dentro. Con mantequilla de miel.",
    priceLabel: "$3.80",
    img: "https://images.unsplash.com/photo-1549413468-cd78edb7e75c?w=600&h=500&fit=crop&auto=format",
    alt: "Pan artesanal fresco",
    tag: "Panadería",
  },
];

const TESTIMONIALS = [
  {
    quote:
      "Entrar al Café de la Fe es como llegar a casa. El ambiente te abraza y el café te despierta el alma.",
    name: "Valentina Ruiz",
    role: "Escritora y feligresa habitual",
    initials: "VR",
  },
  {
    quote:
      "Nunca pensé que un cappuccino podía volverse parte de mi devocional matutino. Aquí cada visita es un regalo.",
    name: "Marcos Herrera",
    role: "Pastor y amante del café",
    initials: "MH",
  },
  {
    quote:
      "La calidad del café es extraordinaria, pero lo que realmente me vuelve es la paz que se siente al estar aquí.",
    name: "Sofía Delgado",
    role: "Diseñadora y vecina del barrio",
    initials: "SD",
  },
] as const;

const DEFAULT_HOURS = [
  { day: "Lunes – Viernes", time: "6:30 am – 8:00 pm" },
  { day: "Sábado", time: "7:00 am – 9:00 pm" },
  { day: "Domingo", time: "8:00 am – 6:00 pm" },
] as const;

const NAV_LINKS = [
  { href: "#esencia", label: "Esencia" },
  { href: "#menu", label: "Menú" },
  { href: "#testimonios", label: "Testimonios" },
  { href: "#visitanos", label: "Visítanos" },
] as const;

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setVisible(true);
      return;
    }
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);

  return { ref, visible };
}

function CafeMark({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      stroke="currentColor"
      strokeWidth={1.8}
      aria-hidden
    >
      <path d="M17 8h1a4 4 0 0 1 0 8h-1" />
      <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
      <line x1="6" x2="6" y1="2" y2="4" />
      <line x1="10" x2="10" y1="2" y2="4" />
      <line x1="14" x2="14" y1="2" y2="4" />
    </svg>
  );
}

function Nav({ name }: { name: string }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const solid = scrolled || open;

  return (
    <nav
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 motion-reduce:transition-none ${
        solid
          ? "bg-[#f5efe6]/95 backdrop-blur-sm shadow-sm"
          : "bg-gradient-to-b from-[#2c1a0e]/70 to-transparent"
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
        <a href="#contenido-principal" className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 shrink-0 rounded-full bg-[#b8963e] flex items-center justify-center text-[#f5efe6]">
            <CafeMark />
          </div>
          <span
            className={`font-lora-display text-lg font-semibold tracking-wide truncate transition-colors duration-300 ${
              solid ? "text-[#2c1a0e]" : "text-[#f5efe6]"
            }`}
          >
            {name}
          </span>
        </a>

        <div
          className={`hidden md:flex items-center gap-8 text-sm font-medium transition-colors duration-300 ${
            solid ? "text-[#5c3d2e]" : "text-[#f5efe6]/90"
          }`}
        >
          {NAV_LINKS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={`transition-colors duration-200 tracking-wide min-h-11 inline-flex items-center ${
                solid ? "hover:text-[#b8963e]" : "hover:text-[#d4b068]"
              }`}
            >
              {item.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/menu"
            className="hidden md:inline-flex items-center gap-2 bg-[#b8963e] text-[#f5efe6] text-sm font-semibold px-5 py-2.5 rounded-full hover:bg-[#a07850] transition-colors duration-200 min-h-11"
          >
            Ver Menú
          </Link>
          <button
            type="button"
            className={`md:hidden inline-flex items-center justify-center size-11 rounded-full transition-colors ${
              solid
                ? "text-[#2c1a0e] hover:bg-[#ede3d4]"
                : "text-[#f5efe6] hover:bg-[#f5efe6]/10"
            }`}
            aria-expanded={open}
            aria-controls="cafe-mobile-nav"
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {open ? (
        <div
          id="cafe-mobile-nav"
          className="md:hidden border-t border-[#c8c0b0]/50 bg-[#f5efe6] px-6 py-4 space-y-1"
        >
          {NAV_LINKS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="block py-3 min-h-11 text-[#5c3d2e] font-medium tracking-wide border-b border-[#c8c0b0]/40 last:border-0"
              onClick={() => setOpen(false)}
            >
              {item.label}
            </a>
          ))}
          <Link
            href="/menu"
            className="mt-3 inline-flex w-full items-center justify-center gap-2 bg-[#b8963e] text-[#f5efe6] text-sm font-semibold px-5 py-3 rounded-full min-h-11"
            onClick={() => setOpen(false)}
          >
            Ver Menú
          </Link>
        </div>
      ) : null}
    </nav>
  );
}

function Hero({
  name,
  tagline,
  address,
  hoursToday,
}: {
  name: string;
  tagline: string;
  address: string | null;
  hoursToday: string | null;
}) {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden">
      <div className="absolute inset-0 bg-[#2c1a0e]">
        <img
          src={HERO_IMG}
          alt=""
          className="w-full h-full object-cover opacity-45"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#2c1a0e]/80 via-[#2c1a0e]/50 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#2c1a0e]/60 via-transparent to-transparent" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6 pt-32 pb-24 grid md:grid-cols-2 gap-12 items-center w-full">
        <div>
          <div className="inline-flex items-center gap-2 bg-[#b8963e]/20 border border-[#b8963e]/40 rounded-full px-4 py-1.5 mb-8 cafe-fade-up">
            <span className="w-1.5 h-1.5 rounded-full bg-[#d4b068]" aria-hidden />
            <span className="text-[#d4b068] text-xs font-semibold tracking-widest uppercase">
              {tagline}
            </span>
          </div>

          <h1 className="font-lora-display text-5xl md:text-6xl xl:text-7xl font-bold text-[#f5efe6] leading-tight mb-6 cafe-fade-up cafe-fade-up-delay-1">
            Unión,
            <br />
            <em className="text-[#d4b068] not-italic">Aroma</em>
            <br />
            y Gracia.
          </h1>

          <p className="text-[#c8c0b0] text-lg md:text-xl font-light leading-relaxed mb-10 max-w-md cafe-fade-up cafe-fade-up-delay-2">
            {name}: Donde cada taza alimenta el espíritu y cada encuentro fortalece
            la comunidad.
          </p>

          <div className="flex flex-wrap gap-4 cafe-fade-up cafe-fade-up-delay-3">
            <Link
              href="/menu"
              className="inline-flex items-center gap-2.5 bg-[#b8963e] text-[#f5efe6] font-semibold px-8 py-3.5 rounded-full hover:bg-[#d4b068] transition-all duration-300 hover:shadow-lg hover:shadow-[#b8963e]/30 min-h-11"
            >
              Ver Menú
              <ArrowRight className="w-4 h-4" aria-hidden />
            </Link>
            <a
              href="#esencia"
              className="inline-flex items-center gap-2.5 border border-[#c8c0b0]/40 text-[#c8c0b0] font-medium px-8 py-3.5 rounded-full hover:border-[#d4b068] hover:text-[#d4b068] transition-all duration-300 min-h-11"
            >
              Nuestra historia
            </a>
          </div>
        </div>

        <div className="hidden md:flex justify-end">
          <div className="bg-[#f5efe6]/10 backdrop-blur-md border border-[#b8963e]/25 rounded-2xl p-6 max-w-xs">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[#b8963e]/20 border border-[#b8963e]/40 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-[#d4b068]" aria-hidden />
              </div>
              <div>
                <p className="text-[#f5efe6] font-semibold text-sm">Abierto hoy</p>
                <p className="text-[#c8c0b0] text-xs">
                  {hoursToday ?? "Consulta nuestro horario"}
                </p>
              </div>
            </div>
            {address ? (
              <>
                <div className="h-px bg-[#b8963e]/20 mb-4" />
                <div className="flex items-start gap-3">
                  <MapPin
                    className="w-4 h-4 text-[#b8963e] mt-0.5 shrink-0"
                    aria-hidden
                  />
                  <p className="text-[#c8c0b0] text-xs leading-relaxed whitespace-pre-line">
                    {address}
                  </p>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-[#c8c0b0]/60">
        <span className="text-xs tracking-widest uppercase">Descubre</span>
        <div className="w-px h-8 bg-gradient-to-b from-[#c8c0b0]/40 to-transparent animate-pulse motion-reduce:animate-none" />
      </div>
    </section>
  );
}

function Esencia({ name, description }: { name: string; description: string | null }) {
  const { ref, visible } = useInView();

  return (
    <section id="esencia" ref={ref} className="py-28 bg-[#f5efe6]">
      <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-16 items-center">
        <div
          className={`relative transition-all duration-700 motion-reduce:transition-none ${
            visible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-8"
          }`}
        >
          <div className="relative h-96 md:h-[480px]">
            <img
              src={ESENCIA_MAIN_IMG}
              alt="Mesa de madera bañada en luz solar"
              className="absolute top-0 left-0 w-3/4 h-3/4 object-cover rounded-2xl shadow-lg"
            />
            <img
              src={ESENCIA_SIDE_IMG}
              alt="Taza de café sobre mesa"
              className="absolute bottom-0 right-0 w-1/2 h-1/2 object-cover rounded-2xl shadow-xl border-4 border-[#f5efe6]"
            />
            <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full border-2 border-[#b8963e]/30" />
            <div className="absolute top-4 right-4 w-12 h-12 rounded-full bg-[#b8963e]/10" />
          </div>
        </div>

        <div
          className={`transition-all duration-700 delay-200 motion-reduce:transition-none ${
            visible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"
          }`}
        >
          <div className="inline-flex items-center gap-2 mb-6">
            <div className="h-px w-8 bg-[#b8963e]" />
            <span className="text-[#b8963e] text-xs font-semibold tracking-widest uppercase">
              Nuestra Esencia
            </span>
          </div>
          <h2 className="font-lora-display text-4xl md:text-5xl font-bold text-[#2c1a0e] leading-tight mb-6">
            Más que café.
            <br />
            <em className="text-[#a07850] font-medium">Una comunidad.</em>
          </h2>
          {description?.trim() ? (
            <p className="text-[#5c3d2e] text-lg leading-relaxed mb-10 font-light whitespace-pre-line max-w-prose">
              {description.trim()}
            </p>
          ) : (
            <>
              <p className="text-[#5c3d2e] text-lg leading-relaxed mb-6 font-light max-w-prose">
                {name} nació de la convicción de que alrededor de una buena taza se
                construyen los lazos más auténticos. Aquí, la fe no es un adorno, es
                el fundamento.
              </p>
              <p className="text-[#5c3d2e] leading-relaxed mb-10 font-light max-w-prose">
                Trabajamos con granos orgánicos de origen certificado, cultivados
                por familias que comparten nuestros valores. Cada proceso —desde la
                cosecha hasta el espresso— es un acto de gratitud.
              </p>
            </>
          )}

          <div className="grid grid-cols-3 gap-4">
            {(
              [
                { icon: <Coffee className="w-6 h-6" aria-hidden />, label: "Café Orgánico" },
                {
                  icon: <HeartHandshake className="w-6 h-6" aria-hidden />,
                  label: "Comunidad",
                },
                { icon: <Sparkles className="w-6 h-6" aria-hidden />, label: "Propósito" },
              ] as const
            ).map(({ icon, label }) => (
              <div
                key={label}
                className="flex flex-col items-center gap-2 p-4 bg-[#ede3d4] rounded-xl text-center hover:bg-[#e8dcc8] transition-colors duration-200 text-[#5c3d2e]"
              >
                <span className="text-[#b8963e]">{icon}</span>
                <span className="text-[#5c3d2e] text-xs font-semibold tracking-wide uppercase">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

type FeaturedItem = {
  key: string;
  name: string;
  desc: string;
  priceLabel: string;
  img: string;
  alt: string;
  tag: string;
};

function buildFeaturedItems(products: Product[]): FeaturedItem[] {
  const available = products.filter((p) => p.isAvailable).slice(0, 3);
  if (available.length > 0) {
    return available.map((p, i) => ({
      key: p.uuid,
      name: p.name,
      desc: p.description?.trim() || "Preparados con intención, servidos con amor.",
      priceLabel: p.formattedPrice,
      img: p.imageUrl || FALLBACK_MENU[i]?.img || MENU_PLACEHOLDER_IMAGE,
      alt: p.name,
      tag: p.categoryName || "Menú",
    }));
  }
  return FALLBACK_MENU.map((item) => ({
    key: item.name,
    name: item.name,
    desc: item.desc,
    priceLabel: item.priceLabel,
    img: item.img,
    alt: item.alt,
    tag: item.tag,
  }));
}

function FeaturedMenu({
  products,
  canOrder,
}: {
  products: Product[];
  canOrder: boolean;
}) {
  const { ref, visible } = useInView();
  const items = useMemo(() => buildFeaturedItems(products), [products]);
  const fromCatalog = products.some((p) => p.isAvailable);

  return (
    <section id="menu" ref={ref} className="py-28 bg-[#2c1a0e]">
      <div className="max-w-6xl mx-auto px-6">
        <div
          className={`text-center mb-16 transition-all duration-700 motion-reduce:transition-none ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          <div className="inline-flex items-center gap-2 mb-5">
            <div className="h-px w-8 bg-[#b8963e]" />
            <span className="text-[#b8963e] text-xs font-semibold tracking-widest uppercase">
              Menú Destacado
            </span>
            <div className="h-px w-8 bg-[#b8963e]" />
          </div>
          <h2 className="font-lora-display text-4xl md:text-5xl font-bold text-[#f5efe6] leading-tight">
            Cada taza, una historia
          </h2>
          <p className="mt-4 text-[#a07850] text-lg font-light max-w-xl mx-auto">
            Preparados con intención, servidos con amor.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {items.map((item, i) => (
            <article
              key={item.key}
              className={`cafe-menu-card group bg-[#3d2518] rounded-2xl overflow-hidden border border-[#5c3d2e]/40 hover:border-[#b8963e]/50 transition-all duration-500 hover:shadow-xl hover:shadow-[#b8963e]/10 motion-reduce:transition-none ${
                visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
              }`}
              style={{ transitionDelay: visible ? `${i * 120}ms` : undefined }}
            >
              <div className="relative h-52 overflow-hidden bg-[#2c1a0e]">
                <img
                  src={item.img}
                  alt={item.alt}
                  className="cafe-menu-img w-full h-full object-cover opacity-85 transition-transform duration-700 motion-reduce:transition-none"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#3d2518] to-transparent" />
                <span className="absolute top-4 left-4 bg-[#b8963e] text-[#f5efe6] text-xs font-semibold px-3 py-1 rounded-full tracking-wide">
                  {item.tag}
                </span>
              </div>
              <div className="p-6">
                <h3 className="font-lora-display text-xl font-semibold text-[#f5efe6] mb-2">
                  {item.name}
                </h3>
                <p className="text-[#a07850] text-sm leading-relaxed mb-5 font-light">
                  {item.desc}
                </p>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-lora-display text-2xl font-bold text-[#d4b068] tabular-nums">
                    {item.priceLabel}
                  </span>
                  {canOrder ? (
                    <Link
                      href="/menu"
                      className="flex items-center gap-1.5 text-[#b8963e] text-sm font-medium hover:text-[#d4b068] transition-colors duration-200 group-hover:gap-2.5 min-h-11"
                    >
                      Ordenar
                      <ArrowRight className="w-4 h-4" aria-hidden />
                    </Link>
                  ) : (
                    <Link
                      href="/menu"
                      className="flex items-center gap-1.5 text-[#b8963e] text-sm font-medium hover:text-[#d4b068] transition-colors duration-200 min-h-11"
                    >
                      Ver
                      <ArrowRight className="w-4 h-4" aria-hidden />
                    </Link>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="text-center mt-12">
          <Link
            href="/menu"
            className="inline-flex items-center gap-2 border border-[#b8963e]/40 text-[#b8963e] font-medium px-8 py-3.5 rounded-full hover:bg-[#b8963e]/10 transition-all duration-300 min-h-11"
          >
            {fromCatalog ? "Ver menú completo" : "Abrir menú digital"}
          </Link>
        </div>
      </div>
    </section>
  );
}

function Testimonios() {
  const { ref, visible } = useInView();
  const [active, setActive] = useState(0);

  return (
    <section id="testimonios" ref={ref} className="py-28 bg-[#ede3d4]">
      <div className="max-w-6xl mx-auto px-6">
        <div
          className={`text-center mb-16 transition-all duration-700 motion-reduce:transition-none ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          <div className="inline-flex items-center gap-2 mb-5">
            <div className="h-px w-8 bg-[#b8963e]" />
            <span className="text-[#b8963e] text-xs font-semibold tracking-widest uppercase">
              Testimonios
            </span>
            <div className="h-px w-8 bg-[#b8963e]" />
          </div>
          <h2 className="font-lora-display text-4xl md:text-5xl font-bold text-[#2c1a0e] leading-tight">
            Lo que dice
            <br />
            <em className="text-[#a07850] font-medium">nuestra comunidad</em>
          </h2>
        </div>

        <div
          className={`hidden md:grid grid-cols-3 gap-6 transition-all duration-700 delay-200 motion-reduce:transition-none ${
            visible ? "opacity-100" : "opacity-0"
          }`}
        >
          {TESTIMONIALS.map((t) => (
            <blockquote
              key={t.name}
              className="bg-[#f5efe6] rounded-2xl p-7 border border-[#c8c0b0]/50 hover:border-[#b8963e]/40 hover:shadow-lg transition-all duration-300"
            >
              <div
                className="font-lora-display text-5xl text-[#b8963e]/30 leading-none mb-3 select-none"
                aria-hidden
              >
                &ldquo;
              </div>
              <p className="text-[#5c3d2e] leading-relaxed mb-6 font-light italic">
                {t.quote}
              </p>
              <footer className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#b8963e] flex items-center justify-center text-[#f5efe6] font-semibold text-sm">
                  {t.initials}
                </div>
                <div>
                  <cite className="text-[#2c1a0e] font-semibold text-sm not-italic">
                    {t.name}
                  </cite>
                  <p className="text-[#a07850] text-xs">{t.role}</p>
                </div>
              </footer>
            </blockquote>
          ))}
        </div>

        <div className="md:hidden">
          <blockquote className="bg-[#f5efe6] rounded-2xl p-7 border border-[#c8c0b0]/50">
            <div
              className="font-lora-display text-5xl text-[#b8963e]/30 leading-none mb-3 select-none"
              aria-hidden
            >
              &ldquo;
            </div>
            <p className="text-[#5c3d2e] leading-relaxed mb-6 font-light italic">
              {TESTIMONIALS[active].quote}
            </p>
            <footer className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-[#b8963e] flex items-center justify-center text-[#f5efe6] font-semibold text-sm">
                {TESTIMONIALS[active].initials}
              </div>
              <div>
                <cite className="text-[#2c1a0e] font-semibold text-sm not-italic">
                  {TESTIMONIALS[active].name}
                </cite>
                <p className="text-[#a07850] text-xs">{TESTIMONIALS[active].role}</p>
              </div>
            </footer>
            <div className="flex gap-2 justify-center" role="tablist" aria-label="Testimonios">
              {TESTIMONIALS.map((t, i) => (
                <button
                  key={t.name}
                  type="button"
                  role="tab"
                  aria-selected={i === active}
                  aria-label={`Ver testimonio de ${t.name}`}
                  onClick={() => setActive(i)}
                  className={`h-2 rounded-full transition-all duration-300 min-w-2 min-h-11 px-0 ${
                    i === active ? "bg-[#b8963e] w-6" : "bg-[#c8c0b0] w-2"
                  }`}
                />
              ))}
            </div>
          </blockquote>
        </div>
      </div>
    </section>
  );
}

function parseHoursRows(
  businessHours: string | null | undefined,
): Array<{ day: string; time: string }> {
  const raw = businessHours?.trim();
  if (!raw) return [...DEFAULT_HOURS];

  const lines = raw
    .split(/\n|;/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [...DEFAULT_HOURS];

  return lines.map((line) => {
    if (line.includes("·")) {
      const [day, ...rest] = line.split("·");
      return { day: (day ?? line).trim(), time: rest.join("·").trim() };
    }
    const dash = line.match(/^(.+?)\s+[–-]\s+(.+)$/);
    if (dash?.[1] && dash[2]) {
      return { day: dash[1].trim(), time: dash[2].trim() };
    }
    const colon = line.match(/^([^:]+):\s*(.+)$/);
    if (colon?.[1] && colon[2]) {
      return { day: colon[1].trim(), time: colon[2].trim() };
    }
    return { day: line, time: "" };
  });
}

function Ubicacion({ brand }: { brand: RestaurantBrand }) {
  const { ref, visible } = useInView();
  const hours = parseHoursRows(brand.businessHours);
  const address = brand.address?.trim() || null;
  const embed = mapsEmbedSrc(brand.googleMapsUrl);
  const mapsHref = mapsExternalHref(brand.googleMapsUrl);
  const phone = telHref(brand.whatsapp);
  const wa = whatsappChatUrl(brand.whatsapp, {
    text: `Hola, me gustaría contactar a ${brand.name}`,
  });

  return (
    <section id="visitanos" ref={ref} className="py-28 bg-[#f5efe6]">
      <div className="max-w-6xl mx-auto px-6">
        <div
          className={`text-center mb-16 transition-all duration-700 motion-reduce:transition-none ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          <div className="inline-flex items-center gap-2 mb-5">
            <div className="h-px w-8 bg-[#b8963e]" />
            <span className="text-[#b8963e] text-xs font-semibold tracking-widest uppercase">
              Visítanos
            </span>
            <div className="h-px w-8 bg-[#b8963e]" />
          </div>
          <h2 className="font-lora-display text-4xl md:text-5xl font-bold text-[#2c1a0e] leading-tight">
            Siempre habrá
            <br />
            <em className="text-[#a07850] font-medium">una silla para ti</em>
          </h2>
        </div>

        <div
          className={`grid md:grid-cols-2 gap-12 items-start transition-all duration-700 delay-200 motion-reduce:transition-none ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <div className="rounded-2xl overflow-hidden border border-[#c8c0b0]/50 shadow-lg aspect-[4/3] relative bg-[#e8dcc8]">
            {embed ? (
              <iframe
                title={`Mapa de ${brand.name}`}
                src={embed}
                className="absolute inset-0 w-full h-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            ) : (
              <MapIllustration name={brand.name} />
            )}
            {address ? (
              <div className="absolute bottom-4 left-4 right-4 bg-[#f5efe6]/90 backdrop-blur-sm rounded-xl p-3 border border-[#c8c0b0]/50 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#b8963e] shrink-0 flex items-center justify-center text-[#f5efe6]">
                  <MapPin className="w-4 h-4" aria-hidden />
                </div>
                <div className="min-w-0">
                  <p className="text-[#2c1a0e] text-xs font-semibold whitespace-pre-line">
                    {address}
                  </p>
                  {mapsHref ? (
                    <a
                      href={mapsHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#a07850] text-xs underline underline-offset-2"
                    >
                      Abrir en Google Maps
                    </a>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-6">
            <div className="bg-[#ede3d4] rounded-2xl p-7 border border-[#c8c0b0]/40">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-[#b8963e]/20 flex items-center justify-center text-[#b8963e]">
                  <Clock className="w-5 h-5" aria-hidden />
                </div>
                <h3 className="font-lora-display text-xl font-semibold text-[#2c1a0e]">
                  Horario de Atención
                </h3>
              </div>
              <div className="space-y-3">
                {hours.map(({ day, time }) => (
                  <div
                    key={`${day}-${time}`}
                    className="flex justify-between items-center gap-4 py-3 border-b border-[#c8c0b0]/40 last:border-0"
                  >
                    <span className="text-[#5c3d2e] font-medium text-sm">{day}</span>
                    {time ? (
                      <span className="text-[#2c1a0e] font-semibold text-sm text-right">
                        {time}
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#ede3d4] rounded-2xl p-7 border border-[#c8c0b0]/40">
              <h3 className="font-lora-display text-xl font-semibold text-[#2c1a0e] mb-5">
                Contáctanos
              </h3>
              <div className="space-y-4">
                {phone || wa ? (
                  <ContactRow
                    icon={<Phone className="w-5 h-5" aria-hidden />}
                    label={brand.whatsapp?.trim() || "WhatsApp"}
                    sub="Reservas y eventos"
                    href={wa ?? phone}
                  />
                ) : null}
                <ContactRow
                  icon={<Mail className="w-5 h-5" aria-hidden />}
                  label="hola@cafedelafe.com"
                  sub="Escríbenos"
                />
                <ContactRow
                  icon={<AtSign className="w-5 h-5" aria-hidden />}
                  label="@cafedelafe"
                  sub="Instagram"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ContactRow({
  icon,
  label,
  sub,
  href,
}: {
  icon: ReactNode;
  label: string;
  sub: string;
  href?: string | null;
}) {
  const content = (
    <>
      <span className="text-[#b8963e] shrink-0">{icon}</span>
      <div>
        <p className="text-[#2c1a0e] text-sm font-semibold">{label}</p>
        <p className="text-[#a07850] text-xs">{sub}</p>
      </div>
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        target={href.startsWith("http") ? "_blank" : undefined}
        rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
        className="flex items-center gap-4 min-h-11 rounded-lg hover:bg-[#e8dcc8]/60 px-1 -mx-1 transition-colors"
      >
        {content}
      </a>
    );
  }

  return <div className="flex items-center gap-4">{content}</div>;
}

function MapIllustration({ name }: { name: string }) {
  return (
    <svg
      viewBox="0 0 400 300"
      className="w-full h-full"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={`Ubicación ilustrada de ${name}`}
    >
      <rect width="400" height="300" fill="#e8dcc8" />
      <rect x="0" y="120" width="400" height="20" fill="#c8b89a" rx="2" />
      <rect x="0" y="200" width="400" height="14" fill="#c8b89a" rx="2" />
      <rect x="120" y="0" width="16" height="300" fill="#c8b89a" rx="2" />
      <rect x="250" y="0" width="14" height="300" fill="#c8b89a" rx="2" />
      <rect x="8" y="8" width="105" height="104" fill="#d4c4a8" rx="6" />
      <rect x="144" y="8" width="98" height="104" fill="#d4c4a8" rx="6" />
      <rect x="272" y="8" width="120" height="104" fill="#d4c4a8" rx="6" />
      <rect x="8" y="148" width="105" height="44" fill="#d4c4a8" rx="6" />
      <rect x="144" y="148" width="98" height="44" fill="#d4c4a8" rx="6" />
      <rect x="272" y="148" width="120" height="44" fill="#d4c4a8" rx="6" />
      <rect x="8" y="222" width="105" height="70" fill="#d4c4a8" rx="6" />
      <rect x="144" y="222" width="98" height="70" fill="#d4c4a8" rx="6" />
      <rect x="272" y="222" width="120" height="70" fill="#d4c4a8" rx="6" />
      {[30, 70, 170, 300, 340].map((x) => (
        <circle key={x} cx={x} cy={140} r="6" fill="#7a8c6e" opacity={0.6} />
      ))}
      <circle cx="192" cy="130" r="16" fill="#b8963e" opacity={0.25} />
      <circle cx="192" cy="130" r="10" fill="#b8963e" />
      <circle cx="192" cy="130" r="4" fill="#f5efe6" />
      <circle
        cx="192"
        cy="130"
        r="22"
        fill="none"
        stroke="#b8963e"
        strokeWidth="1.5"
        opacity={0.4}
      />
      <rect x="144" y="88" width="96" height="24" fill="#2c1a0e" rx="12" opacity={0.85} />
      <text
        x="192"
        y="104"
        textAnchor="middle"
        fill="#f5efe6"
        fontSize="9"
        fontFamily="serif"
        fontWeight="600"
      >
        {name.length > 16 ? `${name.slice(0, 14)}…` : name}
      </text>
    </svg>
  );
}

function Footer({ name }: { name: string }) {
  return (
    <footer className="bg-[#2c1a0e] py-12">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#b8963e] flex items-center justify-center text-[#f5efe6]">
              <CafeMark />
            </div>
            <span className="font-lora-display text-lg font-semibold text-[#f5efe6]">
              {name}
            </span>
          </div>

          <p className="text-[#a07850] text-sm font-light text-center max-w-md">
            &ldquo;El amor de Dios es como el buen café: cálido, presente y suficiente
            para el día.&rdquo;
          </p>

          <div className="text-[#5c3d2e] text-xs inline-flex flex-wrap items-center justify-center gap-2">
            <span>© {new Date().getFullYear()} {name}. Con amor y gratitud.</span>
            <QaEnvBadge />
          </div>
        </div>
      </div>
    </footer>
  );
}

/**
 * Landing institucional Café de la Fe (QA / local).
 * Registrada en `lib/tenant-landings.ts` con `envs: ["local","qa"]`.
 */
export function CafeDeLaFeLanding({
  brand,
  products,
}: CafeDeLaFeLandingProps) {
  const name = brand.name.trim() || "Café de la Fe";
  const tagline =
    brand.tagline?.trim() || "Café de Especialidad";
  const address = brand.address?.trim() || null;
  const hoursRows = parseHoursRows(brand.businessHours);
  const hoursToday =
    hoursRows.find((h) => /lunes|lun|hoy|semana/i.test(h.day))?.time ??
    hoursRows[0]?.time ??
    null;

  return (
    <div className="cafe-de-la-fe-landing font-nunito-sans bg-[#f5efe6] text-[#2c1a0e] overflow-x-hidden min-h-screen">
      <a href="#contenido-principal" className="cafe-skip-link">
        Saltar al contenido
      </a>
      <Nav name={name} />
      <main id="contenido-principal" tabIndex={-1}>
        <Hero
          name={name}
          tagline={tagline}
          address={address}
          hoursToday={hoursToday}
        />
        <Esencia name={name} description={brand.description ?? null} />
        <FeaturedMenu
          products={products}
          canOrder={brand.orderingEnabled !== false}
        />
        <Testimonios />
        <Ubicacion brand={brand} />
      </main>
      <Footer name={name} />
    </div>
  );
}
