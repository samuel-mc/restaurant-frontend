"use client";

/**
 * Landing B2B SaaS — diseño de B2B_Landing, integrado en Next.js.
 */

import {
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { RegisterForm } from "@/components/marketing/RegisterForm";


// ─── Types ───────────────────────────────────────────────────────────────────
interface OrderItem {
  id: number
  table: string
  item: string
  status: 'new' | 'preparing' | 'ready'
  time: string
}

// ─── Data ────────────────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: '📱',
    title: 'Menú QR Interactivo',
    desc: 'Carga ultrarrápida con imágenes en Cloudflare R2. Sin apps, sin fricción para tus comensales.',
    accent: '#10B981',
    tag: 'Zero friction',
  },
  {
    icon: '📡',
    title: 'Monitor de Cocina en Tiempo Real',
    desc: 'Comandas vía WebSockets, badges de estado y alertas de sonido. Tu cocina siempre sincronizada.',
    accent: '#F59E0B',
    tag: 'Live WebSocket',
  },
  {
    icon: '🛒',
    title: 'Canal Propio Sin Comisiones',
    desc: 'Pedidos directos para Pickup y por WhatsApp. Deja de pagar 30% a plataformas.',
    accent: '#10B981',
    tag: '0% comisión',
  },
  {
    icon: '📦',
    title: 'Control Total de Stock',
    desc: 'Activa o desactiva platillos y categorías al instante. Nunca más "ya no hay" de sorpresa.',
    accent: '#F59E0B',
    tag: 'Tiempo real',
  },
  {
    icon: '📊',
    title: 'Analíticas Financieras',
    desc: 'Métricas de ventas, ticket promedio y top 5 platillos más vendidos en un solo dashboard.',
    accent: '#10B981',
    tag: 'Insights',
  },
  {
    icon: '🎨',
    title: 'Identidad de Marca',
    desc: 'Logo, banner, colores y horarios de tu negocio. Tu restaurante, tu imagen, a tu estilo.',
    accent: '#F59E0B',
    tag: 'Personalizable',
  },
]

type PricingFeature =
  | string
  | {
      label: string;
      /** Resalta el beneficio (p. ej. Sitio Web Propio). */
      highlight?: boolean;
    };

interface PricingPlan {
  name: string;
  price: string;
  period: string;
  badge: string | null;
  color: string;
  setupFee?: string;
  features: PricingFeature[];
  cta: string;
  highlight: boolean;
}

const PRICING: PricingPlan[] = [
  {
    name: "Plan Básico",
    price: "$0",
    period: "Gratis para empezar",
    badge: null,
    color: "#94A3B8",
    features: [
      "Menú QR hasta 30 platillos",
      "Gestión de comandas básica",
      "Panel de administración",
      "Monitor de cocina en vivo",
      "Subdominio platolisto.com",
      "Soporte por email",
    ],
    cta: "Comenzar Gratis",
    highlight: false,
  },
  {
    name: "Plan Pro",
    price: "$999",
    period: "por mes / restaurante",
    badge: "Más Popular",
    color: "#34D399",
    setupFee: "+$1,000 MXN (Pago único de instalación/sitio web)",
    features: [
      {
        label: "Sitio Web / Landing Page Institucional Propia",
        highlight: true,
      },
      "Configuración inicial de marca y carga de menú",
      "Menú QR ilimitado",
      "Imágenes HD con Cloudflare R2",
      "Analytics básicos + Top 5",
      "Pedidos WhatsApp y Pickup",
      "Soporte prioritario",
    ],
    cta: "Activar Plan Pro",
    highlight: true,
  },
];

function resolveFeature(feature: PricingFeature): {
  label: string;
  highlight: boolean;
} {
  if (typeof feature === "string") {
    return { label: feature, highlight: false };
  }
  return { label: feature.label, highlight: Boolean(feature.highlight) };
}

const INITIAL_ORDERS: OrderItem[] = [
  { id: 1, table: 'Mesa 4', item: 'Tacos al Pastor x3', status: 'new', time: '14:32' },
  { id: 2, table: 'Mesa 7', item: 'Enchiladas Verdes x2', status: 'preparing', time: '14:28' },
  { id: 3, table: 'Mesa 2', item: 'Agua de Jamaica x4', status: 'ready', time: '14:25' },
  { id: 4, table: 'Mesa 9', item: 'Pozole Rojo x1', status: 'preparing', time: '14:30' },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function Navbar({ onRegister }: { onRegister: () => void }) {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])

  const links = [
    { label: 'Beneficios', href: '#beneficios' },
    { label: 'Características', href: '#caracteristicas' },
    { label: 'Precios', href: '#precios' },
    { label: 'Demo', href: '#demo' },
  ]

  return (
    <nav
      className="fixed inset-x-0 top-0 z-50 w-full max-w-full overflow-x-hidden transition-all duration-300"
      style={{
        background:
          scrolled || mobileOpen
            ? "rgba(15, 23, 42, 0.97)"
            : "transparent",
        backdropFilter: scrolled || mobileOpen ? "blur(12px)" : "none",
        borderBottom:
          scrolled || mobileOpen
            ? "1px solid rgba(51, 65, 85, 0.6)"
            : "none",
      }}
    >
      <div className="mx-auto w-full min-w-0 max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 min-w-0 items-center justify-between gap-3 lg:h-20">
          {/* Logo */}
          <a
            href="#demo"
            className="group flex min-w-0 items-center gap-2 sm:gap-2.5"
          >
            <div
              className="flex size-9 shrink-0 items-center justify-center rounded-xl text-lg transition-transform group-hover:scale-110"
              style={{
                background: "linear-gradient(135deg, #10B981, #059669)",
              }}
            >
              🍽️
            </div>
            <span
              className="truncate text-lg font-black tracking-tight sm:text-xl"
              style={{
                fontFamily:
                  "var(--font-jakarta), Plus Jakarta Sans, sans-serif",
                color: "#F8FAFC",
              }}
            >
              Plato<span style={{ color: "#10B981" }}>Listo</span>
            </span>
          </a>

          {/* Desktop nav */}
          <div className="hidden items-center gap-8 md:flex">
            {links.map((l) => (
              <a
                key={l.label}
                href={l.href}
                className="nav-link text-sm font-medium text-slate-400"
              >
                {l.label}
              </a>
            ))}
          </div>

          {/* CTA */}
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={onRegister}
              className="btn-emerald hidden cursor-pointer items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white md:flex"
            >
              <span>Registrar mi Restaurante</span>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path
                  d="M1 7h12M7 1l6 6-6 6"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            {/* Mobile hamburger */}
            <button
              type="button"
              className="p-2 text-slate-300 md:hidden"
              aria-label={mobileOpen ? "Cerrar menú" : "Abrir menú"}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              <div
                className="mb-1.5 h-0.5 w-5 bg-current transition-all"
                style={{
                  transform: mobileOpen
                    ? "rotate(45deg) translate(1.5px, 6px)"
                    : "none",
                }}
              />
              <div
                className="mb-1.5 h-0.5 w-5 bg-current transition-all"
                style={{ opacity: mobileOpen ? 0 : 1 }}
              />
              <div
                className="h-0.5 w-5 bg-current transition-all"
                style={{
                  transform: mobileOpen
                    ? "rotate(-45deg) translate(1.5px, -6px)"
                    : "none",
                }}
              />
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen ? (
          <div
            className="mt-2 border-t border-slate-700/50 pb-4 md:hidden"
            style={{ background: "rgba(15, 23, 42, 0.97)" }}
          >
            {links.map((l) => (
              <a
                key={l.label}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                className="block py-3 text-sm font-medium text-slate-200 transition-colors hover:text-emerald-400"
              >
                {l.label}
              </a>
            ))}
            <button
              type="button"
              onClick={() => {
                onRegister();
                setMobileOpen(false);
              }}
              className="btn-emerald mt-3 w-full cursor-pointer rounded-xl py-2.5 text-sm font-semibold text-white"
            >
              Registrar mi Restaurante
            </button>
          </div>
        ) : null}
      </div>
    </nav>
  );
}

function HeroMockup() {
  const [orders, setOrders] = useState<OrderItem[]>(INITIAL_ORDERS)

  useEffect(() => {
    const interval = setInterval(() => {
      setOrders((prev) => {
        const next = [...prev]
        const idx = Math.floor(Math.random() * next.length)
        const statuses: OrderItem['status'][] = ['new', 'preparing', 'ready']
        const cur = statuses.indexOf(next[idx].status)
        next[idx] = { ...next[idx], status: statuses[Math.min(cur + 1, 2)] }
        return next
      })
    }, 2200)
    return () => clearInterval(interval)
  }, [])

  const statusLabel = { new: 'Nuevo', preparing: 'Preparando', ready: 'Listo' }
  const statusClass = { new: 'badge-new', preparing: 'badge-preparing', ready: 'badge-ready' }
  const statusDot = { new: '#10B981', preparing: '#F59E0B', ready: '#60A5FA' }

  return (
    <div className="relative mx-auto flex w-full max-w-full items-end justify-center gap-4 px-1 pb-4 pt-2 lg:justify-end lg:gap-5 lg:px-0 lg:pb-2 lg:pt-8">
      {/* Phone — QR Menu (siempre visible) */}
      <div className="animate-float relative z-[2] w-[10.5rem] shrink-0 sm:w-[12rem] lg:w-[11.25rem]">
        <div
          className="overflow-hidden rounded-3xl border border-slate-700/80 shadow-2xl"
          style={{ background: "#1E293B", padding: "12px 10px" }}
        >
          <div className="mb-3 flex justify-center">
            <div className="h-1.5 w-16 rounded-full bg-slate-600" />
          </div>
          <div
            className="mb-2 rounded-xl p-3 text-center"
            style={{
              background: "linear-gradient(135deg, #064e3b, #065f46)",
            }}
          >
            <div className="mb-0.5 text-lg">🌮</div>
            <div className="text-xs font-bold text-emerald-300">
              La Taquería del Sol
            </div>
            <div className="mt-0.5 text-[10px] text-emerald-400/70">
              Menú Digital
            </div>
          </div>
          <div className="mb-2 flex gap-1.5 overflow-hidden">
            {["Tacos", "Bebidas", "Postres"].map((c, i) => (
              <span
                key={c}
                className="rounded-full px-2 py-1 text-[9px] font-semibold whitespace-nowrap"
                style={{
                  background: i === 0 ? "#10B981" : "rgba(51,65,85,0.8)",
                  color: i === 0 ? "white" : "#94A3B8",
                }}
              >
                {c}
              </span>
            ))}
          </div>
          {[
            { name: "Tacos al Pastor", price: "$45", img: "🌮" },
            { name: "Agua Jamaica", price: "$25", img: "🥤" },
            { name: "Enchiladas", price: "$65", img: "🧆" },
          ].map((item) => (
            <div
              key={item.name}
              className="mb-1.5 flex items-center gap-2 rounded-lg p-1.5"
              style={{
                background: "rgba(30,41,59,0.8)",
                border: "1px solid rgba(51,65,85,0.5)",
              }}
            >
              <span className="text-base">{item.img}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[10px] font-semibold text-slate-200">
                  {item.name}
                </div>
                <div className="text-[9px] font-bold text-emerald-400">
                  {item.price}
                </div>
              </div>
              <span
                className="flex size-5 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ background: "#10B981", fontSize: 14, lineHeight: 1 }}
              >
                +
              </span>
            </div>
          ))}
          <div
            className="mt-2 rounded-lg py-2 text-center text-[10px] font-bold text-white"
            style={{
              background: "linear-gradient(135deg, #10B981, #059669)",
            }}
          >
            🛒 Ver mi Pedido (3)
          </div>
        </div>
        <div
          className="absolute right-0 -bottom-3 rounded-xl border border-slate-600/50 p-2 text-center shadow-lg"
          style={{ background: "#1E293B" }}
        >
          <div className="mb-1 grid size-8 grid-cols-3 gap-0.5">
            {Array.from({ length: 9 }, (_, i) => (
              <div
                key={i}
                className="rounded-sm"
                style={{
                  background: [0, 1, 3, 5, 7, 8].includes(i)
                    ? "#10B981"
                    : "transparent",
                }}
              />
            ))}
          </div>
          <div className="text-[8px] font-medium text-slate-400">Escanear</div>
        </div>
      </div>

      {/* Tablet — solo en desktop (columna propia); en móvil/tablet se oculta para no cortar */}
      <div className="animate-float-delayed relative z-[1] hidden w-[15.5rem] shrink-0 lg:block">
        <div
          className="overflow-hidden rounded-2xl border border-slate-600/80 shadow-2xl"
          style={{ background: "#0F172A", padding: "10px" }}
        >
          <div className="mb-2 flex items-center justify-between px-1">
            <div>
              <div
                className="text-xs font-bold text-white"
                style={{
                  fontFamily:
                    "var(--font-jakarta), Plus Jakarta Sans, sans-serif",
                }}
              >
                Monitor de Cocina
              </div>
              <div className="mt-0.5 flex items-center gap-1.5">
                <span className="animate-blink inline-block size-1.5 rounded-full bg-emerald-400" />
                <span className="text-[9px] font-medium text-emerald-400">
                  EN VIVO • WebSocket
                </span>
              </div>
            </div>
            <div
              className="rounded-lg px-2 py-1 text-xs font-bold"
              style={{
                background: "rgba(16,185,129,0.15)",
                color: "#10B981",
              }}
            >
              {orders.length} activas
            </div>
          </div>

          <div className="space-y-1.5">
            {orders.map((order) => (
              <div
                key={order.id}
                className="rounded-xl p-2.5 transition-all duration-500"
                style={{
                  background: "rgba(30,41,59,0.9)",
                  border: `1px solid ${
                    order.status === "new"
                      ? "rgba(16,185,129,0.3)"
                      : order.status === "preparing"
                        ? "rgba(245,158,11,0.3)"
                        : "rgba(96,165,250,0.3)"
                  }`,
                }}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-white">
                    {order.table}
                  </span>
                  <span className={`order-badge ${statusClass[order.status]}`}>
                    <span
                      className="size-1.5 rounded-full"
                      style={{ background: statusDot[order.status] }}
                    />
                    {statusLabel[order.status]}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400">{order.item}</div>
                <div className="mt-0.5 text-[9px] text-slate-500">
                  {order.time} hrs
                </div>
              </div>
            ))}
          </div>

          <div
            className="mt-2 flex items-center justify-between border-t pt-2"
            style={{ borderColor: "rgba(51,65,85,0.5)" }}
          >
            <div className="text-center">
              <div className="text-xs font-bold text-emerald-400">$4,230</div>
              <div className="text-[8px] text-slate-500">Ventas hoy</div>
            </div>
            <div className="text-center">
              <div className="text-xs font-bold text-amber-400">$147</div>
              <div className="text-[8px] text-slate-500">Ticket prom.</div>
            </div>
            <div className="text-center">
              <div className="text-xs font-bold text-blue-400">28</div>
              <div className="text-[8px] text-slate-500">Pedidos</div>
            </div>
          </div>
        </div>
      </div>

      {/* Notificación — solo desktop, dentro del flujo visual sin salirse */}
      <div
        className="absolute top-0 right-2 z-[3] hidden rounded-xl px-3 py-2 shadow-lg animate-pulse-ring lg:block"
        style={{
          background: "rgba(16,185,129,0.95)",
          backdropFilter: "blur(8px)",
          minWidth: 148,
        }}
      >
        <div className="flex items-center gap-2">
          <span className="text-base">🔔</span>
          <div>
            <div className="text-[10px] font-bold text-white">
              ¡Nueva Comanda!
            </div>
            <div className="text-[9px] text-emerald-100">Mesa 12 • Birria x2</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroSection({ onRegister }: { onRegister: () => void }) {
  return (
    <section
      id="demo"
      className="relative flex items-start overflow-x-hidden lg:min-h-[100svh] lg:items-center"
      style={{ paddingTop: 80 }}
    >
      {/* Grid background */}
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "linear-gradient(rgba(16,185,129,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(16,185,129,0.15) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />
      {/* Radial glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(16,185,129,0.12) 0%, transparent 70%)",
        }}
      />
      <div
        className="pointer-events-none absolute bottom-0 left-0 hidden h-72 w-72 rounded-full sm:block md:left-1/4 md:h-96 md:w-96"
        style={{
          background:
            "radial-gradient(circle, rgba(245,158,11,0.06) 0%, transparent 70%)",
        }}
      />

      <div className="relative z-10 mx-auto w-full max-w-7xl px-5 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-8">
          {/* Text */}
          <div className="relative z-10 min-w-0 overflow-visible">
            {/* Live badge */}
            <div className="mb-5 inline-flex max-w-full items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/5 px-3 py-1.5 sm:mb-6 sm:px-4">
              <span className="animate-blink inline-block size-2 shrink-0 rounded-full bg-emerald-400" />
              <span className="text-[10px] font-semibold tracking-wide text-emerald-400 uppercase sm:text-xs">
                Plataforma activa en +200 restaurantes
              </span>
            </div>

            <h1
              className="mb-5 max-w-full overflow-visible text-[1.75rem] leading-[1.2] font-black tracking-tight text-pretty sm:mb-6 sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl"
              style={{
                fontFamily:
                  "var(--font-jakarta), Plus Jakarta Sans, sans-serif",
              }}
            >
              Tu Menú en{" "}
              <span className="gradient-text inline">la Mesa.</span>
              <br />
              Tu Cocina{" "}
              <span className="inline" style={{ color: "#F59E0B" }}>
                en Vivo.
              </span>
              <br />
              <span className="inline text-white">Cero Comisiones.</span>
            </h1>

            <p className="mb-7 max-w-lg text-base leading-relaxed text-slate-400 sm:mb-8 sm:text-lg">
              Transforma tu restaurante con menús QR ultrarrápidos, comandas en
              tiempo real vía WebSockets y tu propio canal de venta{" "}
              <span className="font-semibold text-white">sin pagar el 30%</span>{" "}
              a aplicaciones.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
              <button
                type="button"
                onClick={onRegister}
                className="btn-emerald flex cursor-pointer items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-bold text-white sm:px-7 sm:py-4 sm:text-base"
              >
                <span className="text-center">
                  🚀 Crear Mi Restaurante Gratis
                </span>
              </button>
              <a
                href="#caracteristicas"
                className="btn-outline flex cursor-pointer items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold text-emerald-400 sm:px-7 sm:py-4 sm:text-base"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <circle
                    cx="9"
                    cy="9"
                    r="8"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                  <path d="M7 6l5 3-5 3V6z" fill="currentColor" />
                </svg>
                <span>Ver Demo en Vivo</span>
              </a>
            </div>

            {/* Social proof */}
            <div
              className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4 border-t pt-6 sm:mt-10 sm:pt-8"
              style={{ borderColor: "rgba(51,65,85,0.5)" }}
            >
              {[
                { value: "200+", label: "Restaurantes" },
                { value: "0%", label: "Comisiones" },
                { value: "99.9%", label: "Uptime" },
              ].map((s) => (
                <div key={s.label} className="min-w-0">
                  <div
                    className="text-xl font-black sm:text-2xl"
                    style={{
                      fontFamily:
                        "var(--font-jakarta), Plus Jakarta Sans, sans-serif",
                      color: "#10B981",
                    }}
                  >
                    {s.value}
                  </div>
                  <div className="mt-0.5 text-xs font-medium text-slate-500">
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Mockup — teléfono en móvil; dúo completo solo en lg+ */}
          <div className="relative z-0 mt-6 w-full max-w-full sm:mt-8 lg:mt-0 lg:flex lg:justify-end">
            <HeroMockup />
          </div>
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  return (
    <section id="caracteristicas" className="py-24 relative">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 60% 40% at 80% 50%, rgba(245,158,11,0.04) 0%, transparent 60%)' }}
      />
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16" id="beneficios">
          <div className="inline-flex items-center gap-2 mb-4 px-4 py-1.5 rounded-full border border-amber-500/30 bg-amber-500/5">
            <span className="text-xs font-semibold text-amber-400 tracking-wide uppercase">
              Características
            </span>
          </div>
          <h2
            className="text-4xl lg:text-5xl font-black text-white mb-4 leading-tight"
            style={{ fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif' }}
          >
            Todo lo que tu restaurante
            <br />
            <span className="shimmer-text">necesita en un solo lugar</span>
          </h2>
          <p className="text-slate-400 text-lg max-w-xl mx-auto">
            Tecnología de punta diseñada para la operación diaria de restaurantes mexicanos.
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className="card-glow group relative rounded-2xl p-6 transition-all duration-300 cursor-default"
              style={{
                background: 'rgba(30,41,59,0.6)',
                border: '1px solid rgba(51,65,85,0.6)',
                backdropFilter: 'blur(8px)',
              }}
            >
              {/* Top accent line */}
              <div
                className="absolute top-0 left-6 right-6 h-px rounded-full transition-all duration-300 group-hover:left-4 group-hover:right-4"
                style={{ background: `linear-gradient(90deg, transparent, ${f.accent}, transparent)` }}
              />

              {/* Icon */}
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-4 transition-transform duration-300 group-hover:scale-110"
                style={{ background: `${f.accent}18`, border: `1px solid ${f.accent}30` }}
              >
                {f.icon}
              </div>

              {/* Tag */}
              <span
                className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mb-3"
                style={{ background: `${f.accent}15`, color: f.accent }}
              >
                {f.tag}
              </span>

              <h3
                className="text-base font-bold text-white mb-2"
                style={{ fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif' }}
              >
                {f.title}
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function PricingSection({
  onRegister,
}: {
  onRegister: (plan: "BASIC" | "PRO") => void;
}) {
  return (
    <section id="precios" className="py-24 relative">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 70% 50% at 30% 60%, rgba(16,185,129,0.05) 0%, transparent 60%)' }}
      />
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/45 bg-emerald-500/15 px-4 py-1.5">
            <span className="text-xs font-semibold tracking-wide text-emerald-300 uppercase">
              Precios
            </span>
          </div>
          <h2
            className="mb-4 text-4xl font-black text-white lg:text-5xl"
            style={{
              fontFamily:
                "var(--font-jakarta), Plus Jakarta Sans, sans-serif",
            }}
          >
            Dos planes claros
            <br />
            <span className="gradient-text">para tu operación</span>
          </h2>
          <p className="text-lg text-slate-300">
            Empieza gratis. Pasa a Pro cuando quieras tu sitio institucional;
            el cobro es early access (efectivo / transferencia + cupón).
          </p>
        </div>

        <div className="mx-auto grid max-w-4xl grid-cols-1 items-stretch gap-6 md:grid-cols-2">
          {PRICING.map((plan) => (
            <div
              key={plan.name}
              className="relative rounded-2xl p-8 flex flex-col transition-all duration-300"
              style={{
                background: plan.highlight
                  ? 'linear-gradient(145deg, rgba(16,185,129,0.12), rgba(5,150,105,0.08))'
                  : 'rgba(30,41,59,0.6)',
                border: plan.highlight
                  ? '1.5px solid rgba(16,185,129,0.5)'
                  : '1px solid rgba(51,65,85,0.6)',
                boxShadow: plan.highlight ? '0 0 40px rgba(16,185,129,0.12)' : 'none',
                transform: plan.highlight ? 'scale(1.02)' : 'none',
              }}
            >
              {plan.badge && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span
                    className="px-4 py-1.5 rounded-full text-xs font-bold text-white whitespace-nowrap"
                    style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}
                  >
                    ⭐ {plan.badge}
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h3
                  className="mb-4 text-lg font-bold text-white"
                  style={{
                    fontFamily:
                      "var(--font-jakarta), Plus Jakarta Sans, sans-serif",
                    color: plan.highlight
                      ? "#34D399"
                      : "#F8FAFC",
                  }}
                >
                  {plan.name}
                </h3>
                <div className="mb-1 flex items-end gap-2">
                  <span
                    className="text-5xl font-black"
                    style={{
                      fontFamily:
                        "var(--font-jakarta), Plus Jakarta Sans, sans-serif",
                      color: plan.color,
                    }}
                  >
                    {plan.price}
                  </span>
                  {plan.price !== "Custom" && (
                    <span className="mb-1.5 text-sm text-slate-400">MXN</span>
                  )}
                </div>
                <p className="text-sm text-slate-400">{plan.period}</p>
                {plan.setupFee ? (
                  <p className="mt-3 inline-flex max-w-full flex-wrap items-center gap-1.5 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1.5 text-left text-xs font-semibold leading-snug text-emerald-400">
                    <span>
                      +$1,000 MXN de creación de Sitio Web (Pago único)
                    </span>
                  </p>
                ) : null}
              </div>

              <ul className="mb-8 flex-1 space-y-3">
                {plan.features.map((feat) => {
                  const { label, highlight: isFeatured } = resolveFeature(feat);
                  return (
                    <li
                      key={label}
                      className={`flex items-start gap-2.5 ${
                        isFeatured
                          ? "rounded-lg border border-emerald-400/25 bg-emerald-500/10 px-2.5 py-2"
                          : ""
                      }`}
                    >
                      {isFeatured ? (
                        <span
                          className="mt-0.5 flex size-4 shrink-0 items-center justify-center text-emerald-400"
                          aria-hidden
                        >
                          ★
                        </span>
                      ) : (
                        <svg
                          className="mt-0.5 size-4 shrink-0"
                          viewBox="0 0 16 16"
                          fill="none"
                          style={{ color: plan.color }}
                        >
                          <circle
                            cx="8"
                            cy="8"
                            r="7"
                            fill="currentColor"
                            opacity="0.2"
                          />
                          <path
                            d="M5 8l2 2 4-4"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                      <span
                        className={`text-sm leading-snug ${
                          isFeatured
                            ? "font-semibold text-emerald-100"
                            : "text-slate-200"
                        }`}
                      >
                        {label}
                      </span>
                    </li>
                  );
                })}
              </ul>

              <button
                type="button"
                onClick={() =>
                  onRegister(plan.highlight ? "PRO" : "BASIC")
                }
                className={`w-full cursor-pointer rounded-xl py-3.5 text-sm font-bold transition-all duration-200 ${
                  plan.highlight ? "btn-emerald text-white" : ""
                }`}
                style={
                  !plan.highlight
                    ? {
                        border: `1.5px solid ${plan.color}`,
                        color: plan.color,
                        background: `${plan.color}18`,
                      }
                    : undefined
                }
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>

        <div className="mx-auto mt-10 max-w-4xl rounded-2xl border border-amber-400/25 bg-amber-500/5 px-6 py-5 text-center">
          <p className="text-sm font-semibold text-amber-200">
            ¿Varias sucursales, dominio propio o integraciones a medida?
          </p>
          <p className="mt-1 text-sm text-slate-400">
            Enterprise sigue en el roadmap.{" "}
            <a
              href="mailto:hola@platolisto.com?subject=PlatoListo%20Enterprise"
              className="font-semibold text-amber-300 underline-offset-2 hover:underline"
            >
              Habla con ventas
            </a>{" "}
            y lo armamos contigo.
          </p>
        </div>

        {/* Trust strip */}
        <div className="mt-12 flex flex-wrap justify-center gap-6 text-sm text-slate-400">
          {[
            "✓ Sin tarjeta de crédito para empezar",
            "✓ Configuración en 2 minutos",
            "✓ Soporte en español",
            "✓ Escala de Básico a Pro cuando quieras",
          ].map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
      </div>
    </section>
  )
}

function RegisterSection({
  sectionRef,
  defaultPlan,
}: {
  sectionRef: RefObject<HTMLElement | null>;
  defaultPlan: "BASIC" | "PRO";
}) {
  return (
    <section
      id="registro"
      ref={sectionRef}
      className="py-24 relative"
      style={{ scrollMarginTop: 80 }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 80% at 50% 50%, rgba(16,185,129,0.06) 0%, transparent 70%)",
        }}
      />
      <div className="mx-auto max-w-2xl px-6 lg:px-8">
        <div
          className="relative overflow-hidden rounded-3xl p-8 lg:p-12"
          style={{
            background: "rgba(30,41,59,0.8)",
            border: "1px solid rgba(51,65,85,0.7)",
            backdropFilter: "blur(16px)",
          }}
        >
          <div
            className="absolute top-0 left-0 right-0 h-px"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(16,185,129,0.6), transparent)",
            }}
          />
          <div className="mb-8 text-center">
            <div
              className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl text-2xl"
              style={{
                background: "rgba(16,185,129,0.12)",
                border: "1px solid rgba(16,185,129,0.3)",
              }}
            >
              🚀
            </div>
            <h2
              className="mb-3 text-3xl font-black text-white lg:text-4xl"
              style={{ fontFamily: "var(--font-jakarta), Plus Jakarta Sans, sans-serif" }}
            >
              Registra tu local en
              <br />
              <span className="gradient-text">menos de 2 minutos</span>
            </h2>
            <p className="text-sm text-slate-400">
              Elige Básico o Pro. Early access: el cobro Pro es por transferencia
              o efectivo; te damos un cupón para activar.
            </p>
          </div>
          <RegisterForm variant="b2b" defaultPlan={defaultPlan} />
          <p className="mt-5 text-center text-[11px] leading-relaxed text-slate-500">
            * Plan Pro: $999 MXN/mes + $1,000 MXN de setup (pago único). Tras
            pagar, canjeas un cupón en Configuración (o al registrarte) y el
            sitio queda activo. Cobro online llega después.
          </p>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer
      className="py-12 border-t"
      style={{ borderColor: 'rgba(51,65,85,0.5)' }}
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
              style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}
            >
              🍽️
            </div>
            <span
              className="text-lg font-black"
              style={{ fontFamily: 'var(--font-jakarta), Plus Jakarta Sans, sans-serif', color: '#F8FAFC' }}
            >
              Plato<span style={{ color: '#10B981' }}>Listo</span>
            </span>
          </div>

          {/* Links */}
          <div className="flex flex-wrap items-center justify-center gap-6">
            {['Privacidad', 'Términos', 'Soporte', 'Blog'].map((link) => (
              <a
                key={link}
                href="#"
                className="text-sm text-slate-500 hover:text-emerald-400 transition-colors duration-200"
              >
                {link}
              </a>
            ))}
          </div>

          {/* Social + Copyright */}
          <div className="flex items-center gap-4">
            {[
              { icon: '𝕏', label: 'Twitter' },
              { icon: 'in', label: 'LinkedIn' },
              { icon: 'f', label: 'Facebook' },
            ].map((s) => (
              <a
                key={s.label}
                href="#"
                aria-label={s.label}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-slate-500 hover:text-emerald-400 hover:border-emerald-500/40 transition-all duration-200"
                style={{ border: '1px solid rgba(51,65,85,0.6)' }}
              >
                {s.icon}
              </a>
            ))}
          </div>
        </div>

        <div
          className="mt-8 pt-6 text-center text-xs text-slate-600 border-t"
          style={{ borderColor: 'rgba(51,65,85,0.3)' }}
        >
          © 2026 PlatoListo. Todos los derechos reservados. Hecho con ❤️ para restauranteros mexicanos.
        </div>
      </div>
    </footer>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export function B2bLanding() {
  const registerRef = useRef<HTMLElement>(null)
  const [selectedPlan, setSelectedPlan] = useState<"BASIC" | "PRO">("BASIC")

  useEffect(() => {
    document.documentElement.classList.add("scroll-smooth");
    document.documentElement.classList.add("overflow-x-hidden");
    document.body.classList.add("overflow-x-hidden");
    return () => {
      document.documentElement.classList.remove("scroll-smooth");
      document.documentElement.classList.remove("overflow-x-hidden");
      document.body.classList.remove("overflow-x-hidden");
    };
  }, []);

  const scrollToRegister = (plan: "BASIC" | "PRO" = "BASIC") => {
    setSelectedPlan(plan)
    const target =
      registerRef.current ?? document.getElementById("registro")
    target?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <div
      className="b2b-landing min-h-screen w-full max-w-full overflow-x-hidden font-[family-name:var(--font-jakarta)]"
      style={{ background: "#0F172A", color: "#F8FAFC" }}
    >
      <Navbar onRegister={() => scrollToRegister("BASIC")} />
      <HeroSection onRegister={() => scrollToRegister("BASIC")} />
      <FeaturesSection />
      <PricingSection onRegister={scrollToRegister} />
      <RegisterSection sectionRef={registerRef} defaultPlan={selectedPlan} />
      <Footer />
    </div>
  )
}
