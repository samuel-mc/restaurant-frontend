"use client";

/**
 * Formulario de configuración de identidad, info comercial y módulos SaaS.
 */

import {
  useId,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import type { RestaurantProfile } from "@/types/api";
import {
  updateRestaurantProfile,
  type RestaurantProfileFormPayload,
} from "@/services/adminRestaurantService";
import { getAdminErrorMessage } from "@/lib/admin-error";
import { redeemCoupon } from "@/services/adminBillingService";
import {
  canPublishWebsite,
  canUseProServiceModules,
  isPeriodExpired,
  isProPlan,
  paymentStatusLabel,
  planLabel,
} from "@/lib/subscription-plan";
import { isAllowedGoogleMapsUrl } from "@/lib/contact-links";
import { hasTenantLanding } from "@/lib/tenant-landings";
import { ThemeToggle } from "@/components/theme-toggle";

interface SettingsFormProps {
  tenantSlug: string;
  restaurantName: string;
  initialProfile: RestaurantProfile;
}

const HEX_PATTERN = /^#[0-9A-Fa-f]{6}$/;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ACCEPTED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card";

type FieldErrors = Partial<
  Record<keyof RestaurantProfileFormPayload | "form", string>
>;

function revokeIfBlob(url: string | null) {
  if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
}

export function SettingsForm({
  tenantSlug,
  initialProfile,
}: SettingsFormProps) {
  const [name, setName] = useState(initialProfile.name);
  const [description, setDescription] = useState(
    initialProfile.description ?? "",
  );
  const [primaryColor, setPrimaryColor] = useState(initialProfile.primaryColor);
  const [secondaryColor, setSecondaryColor] = useState(
    initialProfile.secondaryColor,
  );
  const [address, setAddress] = useState(initialProfile.address ?? "");
  const [googleMapsUrl, setGoogleMapsUrl] = useState(
    initialProfile.googleMapsUrl ?? "",
  );
  const [whatsapp, setWhatsapp] = useState(initialProfile.whatsapp ?? "");
  const [businessHours, setBusinessHours] = useState(
    initialProfile.businessHours ?? "",
  );
  const [hasDelivery, setHasDelivery] = useState(
    canUseProServiceModules(
      initialProfile.plan,
      initialProfile.paymentStatus,
      initialProfile.currentPeriodEnd,
    )
      ? initialProfile.hasDelivery
      : false,
  );
  const [hasPickup, setHasPickup] = useState(
    canUseProServiceModules(
      initialProfile.plan,
      initialProfile.paymentStatus,
      initialProfile.currentPeriodEnd,
    )
      ? initialProfile.hasPickup
      : false,
  );
  const [hasReservations, setHasReservations] = useState(
    canUseProServiceModules(
      initialProfile.plan,
      initialProfile.paymentStatus,
      initialProfile.currentPeriodEnd,
    )
      ? initialProfile.hasReservations
      : false,
  );
  const [orderingEnabled, setOrderingEnabled] = useState(
    canUseProServiceModules(
      initialProfile.plan,
      initialProfile.paymentStatus,
      initialProfile.currentPeriodEnd,
    )
      ? initialProfile.orderingEnabled
      : false,
  );
  const [tableCount, setTableCount] = useState(
    String(initialProfile.tableCount ?? 12),
  );
  const [websitePublished, setWebsitePublished] = useState(
    initialProfile.websitePublished,
  );

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(
    initialProfile.logoUrl,
  );
  const [bannerPreview, setBannerPreview] = useState<string | null>(
    initialProfile.bannerUrl,
  );
  const [faviconPreview, setFaviconPreview] = useState<string | null>(
    initialProfile.faviconUrl,
  );

  const [submitting, setSubmitting] = useState(false);
  const [savedBanner, setSavedBanner] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [profile, setProfile] = useState(initialProfile);
  const [couponCode, setCouponCode] = useState("");
  const [couponBusy, setCouponBusy] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const landingDelivered = hasTenantLanding(tenantSlug);
  const proServiceModulesAllowed = canUseProServiceModules(
    profile.plan,
    profile.paymentStatus,
    profile.currentPeriodEnd,
  );
  const websiteFieldsEditable = canPublishWebsite(
    profile.plan,
    profile.paymentStatus,
    profile.currentPeriodEnd,
  );

  function handleImageChange(
    kind: "logo" | "banner" | "favicon",
    fileList: FileList | null,
  ) {
    const file = fileList?.[0] ?? null;
    const fileKey =
      kind === "logo"
        ? "logoFile"
        : kind === "banner"
          ? "bannerFile"
          : "faviconFile";
    setErrors((prev) => {
      const next = { ...prev };
      delete next[fileKey];
      delete next.form;
      return next;
    });

    if (!file) {
      if (kind === "logo") {
        setLogoFile(null);
        setLogoPreview((prev) => {
          revokeIfBlob(prev);
          return profile.logoUrl;
        });
      } else if (kind === "banner") {
        setBannerFile(null);
        setBannerPreview((prev) => {
          revokeIfBlob(prev);
          return profile.bannerUrl;
        });
      } else {
        setFaviconFile(null);
        setFaviconPreview((prev) => {
          revokeIfBlob(prev);
          return profile.faviconUrl;
        });
      }
      return;
    }

    if (!ACCEPTED_TYPES.has(file.type)) {
      setErrors((prev) => ({
        ...prev,
        [fileKey]: "Usa JPG, PNG, WEBP o GIF.",
      }));
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setErrors((prev) => ({
        ...prev,
        [fileKey]: "La imagen no puede superar 4 MB.",
      }));
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    if (kind === "logo") {
      setLogoFile(file);
      setLogoPreview((prev) => {
        revokeIfBlob(prev);
        return objectUrl;
      });
    } else if (kind === "banner") {
      setBannerFile(file);
      setBannerPreview((prev) => {
        revokeIfBlob(prev);
        return objectUrl;
      });
    } else {
      setFaviconFile(file);
      setFaviconPreview((prev) => {
        revokeIfBlob(prev);
        return objectUrl;
      });
    }
  }

  function validate(): RestaurantProfileFormPayload | null {
    const nextErrors: FieldErrors = {};
    const trimmedName = name.trim();
    if (!trimmedName) nextErrors.name = "El nombre comercial es obligatorio.";
    else if (trimmedName.length > 100) nextErrors.name = "Máximo 100 caracteres.";

    if (!HEX_PATTERN.test(primaryColor.trim())) {
      nextErrors.primaryColor = "Usa un HEX válido (#RRGGBB).";
    }
    if (!HEX_PATTERN.test(secondaryColor.trim())) {
      nextErrors.secondaryColor = "Usa un HEX válido (#RRGGBB).";
    }

    const maps = googleMapsUrl.trim();
    if (maps && !isAllowedGoogleMapsUrl(maps)) {
      nextErrors.googleMapsUrl =
        "Usa un link de Google Maps (maps.google.com, maps.app.goo.gl…).";
    }

    const parsedTableCount = Number.parseInt(tableCount.trim(), 10);
    const tableCountValid =
      Number.isFinite(parsedTableCount) &&
      parsedTableCount >= 1 &&
      parsedTableCount <= 99;
    if (orderingEnabled && !tableCountValid) {
      nextErrors.tableCount = "Indica un total de mesas entre 1 y 99.";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return null;

    const resolvedTableCount = tableCountValid
      ? parsedTableCount
      : Math.min(99, Math.max(1, profile.tableCount ?? 12));

    return {
      name: trimmedName,
      description: description.trim(),
      primaryColor: primaryColor.trim().toUpperCase(),
      secondaryColor: secondaryColor.trim().toUpperCase(),
      address: address.trim(),
      googleMapsUrl: maps,
      whatsapp: whatsapp.trim(),
      businessHours: businessHours.trim(),
      hasDelivery: proServiceModulesAllowed ? hasDelivery : false,
      hasPickup: proServiceModulesAllowed ? hasPickup : false,
      hasReservations: proServiceModulesAllowed ? hasReservations : false,
      orderingEnabled: proServiceModulesAllowed ? orderingEnabled : false,
      tableCount: resolvedTableCount,
      websitePublished,
      logoFile,
      bannerFile,
      faviconFile,
    };
  }

  async function handleRedeemCoupon() {
    const code = couponCode.trim();
    if (!code || couponBusy) return;
    setCouponBusy(true);
    setCouponError(null);
    try {
      const result = await redeemCoupon(code, tenantSlug);
      setProfile((prev) => ({
        ...prev,
        plan: result.plan,
        paymentStatus: result.paymentStatus,
        websitePublished: result.websitePublished,
        currentPeriodEnd: result.currentPeriodEnd ?? prev.currentPeriodEnd ?? null,
      }));
      setWebsitePublished(result.websitePublished);
      setCouponCode("");
      setSavedBanner(result.message);
      window.setTimeout(() => {
        setSavedBanner((current) =>
          current === result.message ? null : current,
        );
      }, 4000);
    } catch (error) {
      setCouponError(
        getAdminErrorMessage(error, "No se pudo canjear el cupón."),
      );
    } finally {
      setCouponBusy(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const payload = validate();
    if (!payload) return;

    setSubmitting(true);
    setSavedBanner(null);
    setErrors({});

    try {
      const updated = await updateRestaurantProfile(payload, tenantSlug);
      setProfile(updated);
      setName(updated.name);
      setDescription(updated.description ?? "");
      setPrimaryColor(updated.primaryColor);
      setSecondaryColor(updated.secondaryColor);
      setAddress(updated.address ?? "");
      setGoogleMapsUrl(updated.googleMapsUrl ?? "");
      setWhatsapp(updated.whatsapp ?? "");
      setBusinessHours(updated.businessHours ?? "");
      setHasDelivery(updated.hasDelivery);
      setHasPickup(updated.hasPickup);
      setHasReservations(updated.hasReservations);
      setOrderingEnabled(updated.orderingEnabled);
      setTableCount(String(updated.tableCount));
      setWebsitePublished(updated.websitePublished);
      setProfile(updated);
      setLogoFile(null);
      setBannerFile(null);
      setFaviconFile(null);
      setLogoPreview(updated.logoUrl);
      setBannerPreview(updated.bannerUrl);
      setFaviconPreview(updated.faviconUrl);
      setSavedBanner("Configuración de tu marca guardada.");
      window.setTimeout(() => {
        setSavedBanner((current) =>
          current === "Configuración de tu marca guardada." ? null : current,
        );
      }, 3200);
    } catch (error) {
      setErrors({
        form: getAdminErrorMessage(
          error,
          "No se pudo guardar la configuración.",
        ),
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex flex-col pb-8 font-jakarta-sans">
      {savedBanner ? (
        <div
          role="status"
          aria-live="polite"
          data-testid="settings-coupon-success"
          className="pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-center px-4 md:top-5"
        >
          <p className="pointer-events-auto max-w-lg rounded-xl border border-live/25 bg-card px-4 py-3 text-center text-sm font-semibold text-live-ink shadow-[0_12px_32px_rgba(0,0,0,0.18)]">
            {savedBanner}
          </p>
        </div>
      ) : null}

      <header className="border-b border-border px-4 py-5 md:px-6">
        <div className="mx-auto w-full max-w-3xl">
          <h1 className="text-2xl font-bold tracking-tight">Configuración</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Apariencia del panel, marca, horarios, plan y módulos.
          </p>
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl px-4 pt-4 md:px-6 md:pt-6">
        <Section
          title="Apariencia"
          description="Tema del panel en este dispositivo. No afecta el menú del comensal ni la marca del restaurante."
        >
          <ThemeToggle className="max-w-sm" />
        </Section>
      </div>

      <form
        onSubmit={handleSubmit}
        encType="multipart/form-data"
        className="mx-auto flex w-full max-w-3xl flex-col gap-5 p-4 md:gap-6 md:p-6"
        noValidate
      >
        <Section
          title="Identidad visual"
          description="Logo, banner, favicon y colores de tu marca."
        >
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <ImagePicker
              label="Logo"
              previewUrl={logoPreview}
              error={errors.logoFile}
              disabled={submitting}
              aspect="square"
              onChange={(files) => handleImageChange("logo", files)}
            />
            <ImagePicker
              label="Banner"
              previewUrl={bannerPreview}
              error={errors.bannerFile}
              disabled={submitting}
              aspect="wide"
              onChange={(files) => handleImageChange("banner", files)}
            />
            <ImagePicker
              label="Favicon"
              previewUrl={faviconPreview}
              error={errors.faviconFile}
              disabled={submitting}
              aspect="square"
              hint="Cuadrado · PNG recomendado · máx. 4 MB. Aparece en la pestaña del navegador."
              onChange={(files) => handleImageChange("favicon", files)}
            />
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ColorField
              label="Color primario"
              value={primaryColor}
              error={errors.primaryColor}
              disabled={submitting}
              onChange={setPrimaryColor}
            />
            <ColorField
              label="Color secundario"
              value={secondaryColor}
              error={errors.secondaryColor}
              disabled={submitting}
              onChange={setSecondaryColor}
            />
          </div>
        </Section>

        <Section
          title="Información comercial"
          description="Datos de contacto y presentación usados en el menú, seguimiento de pedidos y ayuda al personal."
        >
          <Field label="Nombre comercial" error={errors.name} htmlFor="name">
            <input
              id="name"
              value={name}
              maxLength={100}
              disabled={submitting}
              onChange={(e) => setName(e.target.value)}
              className={inputClass(Boolean(errors.name))}
            />
          </Field>

          <Field
            label="Historia / descripción"
            htmlFor="description"
            className="mt-4"
          >
            <textarea
              id="description"
              value={description}
              rows={4}
              disabled={submitting}
              onChange={(e) => setDescription(e.target.value)}
              className={`${inputClass(false)} resize-none`}
              placeholder="Cuenta la historia de tu restaurante…"
            />
          </Field>

          <Field
            label="WhatsApp de atención"
            htmlFor="whatsapp"
            className="mt-4"
          >
            <input
              id="whatsapp"
              value={whatsapp}
              disabled={submitting}
              onChange={(e) => setWhatsapp(e.target.value)}
              className={inputClass(false)}
              placeholder="5215512345678"
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              Se muestra en el menú, el tracking del pedido y los logins de
              ayuda.
            </p>
          </Field>
        </Section>

        <Section
          title="Sitio web (Pro)"
          description={
            websiteFieldsEditable
              ? "Estos datos aparecen en tu landing institucional cuando el sitio está publicado."
              : "Principalmente para la landing Pro. Se editan con Plan Pro y pago activo."
          }
        >
          {!websiteFieldsEditable ? (
            <p className="mb-4 rounded-xl border border-border bg-secondary/50 px-4 py-3 text-sm text-muted-foreground">
              Dirección, mapa y horarios alimentan el{" "}
              <span className="font-semibold text-foreground">sitio web</span>.
              Actualiza a Plan Pro con pago activo para editarlos.
            </p>
          ) : null}

          <Field label="Dirección" htmlFor="address">
            <input
              id="address"
              value={address}
              disabled={submitting || !websiteFieldsEditable}
              onChange={(e) => setAddress(e.target.value)}
              className={inputClass(false)}
              placeholder="Calle, colonia, ciudad"
            />
          </Field>

          <Field
            label="Link de Google Maps"
            error={errors.googleMapsUrl}
            htmlFor="maps"
            className="mt-4"
          >
            <input
              id="maps"
              value={googleMapsUrl}
              disabled={submitting || !websiteFieldsEditable}
              onChange={(e) => setGoogleMapsUrl(e.target.value)}
              className={inputClass(Boolean(errors.googleMapsUrl))}
              placeholder="https://maps.google.com/…"
            />
          </Field>

          <Field label="Horarios" htmlFor="hours" className="mt-4">
            <input
              id="hours"
              value={businessHours}
              disabled={submitting || !websiteFieldsEditable}
              onChange={(e) => setBusinessHours(e.target.value)}
              className={inputClass(false)}
              placeholder="Lun–Dom 12:00–22:00"
            />
          </Field>
        </Section>

        <Section
          title="Plan y website"
          description="Tu plan, pago y sitio institucional a medida."
        >
          <div className="mb-4 rounded-xl border border-border bg-secondary/60 px-4 py-3">
            <p className="text-xs font-semibold text-muted-foreground">
              Plan actual
            </p>
            <p className="mt-1 text-base font-bold tracking-tight">
              {planLabel(profile.plan)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Estado de pago:{" "}
              <span className="font-semibold text-foreground">
                {paymentStatusLabel(profile.paymentStatus)}
              </span>
            </p>
            {profile.currentPeriodEnd ? (
              <p className="mt-1 text-sm text-muted-foreground">
                Renovación:{" "}
                <span className="font-semibold text-foreground">
                  {new Date(profile.currentPeriodEnd).toLocaleString("es-MX", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
              </p>
            ) : null}
            <p className="mt-1 text-sm text-muted-foreground">
              Landing custom:{" "}
              <span className="font-semibold text-foreground">
                {landingDelivered ? "Entregada" : "En preparación / no asignada"}
              </span>
            </p>
            {profile.paymentStatus === "PENDING_PAYMENT" ? (
              <p className="mt-2 text-sm text-warn-ink">
                Early access: coordina el pago (efectivo o transferencia) y
                canjea el cupón que te entreguen para activar Pro.
              </p>
            ) : !isProPlan(profile.plan) ? (
              <p className="mt-1 text-sm text-muted-foreground">
                El sitio a medida y el menú ilimitado están en el Plan Pro (+
                setup de instalación).
              </p>
            ) : landingDelivered ? (
              <p className="mt-1 text-sm text-muted-foreground">
                Tu landing personalizada ya está en el deploy. Al publicar,
                será visible en tu subdominio.
              </p>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">
                Pro activo: el menú digital ya opera. La landing a medida la
                entrega el equipo PlatoListo tras el setup; mientras, los
                visitantes verán “sitio en preparación”.
              </p>
            )}
          </div>

          <div className="mb-5 rounded-xl border border-border bg-background p-4">
            <p className="text-sm font-semibold tracking-tight">Canjear cupón</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Tras pagar en efectivo o transferencia, ingresa el código que te
              compartimos.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                data-testid="settings-coupon-input"
                value={couponCode}
                disabled={couponBusy || submitting}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                className={inputClass(Boolean(couponError))}
                placeholder="PRO-DEMO-2026"
                maxLength={40}
                autoComplete="off"
                spellCheck={false}
                aria-label="Código de cupón"
              />
              <button
                type="button"
                data-testid="settings-coupon-redeem"
                disabled={couponBusy || submitting || !couponCode.trim()}
                onClick={() => void handleRedeemCoupon()}
                className={`inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50 ${focusRing}`}
              >
                {couponBusy ? "Canjeando…" : "Canjear"}
              </button>
            </div>
            {couponError ? (
              <p
                role="alert"
                className="mt-2 text-xs font-medium text-destructive"
              >
                {couponError}
              </p>
            ) : null}
          </div>

          <ModuleSwitch
            label="Publicar sitio web"
            description={
              !canPublishWebsite(
                profile.plan,
                profile.paymentStatus,
                profile.currentPeriodEnd,
              )
                ? profile.paymentStatus === "PENDING_PAYMENT"
                  ? "Disponible cuando el pago Pro esté activo (cupón)."
                  : isPeriodExpired(profile.currentPeriodEnd)
                    ? "Tu período Pro venció. Renueva o canjea un cupón para publicar."
                  : "Disponible solo en Plan Pro con pago activo."
                : !landingDelivered
                  ? "Activado: los visitantes verán “en preparación” hasta que entreguemos tu landing."
                  : websitePublished
                    ? "Visible en la raíz de tu subdominio (además del menú digital)."
                    : "Desactivado: los visitantes verán un aviso y podrán ir al menú."
            }
            checked={websitePublished}
            disabled={
              submitting ||
              !canPublishWebsite(
                profile.plan,
                profile.paymentStatus,
                profile.currentPeriodEnd,
              )
            }
            onChange={setWebsitePublished}
          />
        </Section>

        <Section
          title="Módulos del SaaS"
          description="Activa solo los canales que ofreces hoy."
        >
          <div className="flex flex-col gap-3">
            <ModuleSwitch
              label="Ordenar desde el menú digital"
              description={
                !proServiceModulesAllowed
                  ? profile.paymentStatus === "PENDING_PAYMENT"
                    ? "Disponible cuando el pago Pro esté activo (cupón)."
                    : isPeriodExpired(profile.currentPeriodEnd)
                      ? "Tu período Pro venció. Renueva o canjea un cupón para aceptar pedidos."
                      : "Disponible solo en Plan Pro con pago activo."
                  : orderingEnabled
                    ? "Los comensales pueden armar pedidos desde /menu."
                    : "Menú en modo consulta: se ve el catálogo sin carrito ni checkout."
              }
              checked={proServiceModulesAllowed && orderingEnabled}
              disabled={submitting || !proServiceModulesAllowed}
              onChange={(next) => {
                setOrderingEnabled(next);
                if (!next) {
                  setErrors((prev) => {
                    if (!prev.tableCount) return prev;
                    const { tableCount: _removed, ...rest } = prev;
                    return rest;
                  });
                }
              }}
            />
            {proServiceModulesAllowed && orderingEnabled ? (
              <label className="flex flex-col gap-1.5 rounded-2xl border border-border bg-card px-4 py-3">
                <span className="text-sm font-semibold">Total de mesas</span>
                <span className="text-xs text-muted-foreground">
                  Define el piso del mesero (mesas libres 1…N), el rango al unir
                  mesas y el tope al generar QR. Entre 1 y 99.
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={99}
                  step={1}
                  value={tableCount}
                  disabled={submitting}
                  onChange={(e) => {
                    setTableCount(
                      e.target.value.replace(/[^\d]/g, "").slice(0, 2),
                    );
                  }}
                  className={`${focusRing} mt-1 min-h-11 w-full max-w-[8rem] rounded-xl border border-border bg-background px-3 text-base font-semibold tabular-nums`}
                />
                {errors.tableCount ? (
                  <p
                    role="alert"
                    className="text-xs font-medium text-destructive"
                  >
                    {errors.tableCount}
                  </p>
                ) : null}
              </label>
            ) : null}
            <ModuleSwitch
              label="A domicilio"
              description={
                proServiceModulesAllowed
                  ? "Pedidos con entrega a domicilio"
                  : "Disponible solo en Plan Pro con pago activo."
              }
              checked={proServiceModulesAllowed && hasDelivery}
              disabled={
                submitting || !orderingEnabled || !proServiceModulesAllowed
              }
              onChange={setHasDelivery}
            />
            <ModuleSwitch
              label="Para llevar"
              description={
                proServiceModulesAllowed
                  ? "Pedidos para recoger en el local"
                  : "Disponible solo en Plan Pro con pago activo."
              }
              checked={proServiceModulesAllowed && hasPickup}
              disabled={
                submitting || !orderingEnabled || !proServiceModulesAllowed
              }
              onChange={setHasPickup}
            />
            <ModuleSwitch
              label="Reservaciones"
              description={
                proServiceModulesAllowed
                  ? "Solicitudes de mesa"
                  : "Disponible solo en Plan Pro con pago activo."
              }
              checked={proServiceModulesAllowed && hasReservations}
              disabled={submitting || !proServiceModulesAllowed}
              onChange={setHasReservations}
            />
          </div>
        </Section>

        {errors.form ? (
          <p
            role="alert"
            className="rounded-xl bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive"
          >
            {errors.form}
          </p>
        ) : null}

        <div className="sticky bottom-4 z-10">
          <button
            type="submit"
            disabled={submitting}
            className={`flex min-h-12 w-full items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-[0_10px_28px_rgba(0,0,0,0.18)] disabled:opacity-60 ${focusRing}`}
          >
            {submitting ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 md:p-6">
      <header className="mb-5">
        <h2 className="text-lg font-bold tracking-tight">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </header>
      {children}
    </section>
  );
}

function Field({
  label,
  htmlFor,
  error,
  className = "",
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`} htmlFor={htmlFor}>
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
      {error ? (
        <span className="text-xs font-medium text-destructive">{error}</span>
      ) : null}
    </label>
  );
}

function ColorField({
  label,
  value,
  error,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  error?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const textId = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={HEX_PATTERN.test(value) ? value : "#171717"}
          disabled={disabled}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            onChange(e.target.value.toUpperCase())
          }
          className={`size-11 cursor-pointer rounded-xl border border-border bg-transparent p-1 ${focusRing}`}
          aria-label={`${label} picker`}
        />
        <input
          id={textId}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass(Boolean(error))}
          placeholder="#171717"
          maxLength={7}
          aria-label={`${label} HEX`}
        />
      </div>
      {error ? (
        <span className="text-xs font-medium text-destructive">{error}</span>
      ) : null}
    </div>
  );
}

function ImagePicker({
  label,
  previewUrl,
  error,
  disabled,
  aspect,
  hint = "JPG, PNG, WEBP o GIF · máx. 4 MB",
  onChange,
}: {
  label: string;
  previewUrl: string | null;
  error?: string;
  disabled?: boolean;
  aspect: "square" | "wide";
  hint?: string;
  onChange: (files: FileList | null) => void;
}) {
  const inputId = useId();
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <div
        className={`overflow-hidden rounded-xl border border-dashed border-border bg-secondary ${
          aspect === "square" ? "aspect-square" : "aspect-[16/9]"
        }`}
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt={`Vista previa de ${label}`}
            className="size-full object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center px-3 text-center text-xs font-semibold text-muted-foreground">
            Sin imagen
          </div>
        )}
      </div>
      <label
        htmlFor={inputId}
        className={`inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-border bg-card px-3 text-sm font-semibold transition-colors hover:bg-secondary ${focusRing} ${
          disabled ? "pointer-events-none opacity-50" : ""
        }`}
      >
        Seleccionar archivo
      </label>
      <input
        id={inputId}
        type="file"
        accept="image/*"
        className="sr-only"
        disabled={disabled}
        onChange={(e) => onChange(e.target.files)}
      />
      {error ? (
        <span className="text-xs font-medium text-destructive">{error}</span>
      ) : (
        <span className="text-xs text-muted-foreground">{hint}</span>
      )}
    </div>
  );
}

function ModuleSwitch({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-secondary/50 px-4 py-3">
      <div className="min-w-0">
        <p className="font-semibold">{label}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-11 w-16 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${focusRing} ${
          checked ? "bg-live" : "bg-muted-foreground/30"
        }`}
      >
        <span
          aria-hidden
          className={`inline-block size-7 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-8" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}

function inputClass(hasError: boolean): string {
  return `w-full rounded-xl border bg-secondary px-3.5 py-2.5 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:opacity-60 ${
    hasError ? "border-destructive" : "border-border"
  }`;
}
