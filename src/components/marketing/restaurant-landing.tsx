"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type {
  ChangeEvent,
  CSSProperties,
  FormEvent,
  ReactNode,
  RefObject,
} from "react";
import Link from "next/link";
import { QaEnvBadge } from "@/components/env-qa-badge";
import {
  Search, ChevronDown, ChevronUp, Star, MapPin, Phone,
  Clock, Menu, X,
  MessageCircle,
  ShoppingBag, Package, Users, Award, Gift,
  Music, Coffee, Cake, BookOpen, Send, CheckCircle, ExternalLink,
} from "lucide-react";
import {
  mapsEmbedSrc,
  mapsExternalHref,
  telHref,
  whatsappChatUrl,
} from "@/lib/contact-links";
import {
  DEFAULT_RESTAURANT_BRAND,
  type RestaurantBrand,
} from "@/types/restaurant-brand";
import type { Product } from "@/types/api";

export type { RestaurantBrand };

// ─── Brand (multi-tenant) ────────────────────────────────────────────────────

const BrandContext = createContext<RestaurantBrand>(DEFAULT_RESTAURANT_BRAND);

function useBrand(): RestaurantBrand {
  return useContext(BrandContext);
}

const CatalogContext = createContext<Product[]>([]);

function useCatalog(): Product[] {
  return useContext(CatalogContext);
}

const MENU_PLACEHOLDER_IMAGE =
  "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&h=280&fit=crop&auto=format";

// ─── Data ────────────────────────────────────────────────────────────────────

const GALLERY_IMAGES = [
  { src: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&h=450&fit=crop&auto=format", alt: "Interior del restaurante" },
  { src: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600&h=450&fit=crop&auto=format", alt: "Ambiente íntimo" },
  { src: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&h=450&fit=crop&auto=format", alt: "Pizza Margherita" },
  { src: "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=600&h=450&fit=crop&auto=format", alt: "Pasta Carbonara" },
  { src: "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=600&h=450&fit=crop&auto=format", alt: "Tiramisù" },
  { src: "https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=600&h=450&fit=crop&auto=format", alt: "Spritz aperitivo" },
  { src: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&h=450&fit=crop&auto=format", alt: "Antipasto della casa" },
  { src: "https://images.unsplash.com/photo-1493770348161-369560ae357d?w=600&h=450&fit=crop&auto=format", alt: "Desayuno italiano" },
];

const REVIEWS = [
  { name: "Andrea Martínez", rating: 5, date: "Junio 2025", text: "La carbonara más auténtica fuera de Roma. El ambiente es increíble y el servicio impecable. Reserven con anticipación porque siempre está lleno.", avatar: "AM" },
  { name: "Luis Fontana", rating: 5, date: "Mayo 2025", text: "La pizza tartufo cambió mi vida. La masa madre de 48 horas se nota, crujiente por fuera y esponjosa por dentro. Volvería todos los viernes.", avatar: "LF" },
  { name: "Sofía Reyes", rating: 5, date: "Mayo 2025", text: "Celebramos nuestro aniversario aquí y fue perfecto. La atención personalizada, el tiramisù de la nonna y el ambiente hacen que valga cada peso.", avatar: "SR" },
  { name: "Carlos Bianchi", rating: 4, date: "Abril 2025", text: "Excelente relación calidad-precio. Los arancini de entrada son adictivos. Solo le quitaría una estrella porque el estacionamiento es pequeño.", avatar: "CB" },
  { name: "Mariana López", rating: 5, date: "Abril 2025", text: "El chef Marco explica cada platillo con tanto amor que entiendes que esto no es solo un restaurante, es una experiencia cultural completa.", avatar: "ML" },
  { name: "Diego Russo", rating: 5, date: "Marzo 2025", text: "Vine por el Spritz y me quedé por la pasta. El ragù bolognese cocido 6 horas tiene una profundidad de sabor impresionante. Grazie mille!", avatar: "DR" },
];

const FAQ_ITEMS = [
  { q: "¿Aceptan tarjetas de crédito y débito?", a: "Sí, aceptamos todas las tarjetas de crédito y débito (Visa, Mastercard, American Express). También pagos en efectivo y transferencias. Ofrecemos hasta 3 meses sin intereses con tarjetas participantes." },
  { q: "¿Emiten facturas fiscales?", a: "Sí, emitimos facturas CFDI. Solicítala al momento del pago o a través de nuestro portal en línea con el folio de tu ticket dentro de los 30 días naturales." },
  { q: "¿Hay estacionamiento disponible?", a: "Contamos con valet parking cortesía para consumos mayores a $500. También hay estacionamiento público a media cuadra en Calle Florencia #45." },
  { q: "¿Se permiten mascotas?", a: "Sí aceptamos mascotas en nuestra terraza exterior. Contamos con bebederos y snacks para perros. Te pedimos que vengan con correa y vacunas al día." },
  { q: "¿Tienen opciones vegetarianas y veganas?", a: "Más del 40% de nuestra carta es vegetariano o adaptable. Tenemos opciones veganas marcadas en la carta. Solo avisa al mesero y adaptamos cualquier platillo." },
  { q: "¿Hacen eventos privados?", a: "Sí, tenemos un salón privado para hasta 40 personas con carta especial. Contáctanos por WhatsApp o email para cotizaciones y disponibilidad." },
  { q: "¿Cuál es la política de cancelación?", a: "Las reservaciones pueden cancelarse hasta 2 horas antes sin cargo. Para grupos de 8+ personas pedimos 24 horas de anticipación." },
];

type Promo = {
  title: string;
  subtitle: string;
  desc: string;
  badge: string;
  /** One-off deadline → live countdown while still in the future. */
  endsIn?: Date;
  /** Recurring / always-on schedule — preferred over countdown for daily windows. */
  schedule?: string;
  /** Live status under schedule (e.g. Happy Hour “Activo ahora”). */
  status?: () => string;
};

/** Status line for weekday Happy Hour (no fake SLA; no dead 00:00:00). */
function happyHourStatus(): string {
  const now = new Date();
  const day = now.getDay(); // 0 Sun … 6 Sat
  const mins = now.getHours() * 60 + now.getMinutes();
  const start = 14 * 60;
  const end = 17 * 60;
  const weekday = day >= 1 && day <= 5;
  if (weekday && mins >= start && mins < end) return "Activo ahora";
  if (weekday && mins < start) return "Hoy desde las 14:00";
  if (weekday && mins >= end) return "Vuelve mañana · 14:00–17:00";
  return "Próximo día hábil · 14:00–17:00";
}

/** Recurring Martes de Pizza — schedule truth, never a fake countdown. */
function tuesdayPizzaStatus(): string {
  const day = new Date().getDay();
  if (day === 2) return "Activo hoy";
  if (day === 1) return "Mañana · todo el día";
  return "Próximo martes";
}

/** Weekend combo — schedule truth, never a fake countdown. */
function weekendComboStatus(): string {
  const day = new Date().getDay();
  if (day === 6 || day === 0) return "Activo este fin de semana";
  if (day === 5) return "Desde mañana · sáb y dom";
  return "Próximo sábado y domingo";
}

const PROMOS: Promo[] = [
  {
    title: "2x1 en Pizzas",
    subtitle: "Martes de Pizza",
    desc: "Cada martes, compra una pizza y la segunda es gratis. Válido en toda la carta de pizzas.",
    badge: "Martes",
    schedule: "Cada martes",
    status: tuesdayPizzaStatus,
  },
  {
    title: "Happy Hour",
    subtitle: "Lunes a Viernes",
    desc: "De 14:00 a 17:00 hrs. 50% de descuento en toda la barra. Spritz, vinos y cocteles.",
    badge: "Diario",
    schedule: "Lun–Vie · 14:00–17:00",
    status: happyHourStatus,
  },
  {
    title: "Combo Familiar",
    subtitle: "Fines de semana",
    desc: "2 pizzas + 4 pastas + postre familiar + 4 refrescos por solo $890. Ideal para toda la familia.",
    badge: "Sáb–Dom",
    schedule: "Sábados y domingos",
    status: weekendComboStatus,
  },
  {
    title: "Descuento Estudiante",
    subtitle: "Siempre vigente",
    desc: "Presenta tu credencial escolar vigente y obtén 15% de descuento en tu consumo total.",
    badge: "Siempre",
    schedule: "Todos los días · con credencial",
    status: () => "Vigente con credencial",
  },
];

/** Chef / house stories — not a repeat of the live menu grid. */
const HOUSE_PICKS = [
  {
    badge: "Del chef",
    title: "Carbonara alla Conti",
    story:
      "Guanciale, pecorino y yema — sin crema. La versión que Marco trajo de Bolonia y no negocia.",
    img: "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=640&h=480&fit=crop&auto=format",
    alt: "Pasta carbonara de la casa",
  },
  {
    badge: "De la nonna",
    title: "Tiramisù de la casa",
    story:
      "Mascarpone batido a mano y café de Sicilia. El postre que cierra casi cada mesa Conti desde los ochenta.",
    img: "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=640&h=480&fit=crop&auto=format",
    alt: "Tiramisù de la casa",
  },
  {
    badge: "De temporada",
    title: "Pizza al tartufo",
    story:
      "Masa madre de 48 horas y aceite de trufa cuando la temporada lo permite. Pídela en mesa o llévala.",
    img: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=640&h=480&fit=crop&auto=format",
    alt: "Pizza al tartufo",
  },
];

const RESERVA_HORAS = [
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "19:00",
  "19:30",
  "20:00",
  "20:30",
  "21:00",
  "21:30",
  "22:00",
] as const;

function todayIsoDate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** True when fecha is today and hora has already passed (local time). */
function isReservationSlotPast(fecha: string, hora: string) {
  if (!fecha || !hora) return false;
  if (fecha !== todayIsoDate()) return false;
  const [hh, mm] = hora.split(":").map((n) => Number(n));
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return false;
  const slot = new Date();
  slot.setHours(hh!, mm!, 0, 0);
  return slot.getTime() <= Date.now();
}

function availableReservaHoras(fecha: string) {
  return RESERVA_HORAS.filter((h) => !isReservationSlotPast(fecha, h));
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({
    behavior: prefersReducedMotion() ? "auto" : "smooth",
    block: "start",
  });
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function remainingTime(target: Date) {
  const diff = Math.max(0, target.getTime() - Date.now());
  return {
    h: Math.floor(diff / 3600000),
    m: Math.floor((diff % 3600000) / 60000),
    s: Math.floor((diff % 60000) / 1000),
  };
}

/** One shared 1s clock for all visible promo countdowns. */
const countdownSubscribers = new Set<() => void>();
let countdownInterval: number | undefined;

function subscribeCountdownTick(onTick: () => void) {
  countdownSubscribers.add(onTick);
  if (countdownInterval === undefined && !prefersReducedMotion()) {
    countdownInterval = window.setInterval(() => {
      countdownSubscribers.forEach((fn) => fn());
    }, 1000);
  }
  return () => {
    countdownSubscribers.delete(onTick);
    if (countdownSubscribers.size === 0 && countdownInterval !== undefined) {
      window.clearInterval(countdownInterval);
      countdownInterval = undefined;
    }
  };
}

function useInView<T extends Element>(
  rootMargin = "120px",
): [RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setInView(Boolean(entry?.isIntersecting)),
      { rootMargin, threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin]);

  return [ref, inView];
}

/** Ticks only while `active` (e.g. card in view); shares one interval across cards. */
function useCountdown(target: Date | null, active: boolean) {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!target || !active || prefersReducedMotion()) return;
    return subscribeCountdownTick(() => setTick((n) => n + 1));
  }, [active, target]);

  return target ? remainingTime(target) : { h: 0, m: 0, s: 0 };
}

// ─── Layout tokens (4-based rhythm) ──────────────────────────────────────────

/** Primary visit path — generous section cadence. */
const SECTION_Y = "py-20 md:py-28";
/** Secondary “Más del local” — denser, demoted. */
const SECTION_Y_DENSE = "py-14 md:py-16";
/** Shared horizontal shell (safe-area aware). */
const SHELL =
  "mx-auto w-full max-w-7xl pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))] sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))] lg:pl-[max(2rem,env(safe-area-inset-left))] lg:pr-[max(2rem,env(safe-area-inset-right))]";
const SHELL_NARROW =
  "mx-auto w-full max-w-5xl pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))] sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))] lg:pl-[max(2rem,env(safe-area-inset-left))] lg:pr-[max(2rem,env(safe-area-inset-right))]";
const SHELL_FORM =
  "mx-auto w-full max-w-6xl pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))] sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))] lg:pl-[max(2rem,env(safe-area-inset-left))] lg:pr-[max(2rem,env(safe-area-inset-right))]";
/** Accent CTA (terracotta). */
const BTN_ACCENT =
  "bg-accent text-white font-nunito-sans text-xs tracking-widest uppercase rounded-sm transition-[filter] duration-200 hover:brightness-110 motion-reduce:transition-none min-h-11";
/** Primary filled CTA (forest). */
const BTN_PRIMARY =
  "bg-primary text-primary-foreground font-nunito-sans text-xs tracking-widest uppercase rounded-sm transition-[filter] duration-200 hover:brightness-110 motion-reduce:transition-none min-h-11";
/** Field / meta labels — one step on the tenant type ramp. */
const LABEL_META =
  "font-nunito-sans text-xs tracking-widest uppercase";
const LABEL_EYEBROW =
  "font-nunito-sans text-xs tracking-[0.16em] uppercase";

/** Featured offer by calendar — no fake urgency. */
function pickFeaturedPromoIndex(now = new Date()): number {
  const day = now.getDay();
  if (day === 2) return 0; // Martes de Pizza
  if (day === 0 || day === 6) return 2; // Combo Familiar
  if (day >= 1 && day <= 5) return 1; // Happy Hour (weekdays)
  return 0;
}

function useFeaturedPromoIndex() {
  const [index] = useState(pickFeaturedPromoIndex);
  return index;
}
// ─── Small components ────────────────────────────────────────────────────────

function SectionHeader({
  eyebrow,
  title,
  subtitle,
  compact = false,
  light = false,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  /** Tighter stack for demoted / secondary bands. */
  compact?: boolean;
  /** Light text on dark section backgrounds. */
  light?: boolean;
}) {
  return (
    <div className={`text-center ${compact ? "mb-8" : "mb-10 md:mb-12"}`}>
      <p
        className={`${LABEL_EYEBROW} mb-4 ${
          light ? "text-[color-mix(in_srgb,var(--brand-gold)_90%,transparent)]" : "text-accent"
        }`}
      >
        {eyebrow}
      </p>
      <h2
        className={`font-playfair-display font-semibold leading-tight ${
          compact ? "text-3xl md:text-4xl" : "text-3xl md:text-4xl lg:text-5xl"
        } ${light ? "text-white" : "text-foreground"}`}
      >
        {title}
      </h2>
      {subtitle ? (
        <p
          className={`mt-3 font-nunito-sans max-w-xl mx-auto leading-relaxed ${
            compact ? "text-sm" : "text-base"
          } ${light ? "text-white/65" : "text-muted-foreground"}`}
        >
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star key={i} size={14} className={i <= rating ? "fill-[var(--brand-gold)] text-[var(--brand-gold)]" : "text-muted"} />
      ))}
    </div>
  );
}

// ─── Nav ─────────────────────────────────────────────────────────────────────

function Navbar() {
  const brand = useBrand();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeId, setActiveId] = useState("");
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);
  const wasOpenRef = useRef(false);

  // Decide-tonight: ≤4 destinations + one CTA (Reservar / Ver carta).
  const links = useMemo(() => {
    const items: { label: string; id: string }[] = [
      { label: "Carta", id: "carta" },
      ...(brand.orderingEnabled !== false
        ? [{ label: "Cómo pedir", id: "como-pedir" }]
        : []),
      { label: "Ubicación", id: "ubicacion" },
      { label: "Más del local", id: "mas-del-local" },
    ];
    return items;
  }, [brand.orderingEnabled]);

  useEffect(() => {
    const onScrollChrome = () => setScrolled(window.scrollY > 60);
    onScrollChrome();
    window.addEventListener("scroll", onScrollChrome, { passive: true });
    return () => window.removeEventListener("scroll", onScrollChrome);
  }, []);

  useEffect(() => {
    const ids = links.map((l) => l.id);
    const updateActive = () => {
      const marker = 96; // approx fixed nav + safe area
      let current = "";
      for (const id of ids) {
        const el = document.getElementById(id);
        if (!el) continue;
        if (el.getBoundingClientRect().top - marker <= 0) current = id;
      }
      setActiveId(current);
    };
    updateActive();
    window.addEventListener("scroll", updateActive, { passive: true });
    window.addEventListener("resize", updateActive);
    return () => {
      window.removeEventListener("scroll", updateActive);
      window.removeEventListener("resize", updateActive);
    };
  }, [links]);

  useEffect(() => {
    if (!open) {
      document.body.style.overflow = "";
      if (wasOpenRef.current) menuBtnRef.current?.focus();
      wasOpenRef.current = false;
      return;
    }

    wasOpenRef.current = true;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const panel = menuPanelRef.current;
    const firstInMenu = panel?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    firstInMenu?.focus();

    const getFocusable = () => {
      const inMenu = panel
        ? Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
        : [];
      const toggle = menuBtnRef.current;
      return toggle ? [toggle, ...inMenu] : inMenu;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const items = getFocusable();
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement;
      if (event.shiftKey) {
        if (active === first) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const scrollTo = (id: string) => {
    scrollToId(id);
    setOpen(false);
  };

  const linkClass = (id: string) =>
    `font-nunito-sans text-xs tracking-widest uppercase transition-colors motion-reduce:transition-none ${
      activeId === id
        ? "text-[var(--brand-gold)] opacity-100"
        : "text-[#f7f3eb] opacity-80 hover:opacity-100 hover:text-[var(--brand-gold)]"
    }`;

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-[background-color,box-shadow] duration-300 motion-reduce:transition-none pt-[env(safe-area-inset-top)] ${
        scrolled || open ? "bg-primary/95 shadow-md" : "bg-transparent"
      }`}
    >
      <div className={`${SHELL} flex items-center justify-between h-14 sm:h-16 gap-3`}>
        <button
          type="button"
          onClick={() => scrollTo("inicio")}
          className="flex items-center gap-2 sm:gap-3 leading-none min-w-0 min-h-11"
        >
          {brand.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={brand.logoUrl}
              alt=""
              className="size-8 sm:size-9 rounded-sm object-cover ring-1 ring-white/20 shrink-0"
            />
          ) : null}
          <span className="font-pinyon-script text-xl sm:text-2xl text-[var(--brand-gold)] truncate max-w-[42vw] sm:max-w-none">
            {brand.name}
          </span>
        </button>
        <nav className="hidden lg:flex items-center gap-7" aria-label="Principal">
          {links.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => scrollTo(l.id)}
              className={linkClass(l.id)}
              aria-current={activeId === l.id ? "true" : undefined}
            >
              {l.label}
            </button>
          ))}
        </nav>
        {brand.hasReservations ? (
          <button
            type="button"
            onClick={() => scrollTo("reservaciones")}
            className={`hidden lg:inline-flex items-center gap-2 px-5 py-2.5 ${BTN_ACCENT}`}
          >
            Reservar mesa
          </button>
        ) : (
          <button
            type="button"
            onClick={() => scrollTo("carta")}
            className={`hidden lg:inline-flex items-center gap-2 px-5 py-2.5 ${BTN_ACCENT}`}
          >
            Ver carta
          </button>
        )}
        <button
          ref={menuBtnRef}
          type="button"
          className="lg:hidden text-[#f7f3eb] inline-flex items-center justify-center size-11 shrink-0 -mr-1"
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={open}
          aria-controls="trattoria-mobile-nav"
          onClick={() => setOpen(!open)}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
      {open ? (
        <div
          ref={menuPanelRef}
          id="trattoria-mobile-nav"
          className="lg:hidden bg-primary border-t border-white/10 max-h-[min(70vh,calc(100dvh-3.5rem-env(safe-area-inset-top)))] overflow-y-auto overscroll-contain"
        >
          <div className="px-5 sm:px-6 py-4 space-y-1 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {links.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => scrollTo(l.id)}
                className={`block w-full text-left font-nunito-sans text-sm tracking-widest uppercase py-3 min-h-11 border-b border-white/10 ${
                  activeId === l.id
                    ? "text-[var(--brand-gold)]"
                    : "text-[#f7f3eb]"
                }`}
                aria-current={activeId === l.id ? "true" : undefined}
              >
                {l.label}
              </button>
            ))}
            {brand.hasReservations ? (
              <button
                type="button"
                onClick={() => scrollTo("reservaciones")}
                className={`mt-3 w-full py-3.5 ${BTN_ACCENT}`}
              >
                Reservar mesa
              </button>
            ) : (
              <button
                type="button"
                onClick={() => scrollTo("carta")}
                className={`mt-3 flex w-full items-center justify-center py-3.5 ${BTN_ACCENT}`}
              >
                Ver carta
              </button>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}

// ─── Hero ────────────────────────────────────────────────────────────────────

function Hero() {
  const brand = useBrand();
  const heroImage =
    brand.bannerUrl ||
    "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1600&h=900&fit=crop&auto=format";
  const subtitle =
    brand.description?.trim() ||
    "Ingredientes frescos, recetas de la casa y un servicio que te hará sentir como en casa.";

  const secondary = brand.hasReservations
    ? { label: "Reservar mesa", id: "reservaciones" as const }
    : { label: "Cómo llegar", id: "ubicacion" as const };

  const ctas: Array<{ label: string; primary: boolean; id: string }> = [
    { label: "Ver carta", id: "carta", primary: true },
    { ...secondary, primary: false },
  ];

  return (
    <section
      id="inicio"
      className="relative min-h-[100svh] flex items-center justify-center overflow-hidden pt-[calc(3.5rem+env(safe-area-inset-top))] pb-[env(safe-area-inset-bottom)]"
    >
      <div className="absolute inset-0 bg-[var(--brand-ink)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={heroImage}
          alt={`Interior de ${brand.name}`}
          className="w-full h-full object-cover opacity-50"
          sizes="100vw"
          fetchPriority="high"
          decoding="async"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[color-mix(in_srgb,var(--brand-ink)_50%,transparent)] via-[color-mix(in_srgb,var(--brand-ink)_35%,transparent)] to-[color-mix(in_srgb,var(--brand-ink)_85%,transparent)]" />
      </div>
      <div className="relative z-10 text-center px-5 sm:px-6 max-w-3xl mx-auto w-full">
        <p className="font-nunito-sans text-xs tracking-[0.2em] uppercase text-[color-mix(in_srgb,var(--brand-gold)_90%,transparent)] mb-4 sm:mb-5">
          {brand.tagline ?? "Restaurante"}
        </p>
        <h1 className="font-playfair-display text-[clamp(2.25rem,8vw,4.5rem)] font-semibold text-white leading-[1.08] mb-4 sm:mb-5 break-words">
          {brand.name}
        </h1>
        <p className="font-nunito-sans text-base md:text-lg text-white/70 max-w-lg mx-auto leading-relaxed mb-8 sm:mb-10">
          {subtitle}
        </p>
        <div className="flex flex-col sm:flex-row flex-wrap gap-3 justify-center items-stretch sm:items-center max-w-sm sm:max-w-none mx-auto">
          {ctas.map((btn) => {
            const className = `px-7 py-3.5 w-full sm:w-auto ${
              btn.primary
                ? BTN_ACCENT
                : "font-nunito-sans text-xs tracking-widest uppercase rounded-sm border border-white/25 text-white/90 hover:border-white/50 hover:bg-white/5 transition-colors duration-200 motion-reduce:transition-none min-h-11"
            }`;
            return (
              <button
                key={btn.label}
                type="button"
                onClick={() => scrollToId(btn.id)}
                className={className}
              >
                {btn.label}
              </button>
            );
          })}
        </div>
      </div>
      <button
        type="button"
        onClick={() => scrollToId("carta")}
        className="absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 text-white/30 hover:text-white/55 transition-colors size-11 inline-flex items-center justify-center"
        aria-label="Ir a la carta"
      >
        <ChevronDown size={24} />
      </button>
    </section>
  );
}

// ─── Carta ───────────────────────────────────────────────────────────────────

const MENU_INITIAL_VISIBLE = 10;
const MENU_LOAD_MORE_STEP = 20;

function DigitalMenu() {
  const products = useCatalog();
  const [categoryId, setCategoryId] = useState<number | "all">("all");
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(MENU_INITIAL_VISIBLE);
  const [filterKey, setFilterKey] = useState(() => `${categoryId}\0${search}`);
  const nextFilterKey = `${categoryId}\0${search}`;
  // Al cambiar filtros, volver a la primera página visual (durante render, no en effect).
  if (filterKey !== nextFilterKey) {
    setFilterKey(nextFilterKey);
    setVisibleCount(MENU_INITIAL_VISIBLE);
  }

  const categories = useMemo(() => {
    const seen = new Map<number, string>();
    for (const product of products) {
      if (!seen.has(product.categoryId)) {
        seen.set(product.categoryId, product.categoryName);
      }
    }
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [products]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return products.filter((product) => {
      const catOk =
        categoryId === "all" || product.categoryId === categoryId;
      const searchOk =
        !query ||
        product.name.toLowerCase().includes(query) ||
        (product.description ?? "").toLowerCase().includes(query);
      return catOk && searchOk;
    });
  }, [products, categoryId, search]);

  const visible = filtered.slice(0, visibleCount);
  const remaining = Math.max(0, filtered.length - visible.length);
  const nextBatch = Math.min(MENU_LOAD_MORE_STEP, remaining);

  const filtersActive = categoryId !== "all" || search.trim().length > 0;

  const clearFilters = () => {
    setCategoryId("all");
    setSearch("");
  };

  return (
    <section id="carta" className={`${SECTION_Y} bg-background`}>
      <div className={SHELL}>
        <SectionHeader
          eyebrow="Carta"
          title="Nuestra Carta"
          subtitle="Explora por categoría o busca por nombre."
        />

        <div className="relative max-w-md mx-auto mb-5">
          <label htmlFor="trattoria-menu-search" className="sr-only">
            Buscar platillo
          </label>
          <Search
            size={16}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            id="trattoria-menu-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar platillo..."
            type="search"
            autoComplete="off"
            className="w-full pl-11 pr-4 py-3 min-h-11 bg-card border border-border rounded-sm font-nunito-sans text-base sm:text-sm"
          />
        </div>

        {categories.length > 0 ? (
          <div className="relative mb-8">
            <div className="flex sm:flex-wrap sm:justify-center gap-2 overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <button
                type="button"
                onClick={() => setCategoryId("all")}
                className={`font-nunito-sans text-xs tracking-widest uppercase px-5 py-2.5 rounded-sm border transition-all motion-reduce:transition-none shrink-0 min-h-11 ${
                  categoryId === "all"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                }`}
              >
                Todos
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategoryId(cat.id)}
                  className={`font-nunito-sans text-xs tracking-widest uppercase px-5 py-2.5 rounded-sm border transition-all motion-reduce:transition-none shrink-0 min-h-11 ${
                    categoryId === cat.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
            <div
              className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-background to-transparent sm:hidden"
              aria-hidden
            />
            {filtersActive ? (
              <div className="mt-3 flex justify-center">
                <button
                  type="button"
                  onClick={clearFilters}
                  className="font-nunito-sans text-xs tracking-widest uppercase text-accent underline underline-offset-4 min-h-11 px-3"
                >
                  Limpiar filtros
                </button>
              </div>
            ) : null}
          </div>
        ) : filtersActive ? (
          <div className="mb-8 flex justify-center">
            <button
              type="button"
              onClick={clearFilters}
              className="font-nunito-sans text-xs tracking-widest uppercase text-accent underline underline-offset-4 min-h-11 px-3"
            >
              Limpiar filtros
            </button>
          </div>
        ) : null}

        {products.length === 0 ? (
          <p className="text-center text-muted-foreground font-nunito-sans py-16">
            Pronto publicaremos la carta. Mientras tanto, escríbenos por
            WhatsApp o visita el local.
          </p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 px-4">
            <p className="text-muted-foreground font-nunito-sans mb-4">
              No se encontraron platillos con esos filtros.
            </p>
            <button
              type="button"
              onClick={clearFilters}
              className={`inline-flex px-6 py-3 ${BTN_PRIMARY}`}
            >
              Limpiar filtros
            </button>
          </div>
        ) : (
          <>
            <p className="mb-5 text-center font-nunito-sans text-xs tracking-wide text-muted-foreground">
              Mostrando {visible.length} de {filtered.length} platillos
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
              {visible.map((item, index) => (
                <div
                  key={item.uuid}
                  className="bg-card border border-border rounded-sm overflow-hidden transition-colors group min-w-0 hover:border-primary/25"
                >
                  <div className="relative aspect-[4/3] bg-muted overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.imageUrl || MENU_PLACEHOLDER_IMAGE}
                      alt={item.name}
                      className="w-full h-full object-cover"
                      loading={index < 3 ? "eager" : "lazy"}
                      decoding="async"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                    <span className={`absolute top-3 left-3 ${LABEL_META} bg-black/40 text-white px-2.5 py-1 rounded-sm`}>
                      {item.categoryName}
                    </span>
                  </div>
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-2 gap-3">
                      <h3 className="font-playfair-display text-lg font-semibold leading-tight min-w-0">
                        {item.name}
                      </h3>
                      <span className="font-playfair-display text-lg font-semibold text-accent shrink-0 tabular-nums">
                        {item.formattedPrice}
                      </span>
                    </div>
                    {item.description ? (
                      <p className="font-nunito-sans text-sm text-muted-foreground leading-relaxed">
                        {item.description}
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>

            {remaining > 0 ? (
              <div className="mt-10 flex flex-col items-center gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setVisibleCount((n) => n + MENU_LOAD_MORE_STEP)
                  }
                  className="font-nunito-sans text-xs tracking-widest uppercase px-8 py-3.5 rounded-sm border border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-colors motion-reduce:transition-none min-h-11"
                >
                  Ver {nextBatch} más
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

// ─── Destacados (house picks — not a menu duplicate) ─────────────────────────

function Destacados() {
  return (
    <section id="destacados" className={`${SECTION_Y} bg-secondary`}>
      <div className={SHELL}>
        <SectionHeader
          eyebrow="De la cucina"
          title="Lo que el chef pone en la mesa"
          subtitle="Tres firmas Conti con historia — la carta completa está arriba, con precios y stock."
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-8">
          {HOUSE_PICKS.map((pick) => (
            <article key={pick.title} className="min-w-0 flex flex-col">
              <div className="relative aspect-[5/4] bg-muted overflow-hidden rounded-sm mb-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={pick.img}
                  alt={pick.alt}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
              </div>
              <p className={`${LABEL_EYEBROW} text-accent mb-2`}>
                {pick.badge}
              </p>
              <h3 className="font-playfair-display text-xl font-semibold text-foreground leading-tight">
                {pick.title}
              </h3>
              <p className="mt-2 font-nunito-sans text-sm text-muted-foreground leading-relaxed flex-1">
                {pick.story}
              </p>
            </article>
          ))}
        </div>
        <div className="mt-10 text-center">
          <button
            type="button"
            onClick={() => scrollToId("carta")}
            className={`inline-flex items-center gap-2 px-8 py-3.5 ${BTN_PRIMARY}`}
          >
            Ver carta
          </button>
        </div>
      </div>
    </section>
  );
}

// ─── Promociones ─────────────────────────────────────────────────────────────

/** Live status line for recurring promos; refreshes once a minute while mounted. */
function usePromoStatus(statusFn?: () => string) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!statusFn) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 60_000);
    return () => window.clearInterval(id);
  }, [statusFn]);

  return useMemo(() => statusFn?.() ?? null, [statusFn, tick]);
}

function PromoCard({ promo }: { promo: Promo }) {
  const [ref, inView] = useInView<HTMLDivElement>("80px");
  const deadline = promo.endsIn ?? null;
  const time = useCountdown(deadline, Boolean(deadline) && inView);
  const showCountdown =
    Boolean(deadline) && (time.h > 0 || time.m > 0 || time.s > 0);
  const status = usePromoStatus(
    !showCountdown && promo.status ? promo.status : undefined,
  );
  const scheduleLabel = promo.schedule;

  return (
    <div
      ref={ref}
      className="bg-card border border-border rounded-sm p-6 flex flex-col justify-between min-h-[220px]"
    >
      <div>
        <span className={`${LABEL_META} text-accent`}>
          {promo.badge}
        </span>
        <h3 className="font-playfair-display text-xl font-semibold text-foreground mt-2 leading-tight">
          {promo.title}
        </h3>
        <p className="font-nunito-sans text-xs tracking-widest uppercase text-muted-foreground mt-1">
          {promo.subtitle}
        </p>
        <p className="font-nunito-sans text-sm text-muted-foreground mt-3 leading-relaxed">
          {promo.desc}
        </p>
      </div>
      {showCountdown ? (
        <div className="flex gap-5 mt-5 pt-4 border-t border-border text-foreground">
          {(
            [
              ["Horas", time.h],
              ["Min", time.m],
              ["Seg", time.s],
            ] as const
          ).map(([label, val]) => (
            <div key={label} className="text-left">
              <div className="font-playfair-display text-xl font-semibold tabular-nums">
                {String(val).padStart(2, "0")}
              </div>
              <div className={`${LABEL_META} text-muted-foreground mt-0.5`}>
                {label}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-5 pt-4 border-t border-border">
          {scheduleLabel ? (
            <p className="font-nunito-sans text-sm font-semibold text-foreground">
              {scheduleLabel}
            </p>
          ) : (
            <p className="font-nunito-sans text-sm text-muted-foreground">
              Pregunta en mesa por vigencia.
            </p>
          )}
          {status ? (
            <p className="mt-1 font-nunito-sans text-xs tracking-wide text-accent">
              {status}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}

/** One promo in the primary path; the rest live under Más del local. */
function FeaturedPromo() {
  const featuredIndex = useFeaturedPromoIndex();
  const promo = PROMOS[featuredIndex] ?? PROMOS[0];
  if (!promo) return null;
  return (
    <section id="promocion" className={`${SECTION_Y_DENSE} bg-background`}>
      <div className={SHELL}>
        <div className="mx-auto max-w-xl">
          <SectionHeader
            eyebrow="Oferta"
            title="Promo de hoy"
            subtitle="Según el día · pregunta en mesa por condiciones."
            compact
          />
          <PromoCard promo={promo} />
        </div>
      </div>
    </section>
  );
}

function Promociones() {
  const featuredIndex = useFeaturedPromoIndex();
  const more = PROMOS.filter((_, i) => i !== featuredIndex);
  if (more.length === 0) return null;
  return (
    <section id="promociones" className={`${SECTION_Y_DENSE} bg-background`}>
      <div className={SHELL}>
        <SectionHeader
          eyebrow="Ofertas"
          title="Más promociones"
          subtitle="Horarios recurrentes · pregunta en mesa por condiciones."
          compact
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {more.map((p) => (
            <PromoCard key={p.title} promo={p} />
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Cómo pedir ──────────────────────────────────────────────────────────────

function ComoPedir() {
  const brand = useBrand();
  const wa = whatsappChatUrl(brand.whatsapp);

  const modalityBits: string[] = [];
  if (brand.hasDelivery) modalityBits.push("A domicilio");
  if (brand.hasPickup) modalityBits.push("Para llevar");
  const canOrder = brand.orderingEnabled !== false;
  const eyebrow = canOrder
    ? modalityBits.length > 0
      ? modalityBits.join(" y ")
      : "Pedidos"
    : "Carta";

  const platforms = [
    ...(wa
      ? [
          {
            name: "Pedir por WhatsApp",
            desc: "Escríbenos tu pedido o una duda",
            color: "bg-accent",
            hov: "hover:brightness-110",
            icon: <MessageCircle size={24} />,
            link: wa,
            external: true,
            primary: true,
          },
        ]
      : []),
    ...(brand.hasPickup && canOrder
      ? [
          {
            name: "Pick up",
            desc: "Pide para llevar y recoge en el local",
            color: "bg-white/5 border border-white/15",
            hov: "hover:bg-white/10",
            icon: <Package size={24} />,
            link: "/menu",
            external: false,
            primary: false,
          },
        ]
      : []),
    {
      name: "Ver carta",
      desc: canOrder
        ? "Consulta la carta y arma tu pedido"
        : "Consulta la carta completa",
      color: "bg-white/5 border border-white/15",
      hov: "hover:bg-white/10",
      icon: <ShoppingBag size={24} />,
      scrollId: "carta" as const,
      external: false,
      primary: false,
    },
  ];

  const reassurance = canOrder
    ? wa
      ? "Te confirmamos el pedido por el mismo canal. La cocina lo prepara solo cuando el restaurante lo acepta — no es un envío automático."
      : "Arma tu pedido en la carta. Queda listo cuando el restaurante lo confirma — no es un envío automático."
    : "Por ahora la carta es solo consulta. Si necesitas algo, escríbenos en Ubicación.";

  const subtitle = !canOrder
    ? "Explora la carta. Por ahora es solo consulta."
    : brand.hasPickup && brand.hasDelivery
      ? "Elige el canal: WhatsApp, Pick up o la carta (para llevar o a domicilio según disponibilidad)."
      : brand.hasPickup
        ? "Elige el canal: WhatsApp, Pick up o consulta la carta para armar tu pedido."
        : brand.hasDelivery
          ? "Elige el canal: WhatsApp o la carta digital (mesa o a domicilio según disponibilidad)."
          : "Elige el canal: WhatsApp o la carta digital desde la mesa.";

  return (
    <section id="como-pedir" className={`${SECTION_Y} bg-primary`}>
      <div className={SHELL_NARROW}>
        <SectionHeader
          eyebrow={eyebrow}
          title="Cómo pedir"
          subtitle={subtitle}
          light
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-3xl mx-auto">
          {platforms.map((p) => {
            const className = `${p.color} ${p.hov} text-white p-5 rounded-sm flex items-center gap-4 transition-[filter,background-color] duration-200 motion-reduce:transition-none group min-h-11 w-full text-left`;
            const body = (
              <>
                <div className="shrink-0 w-11 h-11 bg-white/10 rounded-sm flex items-center justify-center">
                  {p.icon}
                </div>
                <div className="min-w-0">
                  <div className="font-playfair-display text-lg font-semibold">
                    {p.name}
                  </div>
                  <div className="font-nunito-sans text-xs text-white/65 mt-0.5">
                    {p.desc}
                  </div>
                </div>
                <ExternalLink
                  size={14}
                  className={`ml-auto shrink-0 text-white/35 ${
                    p.external ? "" : "invisible"
                  }`}
                  aria-hidden
                />
              </>
            );
            if ("scrollId" in p && p.scrollId) {
              return (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => scrollToId(p.scrollId)}
                  className={className}
                >
                  {body}
                </button>
              );
            }
            return (
              <a
                key={p.name}
                href={"link" in p ? p.link : undefined}
                {...(p.external
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
                className={className}
              >
                {body}
              </a>
            );
          })}
        </div>
        <p className="mt-6 max-w-xl mx-auto text-center font-nunito-sans text-sm text-white/70 leading-relaxed">
          {reassurance}
        </p>
      </div>
    </section>
  );
}

// ─── Reservaciones ────────────────────────────────────────────────────────────

function Reservaciones() {
  const brand = useBrand();
  const [form, setForm] = useState({
    nombre: "",
    personas: "2",
    fecha: "",
    hora: "20:00",
    telefono: "",
    notas: "",
  });
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const wa = whatsappChatUrl(brand.whatsapp);
  const phoneHref = telHref(brand.whatsapp);
  const horasDisponibles = useMemo(
    () => availableReservaHoras(form.fecha),
    [form.fecha],
  );

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setForm((f) => {
      const next = { ...f, [name]: value };
      if (name === "fecha") {
        const horas = availableReservaHoras(value);
        if (
          horas.length > 0 &&
          !horas.includes(next.hora as (typeof RESERVA_HORAS)[number])
        ) {
          next.hora = horas[0]!;
        }
      }
      return next;
    });
  };

  const buildRequestMessage = () =>
    [
      `Hola, quiero solicitar una mesa en ${brand.name}.`,
      `Nombre: ${form.nombre.trim()}`,
      `Personas: ${form.personas}`,
      `Fecha: ${form.fecha}`,
      `Hora: ${form.hora}`,
      `Teléfono: ${form.telefono.trim()}`,
      form.notas.trim() ? `Notas: ${form.notas.trim()}` : null,
    ]
      .filter(Boolean)
      .join("\n");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (isReservationSlotPast(form.fecha, form.hora)) {
      setFormError(
        "Esa hora ya pasó para hoy. Elige otra hora o una fecha posterior.",
      );
      return;
    }
    if (form.fecha && horasDisponibles.length === 0) {
      setFormError(
        "No quedan horarios disponibles para hoy. Elige otra fecha.",
      );
      return;
    }
    const message = buildRequestMessage();
    if (!wa) {
      setFormError(
        "WhatsApp no está disponible. Escríbenos desde Ubicación o llama al local.",
      );
      return;
    }
    setSubmitting(true);
    window.open(
      `${wa}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer",
    );
    setSent(true);
    setSubmitting(false);
  };

  const labelCls = "block font-nunito-sans text-xs tracking-widest uppercase text-muted-foreground mb-2";
  const inputCls =
    "w-full min-h-11 bg-secondary border border-border rounded-sm px-4 py-3 font-nunito-sans text-sm";

  const contactRows: Array<[ReactNode, string, string, string | null]> = [
    [
      <Clock key="clock" size={18} />,
      "Horario",
      brand.businessHours?.trim() || "Consulta horarios en contacto",
      null,
    ],
    [
      <Phone key="phone" size={18} />,
      "WhatsApp",
      brand.whatsapp?.trim() || "Próximamente",
      wa,
    ],
    [
      <MapPin key="map-pin" size={18} />,
      "Dirección",
      brand.address?.trim() || "Dirección por confirmar",
      null,
    ],
  ];

  return (
    <section id="reservaciones" className={`${SECTION_Y} bg-secondary`}>
      <div className={`${SHELL_FORM} grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-start`}>
        <div className="lg:sticky lg:top-[calc(5rem+env(safe-area-inset-top))] min-w-0">
          <p className={`${LABEL_EYEBROW} text-accent mb-4`}>Reservaciones</p>
          <h2 className="font-playfair-display text-3xl md:text-4xl lg:text-5xl font-semibold text-foreground leading-tight">Reserva tu mesa</h2>
          <p className="mt-4 text-muted-foreground font-nunito-sans leading-relaxed max-w-md">
            Envía tu solicitud y te confirmamos disponibilidad. Grupos de 8 o
            más: usa el mismo formulario o escríbenos directo por WhatsApp — el
            canal es el mismo.
          </p>
          <p className="mt-3 text-muted-foreground font-nunito-sans text-sm leading-relaxed max-w-md">
            Respondemos por WhatsApp durante el servicio, en cuanto podamos. No
            prometemos un tiempo fijo.
          </p>
          <div className="mt-8 space-y-4 hidden lg:block">
            {contactRows.map(([icon, label, value, link]) => (
              <div key={label} className="flex items-start gap-4">
                <div className="w-10 h-10 bg-primary rounded-sm flex items-center justify-center text-primary-foreground shrink-0 mt-0.5">{icon}</div>
                <div className="min-w-0">
                  <div className={`${LABEL_META} text-muted-foreground`}>{label}</div>
                  {link ? (
                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-nunito-sans text-sm font-semibold mt-0.5 break-words text-accent hover:underline"
                    >
                      {value}
                    </a>
                  ) : (
                    <div className="font-nunito-sans text-sm font-semibold mt-0.5 break-words">{value}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-card border border-border rounded-sm p-6 sm:p-8 min-w-0">
          {sent ? (
            <div className="text-center py-10" role="status" aria-live="polite">
              <CheckCircle
                size={52}
                className="text-accent mx-auto mb-4"
                aria-hidden
              />
              <h3 className="font-playfair-display text-2xl font-bold mb-2">
                Solicitud lista en WhatsApp
              </h3>
              <p className="font-nunito-sans text-sm text-muted-foreground max-w-sm mx-auto">
                Completa el envío en WhatsApp. La mesa queda reservada solo
                cuando el restaurante te confirme. Respondemos durante el
                servicio, en cuanto podamos.
              </p>
              {wa ? (
                <a
                  href={`${wa}?text=${encodeURIComponent(buildRequestMessage())}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-6 inline-flex items-center justify-center gap-2 font-nunito-sans text-xs tracking-widest uppercase text-accent border border-accent px-5 py-3 rounded-sm hover:bg-accent hover:text-white transition-colors motion-reduce:transition-none min-h-11"
                >
                  Abrir WhatsApp de nuevo
                </a>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setSent(false);
                  setFormError(null);
                }}
                className="mt-6 block mx-auto font-nunito-sans text-xs text-accent underline min-h-11"
              >
                Enviar otra solicitud
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="lg:hidden space-y-3 pb-5 mb-1 border-b border-border">
                <p className={`${LABEL_META} text-muted-foreground`}>
                  Contacto rápido
                </p>
                {brand.businessHours?.trim() ? (
                  <p className="font-nunito-sans text-sm flex items-start gap-2 min-w-0">
                    <Clock size={16} className="shrink-0 mt-0.5 text-accent" aria-hidden />
                    <span className="break-words">{brand.businessHours.trim()}</span>
                  </p>
                ) : null}
                {wa ? (
                  <a
                    href={wa}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-nunito-sans text-sm flex items-center gap-2 text-accent font-semibold min-h-11"
                  >
                    <MessageCircle size={16} className="shrink-0" aria-hidden />
                    WhatsApp {brand.whatsapp?.trim()}
                  </a>
                ) : phoneHref ? (
                  <a
                    href={phoneHref}
                    className="font-nunito-sans text-sm flex items-center gap-2 text-accent font-semibold min-h-11"
                  >
                    <Phone size={16} className="shrink-0" aria-hidden />
                    {brand.whatsapp?.trim()}
                  </a>
                ) : null}
                {brand.address?.trim() ? (
                  <p className="font-nunito-sans text-sm flex items-start gap-2 min-w-0">
                    <MapPin size={16} className="shrink-0 mt-0.5 text-accent" aria-hidden />
                    <span className="break-words">{brand.address.trim()}</span>
                  </p>
                ) : null}
              </div>
              {formError ? (
                <p
                  role="alert"
                  className="font-nunito-sans text-sm text-accent border border-accent/30 bg-accent/5 rounded-sm px-4 py-3"
                >
                  {formError}
                </p>
              ) : null}
              <div>
                <label htmlFor="reserva-nombre" className={labelCls}>
                  Nombre completo
                </label>
                <input
                  id="reserva-nombre"
                  name="nombre"
                  value={form.nombre}
                  onChange={handleChange}
                  required
                  aria-required="true"
                  placeholder="María González"
                  autoComplete="name"
                  className={inputCls}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="reserva-personas" className={labelCls}>
                    Personas
                  </label>
                  <select
                    id="reserva-personas"
                    name="personas"
                    value={form.personas}
                    onChange={handleChange}
                    className={inputCls}
                    aria-describedby="reserva-personas-hint"
                  >
                    {["1", "2", "3", "4", "5", "6", "7", "8+"].map((n) => (
                      <option key={n}>{n}</option>
                    ))}
                  </select>
                  <p
                    id="reserva-personas-hint"
                    className="mt-1.5 font-nunito-sans text-xs text-muted-foreground leading-snug"
                  >
                    Con 8 o más, la solicitud también sale por WhatsApp; no hay
                    un flujo aparte.
                  </p>
                </div>
                <div>
                  <label htmlFor="reserva-hora" className={labelCls}>
                    Hora
                  </label>
                  <select
                    id="reserva-hora"
                    name="hora"
                    value={form.hora}
                    onChange={handleChange}
                    className={inputCls}
                    aria-describedby="reserva-hora-hint"
                    disabled={Boolean(form.fecha) && horasDisponibles.length === 0}
                  >
                    {(form.fecha ? horasDisponibles : [...RESERVA_HORAS]).map(
                      (h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ),
                    )}
                  </select>
                  <p
                    id="reserva-hora-hint"
                    className="mt-1.5 font-nunito-sans text-xs text-muted-foreground leading-snug"
                  >
                    {form.fecha && horasDisponibles.length === 0
                      ? "Sin horarios restantes hoy — elige otra fecha."
                      : "Si reservas para hoy, solo aparecen horas que aún no pasan."}
                  </p>
                </div>
              </div>
              <div>
                <label htmlFor="reserva-fecha" className={labelCls}>
                  Fecha
                </label>
                <input
                  id="reserva-fecha"
                  name="fecha"
                  type="date"
                  value={form.fecha}
                  onChange={handleChange}
                  required
                  aria-required="true"
                  className={inputCls}
                  min={todayIsoDate()}
                />
              </div>
              <div>
                <label htmlFor="reserva-telefono" className={labelCls}>
                  Teléfono
                </label>
                <input
                  id="reserva-telefono"
                  name="telefono"
                  type="tel"
                  value={form.telefono}
                  onChange={handleChange}
                  required
                  aria-required="true"
                  placeholder="+52 55 0000 0000"
                  autoComplete="tel"
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="reserva-notas" className={labelCls}>
                  Notas especiales (opcional)
                </label>
                <textarea
                  id="reserva-notas"
                  name="notas"
                  value={form.notas}
                  onChange={handleChange}
                  placeholder="Alergias, ocasión especial, silla para bebé..."
                  rows={3}
                  className={`${inputCls} resize-none`}
                />
              </div>
              <button
                type="submit"
                disabled={
                  submitting ||
                  (Boolean(form.fecha) && horasDisponibles.length === 0)
                }
                aria-busy={submitting}
                className={`w-full py-4 ${BTN_ACCENT} disabled:opacity-60 disabled:pointer-events-none`}
              >
                {submitting
                  ? "Abriendo WhatsApp…"
                  : wa
                    ? "Enviar solicitud por WhatsApp"
                    : "Enviar solicitud"}
              </button>
              <p className="font-nunito-sans text-xs text-muted-foreground text-center leading-relaxed">
                La mesa se confirma solo cuando el restaurante responde.
                Contestamos durante el servicio, sin un plazo fijo.
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

// ─── Nosotros ────────────────────────────────────────────────────────────────

function Nosotros() {
  return (
    <section id="nosotros" className={`${SECTION_Y_DENSE} bg-background`}>
      <div className={SHELL}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          <div className="min-w-0">
            <p className={`${LABEL_EYEBROW} text-accent mb-3`}>
              La casa
            </p>
            <h2 className="font-playfair-display text-3xl md:text-4xl font-semibold text-foreground leading-tight mb-4">
              Familia Conti
              <span className="italic font-medium text-muted-foreground">
                {" "}
                en CDMX desde 1987
              </span>
            </h2>
            <div className="space-y-3 text-muted-foreground font-nunito-sans leading-relaxed text-sm max-w-prose">
              <p>
                Llegaron de Nápoles con recetas y doce mesas. El Chef Marco Conti,
                segunda generación, sigue la misma regla: tiempo y producto, sin
                trucos.
              </p>
              <p>
                Mozzarella di bufala de Campania, aceite de la familia en Apulia y
                café de Sicilia — lo que importa, de origen.
              </p>
            </div>
            <p className="mt-5 font-nunito-sans text-sm text-muted-foreground">
              <span className="font-playfair-display text-2xl font-semibold text-foreground tabular-nums">
                37
              </span>{" "}
              años en la mesa
            </p>
          </div>
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=640&h=480&fit=crop&auto=format"
              alt="Chef Marco Conti en la cocina"
              className="w-full aspect-[4/3] object-cover rounded-sm"
              loading="lazy"
              decoding="async"
              sizes="(max-width: 1024px) 100vw, 40vw"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Galería ─────────────────────────────────────────────────────────────────

function Galeria() {
  const [selected, setSelected] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const lastTriggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (selected === null) {
      lastTriggerRef.current?.focus();
      lastTriggerRef.current = null;
      return;
    }

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeBtnRef.current?.focus();

    const getFocusable = () =>
      dialogRef.current
        ? Array.from(
            dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
          )
        : [];

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setSelected(null);
        return;
      }
      if (e.key !== "Tab") return;
      const items = getFocusable();
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [selected]);

  return (
    <section id="galeria" className={`${SECTION_Y_DENSE} bg-secondary`}>
      <div className={SHELL}>
        <SectionHeader eyebrow="Galería" title="Imágenes de la casa" compact />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 auto-rows-fr">
          {GALLERY_IMAGES.map((img, i) => {
            const featured = i === 0 || i === 5;
            return (
              <button
                key={i}
                type="button"
                onClick={(e) => {
                  lastTriggerRef.current = e.currentTarget;
                  setSelected(i);
                }}
                className={`relative overflow-hidden rounded-sm bg-muted group cursor-zoom-in min-h-11 ${
                  featured
                    ? "col-span-2 aspect-[16/10] md:col-span-2 md:row-span-2 md:aspect-[4/5] md:min-h-[280px]"
                    : "aspect-[4/3]"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.src}
                  alt={img.alt}
                  className="absolute inset-0 w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                  sizes="(max-width: 768px) 50vw, 25vw"
                />
                <div className="absolute inset-0 bg-primary/10 md:bg-primary/0 md:group-hover:bg-primary/15 transition-colors motion-reduce:transition-none flex items-center justify-center">
                  <Search
                    size={22}
                    className="text-white opacity-70 md:opacity-0 md:group-hover:opacity-90 transition-opacity motion-reduce:transition-none"
                    aria-hidden
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>
      {selected !== null ? (
        <div
          ref={dialogRef}
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 sm:p-6 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]"
          onClick={() => setSelected(null)}
          role="dialog"
          aria-modal="true"
          aria-label={GALLERY_IMAGES[selected].alt}
        >
          <button
            ref={closeBtnRef}
            type="button"
            className="absolute top-[max(1rem,env(safe-area-inset-top))] right-[max(1rem,env(safe-area-inset-right))] text-white hover:text-[var(--brand-gold)] transition-colors min-h-11 min-w-11 inline-flex items-center justify-center"
            aria-label="Cerrar"
            onClick={() => setSelected(null)}
          >
            <X size={28} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={GALLERY_IMAGES[selected].src.replace("w=600&h=450", "w=1200&h=900")}
            alt={GALLERY_IMAGES[selected].alt}
            className="max-w-full max-h-[min(85dvh,900px)] object-contain rounded-sm"
            decoding="async"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}
    </section>
  );
}

// ─── Opiniones ────────────────────────────────────────────────────────────────

function Opiniones() {
  const avg = (
    REVIEWS.reduce((a, r) => a + r.rating, 0) / REVIEWS.length
  ).toFixed(1);
  return (
    <section id="opiniones" className={`${SECTION_Y_DENSE} bg-background`}>
      <div className={SHELL}>
        <SectionHeader
          eyebrow="Opiniones"
          title="Lo que dicen de nosotros"
          subtitle="Reseñas de ejemplo — no son reseñas públicas verificadas."
          compact
        />
        <div className="flex flex-col items-center mb-8">
          <div className="font-playfair-display text-4xl md:text-5xl font-semibold text-accent leading-none">
            {avg}
          </div>
          <div className="flex gap-1 my-2" aria-label={`${avg} de 5 estrellas en ejemplos`}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Star
                key={i}
                size={16}
                className="fill-[color-mix(in_srgb,var(--brand-gold)_90%,transparent)] text-[color-mix(in_srgb,var(--brand-gold)_90%,transparent)]"
                aria-hidden
              />
            ))}
          </div>
          <p className={`${LABEL_META} text-muted-foreground`}>
            Promedio de {REVIEWS.length} ejemplos
          </p>
        </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
          {REVIEWS.map((r, i) => (
            <div
              key={i}
              className="border-b border-border pb-5 md:border md:border-border md:rounded-sm md:p-5 min-w-0"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center font-playfair-display font-bold text-sm text-[var(--brand-gold)] shrink-0">
                  {r.avatar}
                </div>
                <div className="min-w-0">
                  <div className="font-nunito-sans text-sm font-semibold truncate">
                    {r.name}
                  </div>
                  <div className="font-nunito-sans text-xs text-muted-foreground">
                    {r.date}
                  </div>
                </div>
              </div>
              <StarRow rating={r.rating} />
              <p className="font-nunito-sans text-sm text-muted-foreground leading-relaxed mt-2 italic">
                &ldquo;{r.text}&rdquo;
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Ubicación ────────────────────────────────────────────────────────────────

function Ubicacion() {
  const brand = useBrand();
  const embed = mapsEmbedSrc(brand.googleMapsUrl);
  const mapsHref = mapsExternalHref(brand.googleMapsUrl);
  const address = brand.address?.trim() || "Dirección por confirmar";
  const hours = brand.businessHours?.trim() || "Horario por confirmar";
  const wa = whatsappChatUrl(brand.whatsapp);
  const phone = telHref(brand.whatsapp);

  return (
    <section id="ubicacion" className={`${SECTION_Y} bg-secondary`}>
      <div className={SHELL}>
        <SectionHeader
          eyebrow="Visítanos"
          title="Ubicación y contacto"
          subtitle="Dirección, horarios y el canal directo con la casa."
        />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-10 items-stretch">
          <div className="space-y-6 order-2 lg:order-1">
            <div>
              <p className={`${LABEL_META} text-accent mb-2 font-semibold`}>
                Dirección
              </p>
              <div className="flex items-start gap-3">
                <MapPin size={16} className="text-accent mt-0.5 shrink-0" />
                <p className="font-nunito-sans text-sm leading-relaxed whitespace-pre-line">
                  {address}
                </p>
              </div>
            </div>
            <div>
              <p className={`${LABEL_META} text-accent mb-2 font-semibold`}>
                Horarios
              </p>
              <div className="flex items-start gap-3">
                <Clock size={16} className="text-accent mt-0.5 shrink-0" />
                <p className="font-nunito-sans text-sm font-semibold leading-relaxed whitespace-pre-line">
                  {hours}
                </p>
              </div>
            </div>
            {mapsHref ? (
              <a
                href={mapsHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 font-nunito-sans text-xs tracking-widest uppercase text-accent border border-accent px-5 py-3 rounded-sm hover:bg-accent hover:text-white transition-colors motion-reduce:transition-none min-h-11"
              >
                Abrir en Google Maps <ExternalLink size={13} />
              </a>
            ) : null}
            <div
              id="contacto"
              className="pt-5 border-t border-border space-y-3"
            >
              <p className={`${LABEL_META} text-accent font-semibold`}>
                Contacto
              </p>
              {wa || phone ? (
                <div className="flex flex-col gap-2">
                  {wa ? (
                    <a
                      href={wa}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 font-nunito-sans text-sm text-foreground hover:text-accent transition-colors motion-reduce:transition-none min-h-11"
                    >
                      <MessageCircle size={16} className="text-accent shrink-0" />
                      WhatsApp {brand.whatsapp?.trim()}
                    </a>
                  ) : null}
                  {phone ? (
                    <a
                      href={phone}
                      className="inline-flex items-center gap-2 font-nunito-sans text-sm text-foreground hover:text-accent transition-colors motion-reduce:transition-none min-h-11"
                    >
                      <Phone size={16} className="text-accent shrink-0" />
                      Llamar
                    </a>
                  ) : null}
                </div>
              ) : (
                <p className="font-nunito-sans text-sm text-muted-foreground">
                  Pronto publicaremos WhatsApp para contactarnos.
                </p>
              )}
            </div>
          </div>
          <div className="lg:col-span-2 order-1 lg:order-2 bg-muted rounded-sm overflow-hidden min-h-72 lg:min-h-[360px] relative">
            {embed ? (
              <iframe
                src={embed}
                width="100%"
                height="100%"
                style={{ border: 0, minHeight: "288px" }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title={`Mapa ${brand.name}`}
                className="absolute inset-0 w-full h-full"
              />
            ) : (
              <div className="flex h-full min-h-72 items-center justify-center px-6 text-center">
                <p className="font-nunito-sans text-sm text-muted-foreground max-w-sm">
                  {mapsHref
                    ? "Usa el enlace de Google Maps para ver la ubicación."
                    : "La ubicación se publicará pronto. Escríbenos por WhatsApp si necesitas indicaciones."}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── FAQ ─────────────────────────────────────────────────────────────────────

function FAQ() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <section id="faq" className={`${SECTION_Y_DENSE} bg-background`}>
      <div className={SHELL}>
        <div className="mx-auto max-w-3xl">
          <SectionHeader eyebrow="Preguntas" title="Preguntas frecuentes" compact />
          <div className="space-y-1.5">
            {FAQ_ITEMS.map((faq, i) => (
              <div key={i} className="border border-border rounded-sm overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpen(open === i ? null : i)}
                  className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-secondary transition-colors motion-reduce:transition-none min-h-11"
                  aria-expanded={open === i}
                >
                  <span className="font-nunito-sans text-sm font-semibold pr-4">{faq.q}</span>
                  {open === i ? <ChevronUp size={16} className="text-accent shrink-0" /> : <ChevronDown size={16} className="text-muted-foreground shrink-0" />}
                </button>
                {open === i && (
                  <div className="px-5 pb-4 bg-card">
                    <p className="font-nunito-sans text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Shared visit actions — peak-end, sticky rail, and end reprise.
 * `compact` drops “Cómo llegar” so demoted-band chrome stays light.
 */
function VisitCtaCluster({
  tone,
  compact = false,
  className = "",
}: {
  tone: "dark" | "light";
  compact?: boolean;
  className?: string;
}) {
  const brand = useBrand();
  const onDark = tone === "dark";
  const fill = onDark
    ? `px-6 py-3 w-full sm:w-auto inline-flex items-center justify-center ${BTN_ACCENT}`
    : `px-6 py-3 w-full sm:w-auto inline-flex items-center justify-center ${BTN_PRIMARY}`;
  const outline = onDark
    ? "font-nunito-sans text-xs tracking-widest uppercase rounded-sm border border-white/30 text-white/90 hover:border-white/50 hover:bg-white/8 transition-colors motion-reduce:transition-none min-h-11 px-6 py-3 w-full sm:w-auto inline-flex items-center justify-center"
    : "font-nunito-sans text-xs tracking-widest uppercase rounded-sm border border-border text-foreground hover:bg-muted/60 transition-colors motion-reduce:transition-none min-h-11 px-6 py-3 w-full sm:w-auto inline-flex items-center justify-center";
  const secondary = brand.hasReservations ? outline : fill;

  return (
    <div
      className={`flex flex-col sm:flex-row flex-wrap gap-2.5 sm:gap-3 justify-center items-stretch sm:items-center ${className}`}
    >
      {brand.hasReservations ? (
        <button
          type="button"
          onClick={() => scrollToId("reservaciones")}
          className={fill}
        >
          Reservar mesa
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => scrollToId("carta")}
        className={brand.hasReservations ? secondary : fill}
      >
        Ver carta
      </button>
      {!compact ? (
        <button
          type="button"
          onClick={() => scrollToId("ubicacion")}
          className={outline}
        >
          Cómo llegar
        </button>
      ) : null}
    </div>
  );
}

/** Sticky under nav while browsing the demoted secondary stack. */
function MasDelLocalCtaRail() {
  return (
    <div
      className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] sm:top-[calc(4rem+env(safe-area-inset-top))] z-40 border-b border-border bg-background"
      role="region"
      aria-label="Acciones de visita"
    >
      <div
        className={`${SHELL} flex flex-col gap-2.5 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:py-3`}
      >
        <p className="font-nunito-sans text-xs tracking-[0.12em] uppercase text-muted-foreground text-center sm:text-left">
          ¿Listo para la mesa?
        </p>
        <VisitCtaCluster tone="light" compact className="sm:justify-end" />
      </div>
    </div>
  );
}

/** Quiet end door after the exploratory tail. */
function MasDelLocalCtaReprise() {
  return (
    <section
      className="bg-[var(--brand-band)] border-t border-white/5 py-10 md:py-12"
      aria-labelledby="mas-del-local-reprise-title"
    >
      <div className={`${SHELL_NARROW} text-center`}>
        <h2
          id="mas-del-local-reprise-title"
          className="font-playfair-display text-2xl md:text-3xl font-semibold text-white/95"
        >
          Volvemos a la mesa
        </h2>
        <p className="mt-2 font-nunito-sans text-sm text-white/55 max-w-sm mx-auto leading-relaxed">
          Reserva, pide o ubica el local — sin volver a subir toda la página.
        </p>
        <VisitCtaCluster tone="dark" className="mt-6 max-w-md sm:max-w-none mx-auto" />
      </div>
    </section>
  );
}

/** Secondary band: Pro modules demoted out of the primary visit path. */
function MasDelLocal() {
  return (
    <div id="mas-del-local">
      <div className="bg-[var(--brand-band)] text-center px-5 sm:px-6 py-9 md:py-10 border-y border-white/5">
        <p className={`${LABEL_EYEBROW} text-[color-mix(in_srgb,var(--brand-gold)_85%,transparent)] mb-2`}>
          Más del local
        </p>
        <h2 className="font-playfair-display text-2xl md:text-3xl font-semibold text-white/95">
          Ambiente, ofertas y agenda
        </h2>
        <p className="mt-2 font-nunito-sans text-sm text-white/55 max-w-md mx-auto leading-relaxed">
          Galería, más promociones, opiniones, lealtad, eventos y avisos — cuando
          quieras explorar.
        </p>
      </div>
      <MasDelLocalCtaRail />
      <div data-secondary-block>
        <Promociones />
      </div>
      <div data-secondary-block>
        <Galeria />
      </div>
      <div data-secondary-block>
        <Opiniones />
      </div>
      <div data-secondary-block>
        <ExtrasSection />
      </div>
      <MasDelLocalCtaReprise />
    </div>
  );
}

// ─── Cierre (peak-end: appetite + action) ─────────────────────────────────────

function CierreVisita() {
  return (
    <section
      id="visita"
      className={`${SECTION_Y} bg-primary`}
      aria-labelledby="cierre-visita-title"
    >
      <div className={`${SHELL_NARROW} text-center`}>
        <p className={`${LABEL_EYEBROW} text-[color-mix(in_srgb,var(--brand-gold)_90%,transparent)] mb-4`}>
          Te esperamos
        </p>
        <h2
          id="cierre-visita-title"
          className="font-playfair-display text-3xl md:text-4xl lg:text-5xl font-semibold text-white leading-tight"
        >
          La mesa Conti, cuando tú quieras
        </h2>
        <p className="mt-4 font-nunito-sans text-sm md:text-base text-white/70 max-w-md mx-auto leading-relaxed">
          Carta, pedido o reservación — elige cómo quieres la noche. Te
          confirmamos por el mismo canal.
        </p>
        <VisitCtaCluster
          tone="dark"
          className="mt-8 max-w-md sm:max-w-none mx-auto"
        />
      </div>
    </section>
  );
}

// ─── Extras: Lealtad, Eventos, Blog, Newsletter ───────────────────────────────

function ExtrasSection() {
  const brand = useBrand();
  const wa = whatsappChatUrl(brand.whatsapp);
  const [email, setEmail] = useState("");
  const [subbed, setSubbed] = useState(false);

  const events = [
    { icon: <Music size={20} />, title: "Música en vivo", desc: "Viernes y sábado", sub: "Jazz y cantautores italianos desde las 20:00 hrs." },
    { icon: <Coffee size={20} />, title: "Catas de vino", desc: "Primer martes del mes", sub: "Degustación de vinos DOC con maridaje de quesos." },
    { icon: <Cake size={20} />, title: "Cumpleaños", desc: "Todo el año", sub: "Postre de cortesía y canción especial para el festejado." },
    { icon: <Users size={20} />, title: "Karaoke italiano", desc: "Jueves", sub: "¡Canta como Pavarotti! A partir de las 21:00 hrs." },
  ];

  const posts = [
    { title: "¿Cómo hacemos nuestra pizza de masa madre?", cat: "Cocina", img: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&h=250&fit=crop&auto=format" },
    { title: "La historia del Tiramisù: el postre que conquistó el mundo", cat: "Historia", img: "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=400&h=250&fit=crop&auto=format" },
    { title: "Beneficios del café espresso artesanal de Sicilia", cat: "Café", img: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=250&fit=crop&auto=format" },
  ];

  return (
    <>
      {/* Lealtad */}
      <section id="lealtad" className={`${SECTION_Y_DENSE} bg-secondary`}>
        <div className={`${SHELL_NARROW} text-center`}>
          <SectionHeader
            eyebrow="Programa de la casa"
            title="Programa de lealtad"
            subtitle="Acumula puntos en cada visita y canjéalos por descuentos o platillos. Pregunta en mesa o por WhatsApp cómo inscribirte."
            compact
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 text-center">
            {[
              {
                icon: <Gift size={24} />,
                title: "Acumula puntos",
                desc: "1 punto por cada $10 de consumo. Doble en tu cumpleaños.",
              },
              {
                icon: <Award size={24} />,
                title: "Canjea descuentos",
                desc: "500 pts = $100 de descuento en tu próxima visita.",
              },
              {
                icon: <Star size={24} />,
                title: "Beneficios VIP",
                desc: "Acceso anticipado a eventos y cartas especiales.",
              },
            ].map((item) => (
              <div key={item.title} className="px-2">
                <div className="w-12 h-12 bg-primary rounded-sm flex items-center justify-center text-[var(--brand-gold)] mx-auto mb-3">
                  {item.icon}
                </div>
                <h4 className="font-playfair-display text-lg font-bold mb-1.5">
                  {item.title}
                </h4>
                <p className="font-nunito-sans text-xs text-muted-foreground leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
          {wa ? (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className={`mt-8 inline-flex items-center gap-2 px-8 py-3.5 ${BTN_ACCENT}`}
            >
              <MessageCircle size={15} aria-hidden /> Preguntar por WhatsApp
            </a>
          ) : (
            <a
              href="#contacto"
              className={`mt-8 inline-flex items-center gap-2 px-8 py-3.5 ${BTN_ACCENT}`}
            >
              Ver contacto
            </a>
          )}
        </div>
      </section>

      {/* Eventos */}
      <section id="eventos" className={`${SECTION_Y_DENSE} bg-background`}>
        <div className={SHELL_NARROW}>
          <SectionHeader
            eyebrow="Agenda"
            title="Eventos especiales"
            subtitle="Música, catas y noches de la casa. Confirma horarios al reservar o por WhatsApp."
            compact
          />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5">
            {events.map((ev) => (
              <div key={ev.title} className="text-center px-1 py-2">
                <div className="w-11 h-11 bg-secondary rounded-sm flex items-center justify-center mx-auto mb-3 text-accent">
                  {ev.icon}
                </div>
                <h4 className="font-playfair-display font-bold text-sm md:text-base mb-1">
                  {ev.title}
                </h4>
                <p className={`${LABEL_META} text-accent mb-1.5`}>
                  {ev.desc}
                </p>
                <p className="font-nunito-sans text-xs text-muted-foreground leading-relaxed">
                  {ev.sub}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Blog */}
      <section id="blog" className={`${SECTION_Y_DENSE} bg-secondary`}>
        <div className={SHELL_FORM}>
          <SectionHeader
            eyebrow="Desde la cocina"
            title="Historias de la casa"
            subtitle="Notas y recetas — publicaremos pronto."
            compact
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6">
            {posts.map((post, i) => (
              <article key={i} className="min-w-0">
                <div className="aspect-[16/10] bg-muted overflow-hidden rounded-sm mb-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={post.img}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                </div>
                <span className={`${LABEL_META} text-accent`}>
                  {post.cat}
                </span>
                <h4 className="font-playfair-display text-base font-semibold mt-1.5 leading-snug">
                  {post.title}
                </h4>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter */}
      <section className={`${SECTION_Y_DENSE} bg-primary`}>
        <div className={SHELL}>
          <div className="mx-auto max-w-xl text-center">
          <BookOpen size={28} className="text-[color-mix(in_srgb,var(--brand-gold)_80%,transparent)] mx-auto mb-3" />
          <h2 className="font-playfair-display text-2xl md:text-3xl font-semibold text-white mb-2">
            Avisos de la casa
          </h2>
          <p className="font-nunito-sans text-sm text-white/65 mb-5">
            Déjanos tu correo para avisarte de eventos y novedades de la casa.
          </p>
          {subbed ? (
            <div
              className="flex flex-col items-center gap-2 text-white font-nunito-sans"
              role="status"
              aria-live="polite"
            >
              <span className="inline-flex items-center gap-2">
                <CheckCircle size={20} aria-hidden /> Registro recibido
              </span>
              <span className="text-sm text-white/80">
                Te escribiremos cuando el boletín esté activo. No hay envío
                automático todavía.
              </span>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setSubbed(true);
              }}
              className="flex flex-col sm:flex-row gap-2"
            >
              <label htmlFor="trattoria-newsletter" className="sr-only">
                Correo electrónico
              </label>
              <input
                id="trattoria-newsletter"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                type="email"
                placeholder="tu@email.com"
                className="flex-1 min-h-11 bg-white/8 text-white placeholder-white/45 border border-white/15 rounded-sm px-4 py-3 font-nunito-sans text-base sm:text-sm"
              />
              <button
                type="submit"
                className={`px-6 py-3 shrink-0 inline-flex items-center justify-center gap-2 ${BTN_ACCENT}`}
              >
                <Send size={14} aria-hidden />
                Registrarme
              </button>
            </form>
          )}
          </div>
        </div>
      </section>
    </>
  );
}

// ─── Footer ──────────────────────────────────────────────────────────────────

function Footer() {
  const brand = useBrand();
  const wa = whatsappChatUrl(brand.whatsapp);
  return (
    <footer className="bg-[var(--brand-ink)] text-white/60 py-12 md:py-14 pb-[max(3rem,env(safe-area-inset-bottom))]">
      <div className={`${SHELL} grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-10 mb-8`}>
        <div className="md:col-span-2">
          <div className="font-pinyon-script text-3xl text-[var(--brand-gold)] mb-1">
            {brand.name}
          </div>
          <p className={`${LABEL_META} opacity-50 mb-4`}>
            {brand.tagline ?? "Restaurante"}
          </p>
          <p className="font-nunito-sans text-xs leading-relaxed max-w-xs">
            El sitio oficial de {brand.name}. Carta, reservaciones y experiencia
            gastronómica.
          </p>
        </div>
        <div>
          <p className={`${LABEL_META} text-[var(--brand-gold)] mb-4 font-semibold`}>
            Navegación
          </p>
          {(
            [
              ["Carta", "carta"],
              ...(brand.orderingEnabled !== false
                ? ([["Cómo pedir", "como-pedir"]] as const)
                : []),
              ["Ubicación", "ubicacion"],
              ["Más del local", "mas-del-local"],
            ] as const
          ).map(([label, id]) => (
            <button
              key={id}
              type="button"
              onClick={() => scrollToId(id)}
              className="flex items-center font-nunito-sans text-xs min-h-11 py-1 hover:text-[var(--brand-gold)] transition-colors motion-reduce:transition-none"
            >
              {label}
            </button>
          ))}
        </div>
        <div>
          <p className={`${LABEL_META} text-[var(--brand-gold)] mb-4 font-semibold`}>
            Contacto
          </p>
          <div className="space-y-2 font-nunito-sans text-xs">
            {brand.address ? (
              <p className="flex items-center gap-2">
                <MapPin size={12} className="shrink-0" /> {brand.address}
              </p>
            ) : null}
            {brand.whatsapp ? (
              <p className="flex items-center gap-2">
                <Phone size={12} /> {brand.whatsapp}
              </p>
            ) : null}
            {brand.businessHours ? (
              <p className="flex items-center gap-2">
                <Clock size={12} /> {brand.businessHours}
              </p>
            ) : null}
          </div>
          {wa ? (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-2 font-nunito-sans text-xs text-white/70 hover:text-[var(--brand-gold)] transition-colors"
            >
              <MessageCircle size={16} aria-hidden /> WhatsApp
            </a>
          ) : null}
        </div>
      </div>
      <div className={`${SHELL} pt-6 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-3`}>
        <p className="font-nunito-sans text-xs inline-flex flex-wrap items-center gap-2">
          © {new Date().getFullYear()} {brand.name}. Todos los derechos
          reservados.
          <QaEnvBadge />
        </p>
        <p className="font-nunito-sans text-xs flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
          <Link href="/aviso-de-privacidad" className="hover:text-[var(--brand-gold)]">
            Aviso de privacidad
          </Link>
          <span aria-hidden>·</span>
          <Link href="/terminos" className="hover:text-[var(--brand-gold)]">
            Términos y condiciones
          </Link>
        </p>
      </div>
    </footer>
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────

function buildRestaurantTheme(brand: RestaurantBrand): CSSProperties {
  const primary = brand.primaryColor || "#1a3d2b";
  const accent = brand.secondaryColor || "#c9612a";
  return {
    "--background": "#f7f3eb",
    "--foreground": "#1c1208",
    "--card": "#fdfaf4",
    "--card-foreground": "#1c1208",
    "--popover": "#fdfaf4",
    "--popover-foreground": "#1c1208",
    "--primary": primary,
    "--primary-foreground": "#f7f3eb",
    "--secondary": "#ede3ce",
    "--secondary-foreground": primary,
    "--muted": "#e6ddc8",
    "--muted-foreground": "#7a6a52",
    "--accent": accent,
    "--accent-foreground": "#fdfaf4",
    "--brand-gold": "#d4a853",
    "--brand-ink": "#0e1f16",
    "--brand-band": "#162a20",
    "--destructive": "#c0392b",
    "--destructive-foreground": "#ffffff",
    "--border": "rgba(26, 61, 43, 0.18)",
    "--input": "transparent",
    "--input-background": "#ede3ce",
    "--ring": accent,
  } as CSSProperties;
}

type RestaurantLandingProps = {
  /** Identidad del restaurante. Si no se pasa, usa la demo "La Trattoria". */
  brand?: RestaurantBrand;
  /** Catálogo público del tenant (productos disponibles). */
  products?: Product[];
};

/**
 * Landing institucional dedicada (demo La Trattoria).
 * Registrada en `lib/tenant-landings.ts` para el/los slug(s) de ese cliente.
 * Nuevos clientes Pro = nuevo componente + entrada en el registro (fee de setup).
 */
export function RestaurantLanding({
  brand = DEFAULT_RESTAURANT_BRAND,
  products = [],
}: RestaurantLandingProps) {
  const theme = useMemo(() => buildRestaurantTheme(brand), [brand]);

  return (
    <BrandContext.Provider value={brand}>
      <CatalogContext.Provider value={products}>
        <div
          style={theme}
          className="restaurant-landing font-nunito-sans bg-background text-foreground overflow-x-hidden"
        >
          <a href="#contenido-principal" className="restaurant-skip-link">
            Saltar al contenido
          </a>
          <Navbar />
          <main id="contenido-principal" tabIndex={-1}>
            <Hero />
            <DigitalMenu />
            <Destacados />
            <Nosotros />
            <FeaturedPromo />
            <ComoPedir />
            {brand.hasReservations ? <Reservaciones /> : null}
            <FAQ />
            <Ubicacion />
            <CierreVisita />
            <MasDelLocal />
          </main>
          <Footer />
        </div>
      </CatalogContext.Provider>
    </BrandContext.Provider>
  );
}
