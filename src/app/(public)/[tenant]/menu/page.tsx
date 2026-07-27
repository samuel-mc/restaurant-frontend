import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { ClipboardList } from "lucide-react";
import { getMenuByTenant } from "@/services/menuService";
import { getPublicRestaurantProfileOrNull } from "@/services/publicRestaurantQueries";
import { ApiError } from "@/services/apiClient";
import type { Product, RestaurantProfile } from "@/types/api";
import { MenuView } from "@/components/customer/menu-view";
import { buildTenantPageMetadata } from "@/lib/tenant-metadata";
import {
  formatTableLabel,
  normalizeTableParam,
} from "@/lib/table-session";

type TenantMenuPageProps = {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ m?: string | string[] }>;
};

const HEX = /^#[0-9A-Fa-f]{6}$/;

function prettifyTenant(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export async function generateMetadata({
  params,
}: TenantMenuPageProps): Promise<Metadata> {
  const { tenant } = await params;
  const profile = await getPublicRestaurantProfileOrNull(tenant);
  const name = profile?.name ?? prettifyTenant(tenant);
  return buildTenantPageMetadata({
    title: `${name} · Menú digital`,
    description:
      profile?.description?.trim() ||
      (profile?.orderingEnabled === false
        ? `Consulta el menú de ${name}.`
        : `Explora el menú de ${name} y arma tu pedido.`),
    profile,
  });
}

type MenuLoadResult =
  | { status: "ok"; products: Product[] }
  | { status: "empty" }
  | { status: "unavailable"; message: string };

async function loadMenu(tenant: string): Promise<MenuLoadResult> {
  try {
    const products = await getMenuByTenant(tenant);
    if (products.length === 0) return { status: "empty" };
    return { status: "ok", products };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return {
        status: "unavailable",
        message:
          "No encontramos este restaurante. Verifica el enlace o el código QR.",
      };
    }
    return {
      status: "unavailable",
      message:
        "No pudimos cargar el menú en este momento. Intenta de nuevo en unos segundos.",
    };
  }
}

/**
 * Menú digital interactivo + carrito (flujo pedir unificado).
 * Cabecera y modalidades según perfil público.
 */
export default async function TenantMenuPage({
  params,
  searchParams,
}: TenantMenuPageProps) {
  const { tenant } = await params;
  const query = await searchParams;
  const rawM = query.m;
  const tableFromQuery =
    typeof rawM === "string"
      ? rawM
      : Array.isArray(rawM)
        ? rawM[0]
        : null;

  const [menu, profile] = await Promise.all([
    loadMenu(tenant),
    getPublicRestaurantProfileOrNull(tenant),
  ]);

  const restaurantName = profile?.name ?? prettifyTenant(tenant);
  const brand = brandFromProfile(profile);
  const hasBrandFill = Boolean(brand.accent);

  return (
    <main
      className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-background font-jakarta-sans text-foreground"
      style={brand.style}
    >
      <header
        className={
          hasBrandFill
            ? "relative -mx-0 overflow-hidden px-5 pb-7 pt-9 text-[var(--menu-accent-fg)]"
            : "border-b border-border bg-card px-5 pb-6 pt-9"
        }
        style={
          hasBrandFill
            ? {
                backgroundColor: "var(--menu-accent)",
              }
            : undefined
        }
      >
        {hasBrandFill ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                "radial-gradient(120% 80% at 100% 0%, color-mix(in srgb, var(--menu-accent-soft) 55%, transparent), transparent 55%)",
            }}
          />
        ) : null}

        <div className="relative flex items-center gap-3.5">
          {profile?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.logoUrl}
              alt={`Logo de ${restaurantName}`}
              className={
                hasBrandFill
                  ? "size-14 rounded-2xl object-cover ring-2 ring-[var(--menu-accent-fg)]/25"
                  : "size-14 rounded-2xl object-cover ring-1 ring-border"
              }
            />
          ) : (
            <div
              aria-hidden
              className={
                hasBrandFill
                  ? "flex size-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--menu-accent-fg)]/15 text-lg font-black tracking-tight"
                  : "flex size-14 shrink-0 items-center justify-center rounded-2xl bg-secondary text-lg font-black tracking-tight text-foreground"
              }
            >
              {restaurantName.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-[1.75rem] font-extrabold leading-tight tracking-tight">
              {restaurantName}
            </h1>
            <p
              className={
                hasBrandFill
                  ? "mt-1 text-sm leading-snug text-[var(--menu-accent-fg)]/85"
                  : "mt-1 text-sm leading-snug text-muted-foreground"
              }
            >
              {headerStatus({
                profile,
                tableFromQuery,
              })}
            </p>
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col px-4">
        {menu.status === "ok" ? (
          <MenuView
            products={menu.products}
            tenantSlug={tenant}
            tableFromQuery={tableFromQuery}
            orderingEnabled={profile?.orderingEnabled !== false}
            modules={{
              hasDelivery: profile?.hasDelivery ?? false,
              hasPickup: profile?.hasPickup ?? true,
            }}
          />
        ) : (
          <MenuUnavailableState
            title="Menú no disponible"
            description={
              menu.status === "empty"
                ? "Este restaurante aún no tiene platillos publicados. Vuelve pronto."
                : menu.message
            }
          />
        )}
      </div>
    </main>
  );
}

function brandFromProfile(profile: RestaurantProfile | null): {
  accent: string | null;
  style: CSSProperties;
} {
  const primary = profile?.primaryColor?.trim() ?? "";
  const secondary = profile?.secondaryColor?.trim() ?? "";
  const accent = HEX.test(primary) ? primary : null;
  const soft = HEX.test(secondary) ? secondary : accent;

  if (!accent) {
    return {
      accent: null,
      style: {
        ["--menu-accent" as string]: "var(--foreground)",
        ["--menu-accent-fg" as string]: "var(--background)",
        ["--menu-accent-muted" as string]:
          "color-mix(in srgb, var(--foreground) 12%, transparent)",
        ["--menu-accent-soft" as string]: "var(--muted)",
      },
    };
  }

  return {
    accent,
    style: {
      ["--menu-accent" as string]: accent,
      ["--menu-accent-fg" as string]: accentForeground(accent),
      ["--menu-accent-muted" as string]:
        `color-mix(in srgb, ${accent} 14%, transparent)`,
      ["--menu-accent-soft" as string]: soft ?? accent,
    },
  };
}

/** Blanco u oscuro según luminancia relativa del accent (WCAG-ish). */
function accentForeground(hex: string): string {
  const raw = hex.replace("#", "");
  const r = Number.parseInt(raw.slice(0, 2), 16) / 255;
  const g = Number.parseInt(raw.slice(2, 4), 16) / 255;
  const b = Number.parseInt(raw.slice(4, 6), 16) / 255;
  const toLinear = (c: number) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  const L =
    0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  return L > 0.45 ? "#171717" : "#ffffff";
}

function headerStatus({
  profile,
  tableFromQuery,
}: {
  profile: RestaurantProfile | null;
  tableFromQuery: string | null;
}): string {
  if (profile?.orderingEnabled === false) {
    return "Solo consulta · pedidos desactivados";
  }

  const table = normalizeTableParam(tableFromQuery);
  if (table) {
    return `Pidiendo en ${formatTableLabel(table)}`;
  }

  const hasPickup = profile?.hasPickup ?? true;
  const hasDelivery = profile?.hasDelivery ?? false;
  if (hasPickup && hasDelivery) return "Pedido para llevar o delivery";
  if (hasDelivery) return "Pedido a domicilio";
  if (hasPickup) return "Pedido para llevar";
  return "Arma tu pedido";
}

function MenuUnavailableState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section
      aria-live="polite"
      className="my-10 flex flex-col items-center gap-3 px-2 py-12 text-center"
    >
      <div
        aria-hidden
        className="flex size-14 items-center justify-center rounded-2xl bg-secondary text-muted-foreground"
      >
        <ClipboardList className="size-7 stroke-[1.5]" />
      </div>
      <h2 className="text-lg font-bold tracking-tight">{title}</h2>
      <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
    </section>
  );
}
