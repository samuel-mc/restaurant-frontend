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
import dynamic from "next/dynamic";
import Link from "next/link";
import { getPublicRootDomain, buildTenantSiteUrl } from "@/lib/qr-menu-url";
import { QaEnvBadge } from "@/components/env-qa-badge";

const RegisterForm = dynamic(
  () =>
    import("@/components/marketing/RegisterForm").then((mod) => ({
      default: mod.RegisterForm,
    })),
  {
    loading: () => (
      <div
        className="min-h-[28rem] rounded-xl border border-[var(--b2b-border)]"
        style={{
          background:
            "color-mix(in srgb, var(--b2b-surface) 70%, transparent)",
        }}
        aria-busy="true"
        aria-label="Cargando formulario de registro"
      />
    ),
  },
);

// ─── Types ───────────────────────────────────────────────────────────────────
interface OrderItem {
  id: number
  table: string
  item: string
  status: 'new' | 'preparing' | 'ready'
  time: string
}

// ─── Data ────────────────────────────────────────────────────────────────────
/** Tres trabajos operativos — el sitio Pro va en su propio beat, no en esta lista. */
const OPERATING_JOBS = [
  {
    title: "Menú QR en mesa",
    desc: "Piden en el celular, sin app, y ven el pedido avanzar.",
  },
  {
    title: "Cocina en vivo",
    desc: "Comandas al monitor al instante, con estado y alerta de sonido.",
  },
  {
    title: "Canal propio, sin comisión",
    desc: "Pickup y delivery por tu subdominio — sin el 30% de las apps.",
  },
];

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
      "Monitor de cocina en vivo",
      "Panel de administración",
      "Subdominio platolisto.com",
    ],
    cta: "Crear con Básico",
    highlight: false,
  },
  {
    name: "Plan Pro",
    price: "$1,000",
    period: "por mes / restaurante",
    badge: "Sitio a medida",
    color: "#34D399",
    setupFee: "+$2,000 MXN de creación de sitio web (pago único)",
    features: [
      {
        label: "Sitio web a medida (diseño propio por local)",
        highlight: true,
      },
      "Menú QR ilimitado",
      "Pedidos Pickup y Delivery",
      "Soporte prioritario",
    ],
    cta: "Crear con Pro",
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

function BrandMark({ size = "md" }: { size?: "sm" | "md" }) {
  const box = size === "sm" ? "size-8" : "size-9";
  return (
    <img
      src="/brand/platolisto-logo.png"
      alt=""
      width={size === "sm" ? 32 : 36}
      height={size === "sm" ? 32 : 36}
      className={`${box} shrink-0 object-contain`}
      aria-hidden
    />
  );
}

function Navbar({
  onRegister,
  selectedPlan,
}: {
  onRegister: () => void;
  selectedPlan: "BASIC" | "PRO";
}) {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const menuId = "b2b-mobile-nav"
  const menuRef = useRef<HTMLDivElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const wasOpenRef = useRef(false)

  const registerAria =
    selectedPlan === "PRO"
      ? "Continuar registro con Plan Pro"
      : "Crear mi restaurante con Plan Básico, gratis";
  const registerLabel =
    selectedPlan === "PRO" ? "Continuar con Pro" : "Crear mi restaurante";

  useEffect(() => {
    let ticking = false
    const fn = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        setScrolled(window.scrollY > 20)
        ticking = false
      })
    }
    window.addEventListener("scroll", fn, { passive: true })
    return () => window.removeEventListener("scroll", fn)
  }, [])

  useEffect(() => {
    document.body.classList.toggle("overflow-hidden", mobileOpen)
    return () => {
      document.body.classList.remove("overflow-hidden")
    }
  }, [mobileOpen])

  useEffect(() => {
    if (!mobileOpen) {
      if (wasOpenRef.current) {
        menuButtonRef.current?.focus()
      }
      wasOpenRef.current = false
      return
    }

    wasOpenRef.current = true
    const menu = menuRef.current
    const firstInMenu = menu?.querySelector<HTMLElement>(
      "a[href], button:not([disabled])",
    )
    firstInMenu?.focus()

    const getFocusable = () => {
      const inMenu = menu
        ? Array.from(
            menu.querySelectorAll<HTMLElement>(
              'a[href], button:not([disabled])',
            ),
          )
        : []
      const toggle = menuButtonRef.current
      return toggle ? [toggle, ...inMenu] : inMenu
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        setMobileOpen(false)
        return
      }
      if (event.key !== "Tab") return

      const items = getFocusable()
      if (items.length === 0) return

      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement

      if (event.shiftKey) {
        if (active === first) {
          event.preventDefault()
          last.focus()
        }
      } else if (active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [mobileOpen])

  const links = [
    { label: "Inicio", href: "#contenido-principal" },
    { label: "Cómo opera", href: "#caracteristicas" },
    { label: "Precios", href: "#precios" },
  ]

  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 top-0 z-50 w-full max-w-full overflow-x-hidden transition-[background-color,border-color] duration-300"
      style={{
        background:
          scrolled || mobileOpen
            ? "rgba(15, 23, 42, 0.98)"
            : "transparent",
        borderBottom:
          scrolled || mobileOpen
            ? "1px solid rgba(51, 65, 85, 0.6)"
            : "none",
      }}
    >
      <div className="mx-auto w-full min-w-0 max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 min-w-0 items-center justify-between gap-3 lg:h-20">
          <a
            href="#contenido-principal"
            className="group flex min-w-0 items-center gap-2 rounded-lg sm:gap-2.5"
          >
            <span className="transition-transform group-hover:scale-105">
              <BrandMark />
            </span>
            <span
              className="truncate text-lg font-black tracking-tight text-[var(--b2b-fg)] sm:text-xl"
              style={{
                fontFamily:
                  "var(--font-jakarta), Plus Jakarta Sans, sans-serif",
              }}
            >
              Plato<span className="accent-text">Listo</span>
            </span>
          </a>

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

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={onRegister}
              className="btn-emerald hidden min-h-11 cursor-pointer items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white md:flex"
              aria-label={registerAria}
            >
              <span>{registerLabel}</span>
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                aria-hidden
              >
                <path
                  d="M1 7h12M7 1l6 6-6 6"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button
              ref={menuButtonRef}
              type="button"
              className="flex size-11 items-center justify-center rounded-lg text-slate-300 md:hidden"
              aria-label={mobileOpen ? "Cerrar menú" : "Abrir menú"}
              aria-expanded={mobileOpen}
              aria-controls={menuId}
              onClick={() => setMobileOpen((open) => !open)}
            >
              <span className="flex w-5 flex-col" aria-hidden>
                <span
                  className="mb-1.5 h-0.5 w-5 bg-current transition-transform"
                  style={{
                    transform: mobileOpen
                      ? "rotate(45deg) translate(1.5px, 6px)"
                      : "none",
                  }}
                />
                <span
                  className="mb-1.5 h-0.5 w-5 bg-current transition-opacity"
                  style={{ opacity: mobileOpen ? 0 : 1 }}
                />
                <span
                  className="h-0.5 w-5 bg-current transition-transform"
                  style={{
                    transform: mobileOpen
                      ? "rotate(-45deg) translate(1.5px, -6px)"
                      : "none",
                  }}
                />
              </span>
            </button>
          </div>
        </div>

        {mobileOpen ? (
          <div
            ref={menuRef}
            id={menuId}
            className="mt-2 border-t border-slate-700/50 pb-4 md:hidden"
            style={{ background: "rgba(15, 23, 42, 0.97)" }}
          >
            {links.map((l) => (
              <a
                key={l.label}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                className="block min-h-11 break-words py-3 text-sm font-medium text-slate-200 transition-colors hover:text-emerald-300"
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
              className="btn-emerald mt-3 min-h-11 w-full cursor-pointer rounded-xl py-2.5 text-sm font-semibold text-white"
              aria-label={registerAria}
            >
              {registerLabel}
            </button>
          </div>
        ) : null}
      </div>
    </nav>
  );
}

function HeroMockup() {
  const [orders, setOrders] = useState<OrderItem[]>(INITIAL_ORDERS)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
    let intervalId: number | undefined

    const stop = () => {
      if (intervalId !== undefined) {
        window.clearInterval(intervalId)
        intervalId = undefined
      }
    }

    const start = () => {
      if (reduceMotion.matches || intervalId !== undefined) return
      intervalId = window.setInterval(() => {
        setOrders((prev) => {
          const next = [...prev]
          const idx = Math.floor(Math.random() * next.length)
          const statuses: OrderItem["status"][] = ["new", "preparing", "ready"]
          const cur = statuses.indexOf(next[idx].status)
          next[idx] = {
            ...next[idx],
            status: statuses[Math.min(cur + 1, 2)],
          }
          return next
        })
      }, 2200)
    }

    const sync = (visible: boolean) => {
      const motionOn = visible && !reduceMotion.matches
      root.dataset.motion = motionOn ? "on" : "off"
      if (motionOn) start()
      else stop()
    }

    const observer = new IntersectionObserver(
      ([entry]) => sync(Boolean(entry?.isIntersecting)),
      { threshold: 0.2 },
    )
    observer.observe(root)

    const onMotionChange = () =>
      sync(root.getBoundingClientRect().top < window.innerHeight)
    reduceMotion.addEventListener("change", onMotionChange)
    sync(false)

    return () => {
      observer.disconnect()
      reduceMotion.removeEventListener("change", onMotionChange)
      stop()
    }
  }, [])

  const statusLabel = { new: "Nuevo", preparing: "Preparando", ready: "Listo" };
  const statusClass = {
    new: "badge-new",
    preparing: "badge-preparing",
    ready: "badge-ready",
  };
  const statusDot = {
    new: "var(--b2b-accent)",
    preparing: "var(--b2b-warn)",
    ready: "var(--b2b-status-ready)",
  };
  const mobileOrders = orders.slice(0, 2);

  function ticketBorder(status: OrderItem["status"]) {
    if (status === "new")
      return "color-mix(in srgb, var(--b2b-accent-deep) 30%, transparent)";
    if (status === "preparing")
      return "color-mix(in srgb, var(--b2b-warn) 30%, transparent)";
    return "color-mix(in srgb, var(--b2b-status-ready) 30%, transparent)";
  }

  return (
    <div
      ref={rootRef}
      className="relative mx-auto flex w-full max-w-full flex-col items-center gap-5 px-1 pb-4 pt-2 sm:gap-6 lg:flex-row lg:items-end lg:justify-end lg:gap-5 lg:px-0 lg:pb-2 lg:pt-8"
      aria-hidden
    >
      {/* Phone — QR Menu (siempre visible) */}
      <div className="animate-float relative z-[2] mb-2 w-[10.5rem] shrink-0 sm:w-[12rem] lg:mb-0 lg:w-[11.25rem]">
        <div
          className="overflow-hidden rounded-3xl border border-[var(--b2b-border)] shadow-[0_12px_32px_rgba(0,0,0,0.45)]"
          style={{ background: "var(--b2b-surface)", padding: "12px 10px" }}
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
            <div className="mx-auto mb-1.5 size-8 overflow-hidden rounded-full border border-emerald-400/30">
              {/* eslint-disable-next-line @next/next/no-img-element -- decorative mock */}
              <img
                src="https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=96&h=96&fit=crop&auto=format"
                alt=""
                width={32}
                height={32}
                className="size-full object-cover"
                loading="eager"
                decoding="async"
                fetchPriority="low"
              />
            </div>
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
                  background: i === 0 ? "#047857" : "rgba(51,65,85,0.8)",
                  color: i === 0 ? "white" : "#94A3B8",
                }}
              >
                {c}
              </span>
            ))}
          </div>
          {[
            {
              name: "Tacos al Pastor",
              price: "$45",
              img: "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=80&h=80&fit=crop&auto=format",
            },
            {
              name: "Agua Jamaica",
              price: "$25",
              img: "https://images.unsplash.com/photo-1622597467836-f3285f2131b8?w=80&h=80&fit=crop&auto=format",
            },
            {
              name: "Enchiladas",
              price: "$65",
              img: "https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=80&h=80&fit=crop&auto=format",
            },
          ].map((item) => (
            <div
              key={item.name}
              className="mb-1.5 flex items-center gap-2 rounded-lg p-1.5"
              style={{
                background: "rgba(30,41,59,0.8)",
                border: "1px solid rgba(51,65,85,0.5)",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- decorative mock */}
              <img
                src={item.img}
                alt=""
                width={28}
                height={28}
                className="size-7 shrink-0 rounded-md object-cover"
                loading="eager"
                decoding="async"
              />
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
                style={{ background: "#047857", fontSize: 14, lineHeight: 1 }}
              >
                +
              </span>
            </div>
          ))}
          <div
            className="mt-2 rounded-lg py-2 text-center text-[10px] font-bold text-white"
            style={{
              background: "#047857",
            }}
          >
            Ver mi pedido (3)
          </div>
        </div>
        <div
          className="absolute right-0 -bottom-3 rounded-xl border border-[var(--b2b-border)] p-2 text-center shadow-lg"
          style={{ background: "var(--b2b-surface)" }}
        >
          <div className="mb-1 grid size-8 grid-cols-3 gap-0.5">
            {Array.from({ length: 9 }, (_, i) => (
              <div
                key={i}
                className="rounded-sm"
                style={{
                  background: [0, 1, 3, 5, 7, 8].includes(i)
                    ? "var(--b2b-accent-deep)"
                    : "transparent",
                }}
              />
            ))}
          </div>
          <div className="text-[8px] font-medium text-[var(--b2b-muted)]">
            Escanear
          </div>
        </div>
      </div>

      {/* Cocina compacta — móvil / tablet: Service Line Live sin el monitor completo */}
      <div className="z-[1] w-full max-w-sm pt-1 lg:hidden">
        <div
          className="rounded-2xl border border-[var(--b2b-border)] p-3 shadow-[0_12px_32px_rgba(0,0,0,0.45)] sm:p-3.5"
          style={{
            background:
              "color-mix(in srgb, var(--b2b-surface) 95%, transparent)",
          }}
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div
                className="text-sm font-bold text-[var(--b2b-fg)]"
                style={{
                  fontFamily:
                    "var(--font-jakarta), Plus Jakarta Sans, sans-serif",
                }}
              >
                Cocina al momento
              </div>
              <div className="mt-1 flex items-center gap-1.5">
                <span className="animate-blink inline-block size-1.5 shrink-0 rounded-full bg-[var(--b2b-accent)]" />
                <span className="truncate text-xs font-medium text-[var(--b2b-accent)]">
                  <span className="sm:hidden">EN VIVO</span>
                  <span className="hidden sm:inline">
                    EN VIVO · comandas al instante
                  </span>
                </span>
              </div>
            </div>
            <div
              className="shrink-0 rounded-lg px-2 py-1 text-xs font-bold"
              style={{
                background:
                  "color-mix(in srgb, var(--b2b-accent-deep) 22%, transparent)",
                color: "var(--b2b-accent)",
              }}
            >
              {orders.length} activas
            </div>
          </div>

          <div className="space-y-2">
            {mobileOrders.map((order) => (
              <div
                key={`m-${order.id}`}
                className="rounded-xl px-3 py-2.5 transition-[border-color,background-color] duration-500"
                style={{
                  background:
                    "color-mix(in srgb, var(--b2b-surface) 92%, black)",
                  border: `1px solid ${ticketBorder(order.status)}`,
                }}
              >
                <div className="mb-0.5 flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[var(--b2b-fg)]">
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
                <div className="truncate text-xs text-[var(--b2b-muted)]">
                  {order.item}
                </div>
              </div>
            ))}
          </div>

          <div
            className="mt-3 flex items-center gap-2 rounded-xl px-3 py-2.5"
            style={{ background: "var(--b2b-action)" }}
          >
            <span
              className="size-2 shrink-0 rounded-full bg-white"
              aria-hidden
            />
            <p className="text-xs leading-snug text-emerald-50">
              <span className="font-bold text-white">Nueva comanda</span>
              {" · "}
              Mesa 12 · Birria x2
            </p>
          </div>
        </div>
      </div>

      {/* Tablet — solo desktop */}
      <div className="animate-float-delayed relative z-[1] hidden w-[15.5rem] shrink-0 lg:block">
        <div
          className="overflow-hidden rounded-2xl border border-[var(--b2b-border)] shadow-[0_12px_32px_rgba(0,0,0,0.45)]"
          style={{
            background: "var(--b2b-canvas)",
            padding: "10px",
          }}
        >
          <div className="mb-2 flex items-center justify-between px-1">
            <div>
              <div
                className="text-xs font-bold text-[var(--b2b-fg)]"
                style={{
                  fontFamily:
                    "var(--font-jakarta), Plus Jakarta Sans, sans-serif",
                }}
              >
                Monitor de Cocina
              </div>
              <div className="mt-0.5 flex items-center gap-1.5">
                <span className="animate-blink inline-block size-1.5 rounded-full bg-[var(--b2b-accent)]" />
                <span className="text-[9px] font-medium text-[var(--b2b-accent)]">
                  EN VIVO
                </span>
              </div>
            </div>
            <div
              className="rounded-lg px-2 py-1 text-xs font-bold"
              style={{
                background:
                  "color-mix(in srgb, var(--b2b-accent-deep) 22%, transparent)",
                color: "var(--b2b-accent)",
              }}
            >
              {orders.length} activas
            </div>
          </div>

          <div className="space-y-1.5">
            {orders.map((order) => (
              <div
                key={order.id}
                className="rounded-xl p-2.5 transition-[border-color,background-color] duration-500"
                style={{
                  background:
                    "color-mix(in srgb, var(--b2b-surface) 92%, black)",
                  border: `1px solid ${ticketBorder(order.status)}`,
                }}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-[var(--b2b-fg)]">
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
                <div className="text-[10px] text-[var(--b2b-muted)]">
                  {order.item}
                </div>
                <div className="mt-0.5 text-[9px] text-[var(--b2b-muted)]">
                  {order.time} hrs
                </div>
              </div>
            ))}
          </div>

          <div
            className="mt-2 flex items-center gap-2 rounded-xl px-2.5 py-2"
            style={{ background: "var(--b2b-action)" }}
          >
            <span
              className="size-1.5 shrink-0 rounded-full bg-white"
              aria-hidden
            />
            <p className="text-[10px] leading-snug text-emerald-50">
              <span className="font-bold text-white">Nueva comanda</span>
              {" · "}
              Mesa 12 · Birria x2
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroSection({ onRegister }: { onRegister: () => void }) {
  return (
    <section
      aria-label="PlatoListo"
      className="relative flex items-start overflow-x-hidden lg:min-h-[100svh] lg:items-center"
      style={{ paddingTop: 80 }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "linear-gradient(rgba(16,185,129,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(16,185,129,0.15) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />
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
          <div className="relative z-10 min-w-0 overflow-visible">
            <h1
              className="mb-4 text-[1.75rem] leading-none font-black tracking-tight sm:mb-5 sm:text-4xl md:text-5xl lg:text-6xl"
              style={{
                fontFamily:
                  "var(--font-jakarta), Plus Jakarta Sans, sans-serif",
              }}
            >
              Plato<span className="accent-text">Listo</span>
            </h1>

            <p
              className="mb-5 max-w-xl text-xl leading-snug font-bold tracking-tight text-pretty text-white sm:mb-6 sm:text-2xl md:text-3xl lg:text-4xl"
              style={{
                fontFamily:
                  "var(--font-jakarta), Plus Jakarta Sans, sans-serif",
              }}
            >
              Tu menú en la mesa.{" "}
              <span style={{ color: "var(--b2b-warn)" }}>Tu cocina en vivo.</span>
            </p>

            <p className="mb-8 max-w-lg text-base leading-relaxed text-slate-400 sm:text-lg">
              Los comensales piden por QR; tú ves la cocina al momento. Tu canal
              de venta,{" "}
              <span className="font-semibold text-white">sin pagar el 30%</span>{" "}
              a las apps.
            </p>

            <div className="flex flex-col items-stretch gap-3 sm:items-start">
              <button
                type="button"
                onClick={onRegister}
                className="btn-emerald flex min-h-11 w-full cursor-pointer items-center justify-center rounded-xl px-6 py-3.5 text-sm font-bold text-white sm:w-auto sm:px-7 sm:py-4 sm:text-base"
                aria-label="Crear mi restaurante con Plan Básico, gratis"
              >
                Crear mi restaurante
              </button>
              <p className="max-w-md text-sm leading-relaxed text-[var(--b2b-muted)]">
                Empieza gratis con Plan Básico.{" "}
                <a
                  href="#sitio-pro"
                  className="font-semibold text-[var(--b2b-accent)] underline-offset-2 hover:underline"
                >
                  ¿Sitio a medida? Ver Plan Pro
                </a>
              </p>
            </div>
          </div>

          <div className="relative z-0 mt-6 w-full max-w-full sm:mt-8 lg:mt-0 lg:flex lg:justify-end">
            <HeroMockup />
          </div>
        </div>
      </div>
    </section>
  );
}

function useProDemoUrl() {
  const host = getPublicRootDomain();
  const [demoUrl, setDemoUrl] = useState(
    () => `https://latrattoria.${host}`,
  );

  useEffect(() => {
    setDemoUrl(buildTenantSiteUrl("latrattoria"));
  }, []);

  return demoUrl;
}

function ProDemoLink({
  className,
  href,
}: {
  className?: string;
  href: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      aria-label="Ver ejemplo vivo de La Trattoria (se abre en una pestaña nueva)"
    >
      Ver ejemplo vivo
    </a>
  );
}

function ProSitePreview({
  demoUrl,
  host,
}: {
  demoUrl: string;
  host: string;
}) {
  return (
    <figure className="min-w-0 w-full">
      <div
        className="overflow-hidden rounded-2xl border border-[var(--b2b-border)] shadow-[0_14px_40px_rgba(0,0,0,0.35)]"
        style={{ background: "var(--b2b-surface)" }}
      >
        <div
          className="flex items-center gap-2 border-b border-[var(--b2b-border)] px-3 py-2.5"
          style={{
            background: "color-mix(in srgb, var(--b2b-canvas) 88%, black)",
          }}
        >
          <div className="flex gap-1.5" aria-hidden>
            <span className="size-2.5 rounded-full bg-slate-600" />
            <span className="size-2.5 rounded-full bg-slate-600" />
            <span className="size-2.5 rounded-full bg-slate-600" />
          </div>
          <a
            href={demoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="min-w-0 flex-1 truncate rounded-md bg-slate-950/80 px-3 py-1.5 text-center text-xs text-[var(--b2b-muted)] transition-colors hover:text-[var(--b2b-accent)]"
            aria-label="Abrir latrattoria en una pestaña nueva"
          >
            latrattoria.{host}
          </a>
        </div>

        <div className="relative aspect-[16/10] overflow-hidden bg-[#0e1f16]">
          {/* eslint-disable-next-line @next/next/no-img-element -- decorative demo crop; same asset as Pro landing */}
          <img
            src="https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200&h=750&fit=crop&auto=format"
            alt=""
            width={1200}
            height={750}
            sizes="(max-width: 1024px) 100vw, 36rem"
            className="absolute inset-0 h-full w-full object-cover opacity-50"
            loading="lazy"
            decoding="async"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to bottom, rgba(14,31,22,0.55), rgba(14,31,22,0.25) 45%, rgba(14,31,22,0.85))",
            }}
          />
          <div className="relative z-10 flex h-full flex-col items-center justify-center px-5 py-6 text-center sm:px-6">
            <p className="mb-2 font-[family-name:var(--font-nunito)] text-[10px] tracking-[0.35em] text-[#d4a853] uppercase sm:text-xs">
              Ristorante Italiano
            </p>
            <p className="mb-3 font-[family-name:var(--font-playfair)] text-2xl font-black tracking-tight text-balance text-white sm:text-3xl md:text-4xl">
              La Trattoria
            </p>
            <p className="mb-5 max-w-[18rem] font-[family-name:var(--font-nunito)] text-xs leading-relaxed text-white/75 sm:text-sm">
              Ingredientes frescos, recetas de la casa y un servicio cercano.
            </p>
            <span
              className="rounded-sm px-5 py-2.5 font-[family-name:var(--font-nunito)] text-[10px] font-semibold tracking-widest text-white uppercase"
              style={{ background: "#C9612A" }}
            >
              Ver menú
            </span>
          </div>
        </div>
      </div>
      <figcaption className="mt-3 max-w-prose text-sm leading-snug text-[var(--b2b-muted)]">
        Ejemplo Pro entregado:{" "}
        <span className="font-semibold text-slate-300">La Trattoria</span>. Tu
        menú QR y la cocina operan desde el día uno; el sitio se publica cuando
        lo entregamos.
      </figcaption>
    </figure>
  );
}

function FeaturesSection() {
  return (
    <section
      id="caracteristicas"
      className="b2b-section relative scroll-mt-20 py-24"
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 80% 50%, rgba(245,158,11,0.04) 0%, transparent 60%)",
        }}
      />
      <div className="relative mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        <div className="mb-12 max-w-2xl">
          <h2
            className="mb-4 text-4xl leading-tight font-black text-white lg:text-5xl"
            style={{
              fontFamily:
                "var(--font-jakarta), Plus Jakarta Sans, sans-serif",
            }}
          >
            Opera el servicio
            <br />
            <span className="accent-text-warn">en una sola línea</span>
          </h2>
          <p className="max-w-xl text-lg text-[var(--b2b-muted)]">
            Mesa, cocina y tu canal — en el mismo turno.
          </p>
        </div>

        <ol className="max-w-3xl space-y-8 sm:space-y-10">
          {OPERATING_JOBS.map((job, i) => (
            <li key={job.title} className="flex gap-5 sm:gap-6">
              <span
                className="w-8 shrink-0 pt-1 text-sm font-bold tabular-nums text-[var(--b2b-accent)]"
                aria-hidden
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0">
                <h3
                  className="mb-1.5 text-lg font-bold text-white sm:text-xl"
                  style={{
                    fontFamily:
                      "var(--font-jakarta), Plus Jakarta Sans, sans-serif",
                  }}
                >
                  {job.title}
                </h3>
                <p className="max-w-prose text-base leading-relaxed text-[var(--b2b-muted)]">
                  {job.desc}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function ProSection({
  onRegisterPro,
}: {
  onRegisterPro: () => void;
}) {
  const host = getPublicRootDomain();
  const demoUrl = useProDemoUrl();

  return (
    <section id="sitio-pro" className="b2b-section relative scroll-mt-20 py-24">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 20% 40%, rgba(16,185,129,0.06) 0%, transparent 65%)",
        }}
      />
      <div className="relative mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-12 xl:gap-16">
          <div className="min-w-0 lg:pr-2">
            <p className="mb-3 text-xs font-semibold tracking-wide text-[var(--b2b-accent)] uppercase">
              Plan Pro
            </p>
            <h2
              className="mb-4 text-4xl leading-tight font-black tracking-tight text-pretty text-white lg:text-5xl"
              style={{
                fontFamily:
                  "var(--font-jakarta), Plus Jakarta Sans, sans-serif",
              }}
            >
              Sitio web exclusivo
              <br />
              de tu restaurante
            </h2>
            <p className="mb-8 max-w-md text-base leading-relaxed text-[var(--b2b-muted)] sm:text-lg">
              No es una plantilla compartida: diseñamos y entregamos el sitio de
              tu local. El menú y la cocina ya corren; el sitio llega cuando está
              listo.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <button
                type="button"
                onClick={onRegisterPro}
                className="btn-emerald inline-flex min-h-11 w-full cursor-pointer items-center justify-center rounded-xl px-6 py-3.5 text-sm font-bold text-white sm:w-auto sm:text-base"
              >
                Crear con Pro
              </button>
              <ProDemoLink
                href={demoUrl}
                className="btn-outline inline-flex min-h-11 w-full items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold sm:w-auto"
              />
            </div>
            <p className="mt-4 text-sm leading-relaxed text-[var(--b2b-muted)]">
              Incluye setup de sitio.{" "}
              <a
                href="#precios"
                className="font-semibold text-[var(--b2b-accent)] underline-offset-2 hover:underline"
              >
                Ver precio
              </a>
            </p>
          </div>
          <ProSitePreview demoUrl={demoUrl} host={host} />
        </div>
      </div>
    </section>
  );
}

function PricingSection({
  onRegister,
}: {
  onRegister: (plan: "BASIC" | "PRO") => void;
}) {
  return (
    <section id="precios" className="b2b-section relative scroll-mt-20 py-24">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 70% 50% at 30% 60%, rgba(16,185,129,0.05) 0%, transparent 60%)' }}
      />
      <div className="relative mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        <div className="mb-16 mx-auto max-w-2xl text-center">
          <h2
            className="mb-4 text-4xl font-black text-white lg:text-5xl"
            style={{
              fontFamily:
                "var(--font-jakarta), Plus Jakarta Sans, sans-serif",
            }}
          >
            Dos planes claros
            <br />
            <span className="accent-text">para tu operación</span>
          </h2>
          <p className="text-lg text-[var(--b2b-muted)]">
            Empieza gratis con Básico. Pasa a Pro cuando quieras sitio a medida y
            menú sin límite.
          </p>
        </div>

        <div className="mx-auto grid max-w-4xl grid-cols-1 items-stretch gap-6 md:grid-cols-2">
          {PRICING.map((plan) => (
            <div
              key={plan.name}
              className="relative flex flex-col rounded-2xl p-8 transition-shadow duration-300"
              style={{
                background: plan.highlight
                  ? "linear-gradient(145deg, rgba(16,185,129,0.12), rgba(5,150,105,0.08))"
                  : "rgba(30,41,59,0.6)",
                border: plan.highlight
                  ? "1.5px solid rgba(52,211,153,0.55)"
                  : "1px solid rgba(51,65,85,0.6)",
                boxShadow: plan.highlight
                  ? "0 14px 40px rgba(0, 0, 0, 0.35)"
                  : "none",
              }}
            >
              {plan.badge && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span
                    className="whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-bold text-white"
                    style={{ background: "var(--b2b-action)" }}
                  >
                    {plan.badge}
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
                  <span className="mb-1.5 text-sm text-slate-400">MXN</span>
                </div>
                <p className="text-sm text-slate-400">{plan.period}</p>
                {plan.setupFee ? (
                  <p className="mt-3 inline-flex max-w-full flex-wrap items-center gap-1.5 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1.5 text-left text-xs font-semibold leading-snug text-emerald-400">
                    <span>{plan.setupFee}</span>
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
                className={`min-h-11 w-full cursor-pointer rounded-xl py-3.5 text-sm font-bold transition-all duration-200 ${
                  plan.highlight ? "btn-emerald text-white" : "btn-plan-basic"
                }`}
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
          <p className="mt-1 text-sm text-amber-100/75">
            Enterprise sigue en el roadmap.{" "}
            <a
              href="mailto:hola@platolisto.com?subject=PlatoListo%20Enterprise"
              className="font-semibold text-amber-200 underline-offset-2 hover:underline"
            >
              Habla con ventas
            </a>{" "}
            y lo armamos contigo.
          </p>
        </div>

        <p className="mt-12 text-center text-sm leading-relaxed text-slate-400">
          Sin tarjeta para empezar · Tres pasos para crear tu local · Soporte en
          español
        </p>
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
      className="b2b-section relative scroll-mt-20 py-24"
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 80% at 50% 50%, rgba(16,185,129,0.06) 0%, transparent 70%)",
        }}
      />
      <div className="relative mx-auto max-w-2xl px-5 sm:px-6 lg:px-8">
        <div
          className="rounded-3xl border border-[var(--b2b-border)] p-8 lg:p-12"
          style={{ background: "color-mix(in srgb, var(--b2b-surface) 95%, transparent)" }}
        >
          <div className="mb-8 text-center">
            <h2
              className="mb-3 text-3xl font-black text-white lg:text-4xl"
              style={{
                fontFamily:
                  "var(--font-jakarta), Plus Jakarta Sans, sans-serif",
              }}
            >
              Crea tu restaurante
            </h2>
            <p className="mx-auto max-w-md text-sm leading-relaxed text-slate-400">
              Tres pasos: elige plan, nombra tu local y crea tu cuenta. El menú
              QR y la cocina quedan listos al terminar.
            </p>
          </div>
          <RegisterForm variant="b2b" defaultPlan={defaultPlan} />
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer
      className="border-t border-[var(--b2b-border)] py-12"
    >
      <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex items-center gap-2.5">
            <BrandMark size="sm" />
            <span
              className="text-lg font-black text-[var(--b2b-fg)]"
              style={{
                fontFamily:
                  "var(--font-jakarta), Plus Jakarta Sans, sans-serif",
              }}
            >
              Plato<span className="accent-text">Listo</span>
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6">
            <Link
              href="/terminos"
              className="text-sm text-slate-400 transition-colors duration-200 hover:text-emerald-300"
            >
              Términos y Condiciones
            </Link>
            <Link
              href="/aviso-de-privacidad"
              className="text-sm text-slate-400 transition-colors duration-200 hover:text-emerald-300"
            >
              Aviso de Privacidad
            </Link>
            <a
              href="mailto:hola@platolisto.com?subject=Soporte%20PlatoListo"
              className="text-sm text-slate-400 transition-colors duration-200 hover:text-emerald-300"
            >
              Soporte
            </a>
          </div>
        </div>

        <div className="mt-8 border-t border-[var(--b2b-border)] pt-6 text-center text-xs text-slate-400">
          <span className="inline-flex flex-wrap items-center justify-center gap-2">
            © 2026 PlatoListo. Todos los derechos reservados. Hecho para
            restauranteros mexicanos.
            <QaEnvBadge />
          </span>
        </div>
      </div>
    </footer>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export function B2bLanding() {
  const registerRef = useRef<HTMLElement>(null)
  const [selectedPlan, setSelectedPlan] = useState<"BASIC" | "PRO">("BASIC")
  const [showMobileCta, setShowMobileCta] = useState(false)

  const scrollToRegister = (plan?: "BASIC" | "PRO") => {
    const next = plan ?? selectedPlan
    setSelectedPlan(next)
    const target =
      registerRef.current ?? document.getElementById("registro")
    const preferReduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches
    target?.scrollIntoView({
      behavior: preferReduce ? "auto" : "smooth",
      block: "start",
    })
  }

  useEffect(() => {
    const onScroll = () => {
      const register = document.getElementById("registro")
      const registerTop = register?.getBoundingClientRect().top ?? Infinity
      const pastHero = window.scrollY > 420
      const registerInView = registerTop < window.innerHeight * 0.85
      setShowMobileCta(pastHero && !registerInView)
    }
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)
    return () => {
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
    }
  }, [])

  const stickyLabel =
    selectedPlan === "PRO" ? "Continuar con Pro" : "Crear mi restaurante"
  const stickyAria =
    selectedPlan === "PRO"
      ? "Continuar registro con Plan Pro"
      : "Crear mi restaurante con Plan Básico, gratis"

  return (
    <div className="b2b-landing min-h-screen w-full max-w-full overflow-x-hidden font-[family-name:var(--font-jakarta)]">
      <a href="#contenido-principal" className="b2b-skip-link">
        Saltar al contenido
      </a>
      <Navbar
        onRegister={() => scrollToRegister()}
        selectedPlan={selectedPlan}
      />
      <main id="contenido-principal" tabIndex={-1}>
        <HeroSection onRegister={() => scrollToRegister("BASIC")} />
        <FeaturesSection />
        <ProSection onRegisterPro={() => scrollToRegister("PRO")} />
        <PricingSection onRegister={scrollToRegister} />
        <RegisterSection sectionRef={registerRef} defaultPlan={selectedPlan} />
      </main>
      <Footer />

      {showMobileCta ? (
        <div
          className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--b2b-border)] px-4 py-3 md:hidden"
          style={{
            background: "color-mix(in srgb, var(--b2b-canvas) 94%, transparent)",
            backdropFilter: "blur(12px)",
            paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
          }}
        >
          <button
            type="button"
            onClick={() => scrollToRegister()}
            className="btn-emerald min-h-11 w-full cursor-pointer rounded-xl text-sm font-bold text-white"
            aria-label={stickyAria}
          >
            {stickyLabel}
          </button>
        </div>
      ) : null}
    </div>
  )
}
