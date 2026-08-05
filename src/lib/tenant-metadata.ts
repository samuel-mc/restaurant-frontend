import type { Metadata } from "next";
import type { RestaurantProfile } from "@/types/api";

interface TenantPageMetaInput {
  title: string;
  description: string;
  profile?: RestaurantProfile | null;
  /** Imagen OG preferida; si falta se usa banner o logo del perfil. */
  imageUrl?: string | null;
}

/**
 * Metadata pública por tenant con Open Graph / Twitter.
 * Usa identidad de marca del perfil cuando está disponible.
 * Favicon: `faviconUrl` del tenant; si falta, hereda el de PlatoListo (root layout).
 */
export function buildTenantPageMetadata({
  title,
  description,
  profile,
  imageUrl,
}: TenantPageMetaInput): Metadata {
  const ogImage =
    imageUrl?.trim() ||
    profile?.bannerUrl?.trim() ||
    profile?.logoUrl?.trim() ||
    undefined;

  const siteName = profile?.name?.trim() || undefined;
  const favicon = profile?.faviconUrl?.trim() || undefined;

  return {
    title,
    description,
    ...(favicon
      ? {
          icons: {
            icon: [{ url: favicon }],
            apple: [{ url: favicon }],
          },
        }
      : {}),
    openGraph: {
      title,
      description,
      type: "website",
      locale: "es_MX",
      ...(siteName ? { siteName } : {}),
      ...(ogImage
        ? {
            images: [
              {
                url: ogImage,
                alt: siteName ? `${siteName}` : title,
              },
            ],
          }
        : {}),
    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      title,
      description,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  };
}
