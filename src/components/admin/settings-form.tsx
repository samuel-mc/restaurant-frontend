"use client";

/**
 * Formulario de configuración de identidad, info comercial y módulos SaaS.
 */

import Link from "next/link";
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
import { ApiError } from "@/services/apiClient";

interface SettingsFormProps {
  tenantSlug: string;
  restaurantName: string;
  initialProfile: RestaurantProfile;
}

const HEX_PATTERN = /^#[0-9A-Fa-f]{6}$/;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

type FieldErrors = Partial<
  Record<keyof RestaurantProfileFormPayload | "form", string>
>;

function revokeIfBlob(url: string | null) {
  if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
}

export function SettingsForm({
  tenantSlug,
  restaurantName,
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
  const [hasDelivery, setHasDelivery] = useState(initialProfile.hasDelivery);
  const [hasPickup, setHasPickup] = useState(initialProfile.hasPickup);
  const [hasReservations, setHasReservations] = useState(
    initialProfile.hasReservations,
  );

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(
    initialProfile.logoUrl,
  );
  const [bannerPreview, setBannerPreview] = useState<string | null>(
    initialProfile.bannerUrl,
  );

  const [submitting, setSubmitting] = useState(false);
  const [savedBanner, setSavedBanner] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [profile, setProfile] = useState(initialProfile);

  function handleImageChange(
    kind: "logo" | "banner",
    fileList: FileList | null,
  ) {
    const file = fileList?.[0] ?? null;
    setErrors((prev) => {
      const next = { ...prev };
      delete next[kind === "logo" ? "logoFile" : "bannerFile"];
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
      } else {
        setBannerFile(null);
        setBannerPreview((prev) => {
          revokeIfBlob(prev);
          return profile.bannerUrl;
        });
      }
      return;
    }

    if (!ACCEPTED_TYPES.has(file.type)) {
      setErrors((prev) => ({
        ...prev,
        [kind === "logo" ? "logoFile" : "bannerFile"]:
          "Usa JPG, PNG, WEBP o GIF.",
      }));
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setErrors((prev) => ({
        ...prev,
        [kind === "logo" ? "logoFile" : "bannerFile"]:
          "La imagen no puede superar 5 MB.",
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
    } else {
      setBannerFile(file);
      setBannerPreview((prev) => {
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
    if (maps) {
      try {
        void new URL(maps);
      } catch {
        nextErrors.googleMapsUrl = "URL de Google Maps inválida.";
      }
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return null;

    return {
      name: trimmedName,
      description: description.trim(),
      primaryColor: primaryColor.trim().toUpperCase(),
      secondaryColor: secondaryColor.trim().toUpperCase(),
      address: address.trim(),
      googleMapsUrl: maps,
      whatsapp: whatsapp.trim(),
      businessHours: businessHours.trim(),
      hasDelivery,
      hasPickup,
      hasReservations,
      logoFile,
      bannerFile,
    };
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
      setLogoFile(null);
      setBannerFile(null);
      setLogoPreview(updated.logoUrl);
      setBannerPreview(updated.bannerUrl);
      setSavedBanner("Configuración de tu marca guardada.");
      window.setTimeout(() => {
        setSavedBanner((current) =>
          current === "Configuración de tu marca guardada." ? null : current,
        );
      }, 3200);
    } catch (error) {
      setErrors({
        form:
          error instanceof ApiError
            ? error.message
            : "No se pudo guardar la configuración.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-neutral-100 dark:bg-neutral-950">
      <header className="sticky top-0 z-20 border-b border-black/5 bg-white/95 px-4 py-4 backdrop-blur md:px-6 dark:border-white/10 dark:bg-neutral-900/95">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-black/45 dark:text-white/45">
              Configuración · Identidad
            </p>
            <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">
              {restaurantName}
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/dashboard"
              className="rounded-full bg-black/5 px-3 py-1.5 text-sm font-bold hover:bg-black/10 dark:bg-white/10"
            >
              Cocina
            </Link>
            <Link
              href="/admin/dashboard/menu"
              className="rounded-full bg-black/5 px-3 py-1.5 text-sm font-bold hover:bg-black/10 dark:bg-white/10"
            >
              Menú
            </Link>
          </div>
        </div>
        {savedBanner ? (
          <p
            role="status"
            className="mx-auto mt-3 max-w-3xl rounded-xl bg-emerald-500/15 px-4 py-2 text-center text-sm font-bold text-emerald-800 dark:text-emerald-200"
          >
            {savedBanner}
          </p>
        ) : null}
      </header>

      <form
        onSubmit={handleSubmit}
        encType="multipart/form-data"
        className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 md:p-6"
        noValidate
      >
        <Section
          title="Identidad visual"
          description="Logo, banner y colores de tu marca."
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
          description="Datos que verán tus comensales en el sitio y el menú."
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

          <Field label="Dirección" htmlFor="address" className="mt-4">
            <input
              id="address"
              value={address}
              disabled={submitting}
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
              disabled={submitting}
              onChange={(e) => setGoogleMapsUrl(e.target.value)}
              className={inputClass(Boolean(errors.googleMapsUrl))}
              placeholder="https://maps.google.com/…"
            />
          </Field>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="WhatsApp de atención" htmlFor="whatsapp">
              <input
                id="whatsapp"
                value={whatsapp}
                disabled={submitting}
                onChange={(e) => setWhatsapp(e.target.value)}
                className={inputClass(false)}
                placeholder="5215512345678"
              />
            </Field>
            <Field label="Horarios" htmlFor="hours">
              <input
                id="hours"
                value={businessHours}
                disabled={submitting}
                onChange={(e) => setBusinessHours(e.target.value)}
                className={inputClass(false)}
                placeholder="Lun–Dom 12:00–22:00"
              />
            </Field>
          </div>
        </Section>

        <Section
          title="Módulos del SaaS"
          description="Activa solo los canales que ofreces hoy."
        >
          <div className="flex flex-col gap-3">
            <ModuleSwitch
              label="Delivery"
              description="Pedidos a domicilio"
              checked={hasDelivery}
              disabled={submitting}
              onChange={setHasDelivery}
            />
            <ModuleSwitch
              label="Pickup"
              description="Para llevar / recoger en local"
              checked={hasPickup}
              disabled={submitting}
              onChange={setHasPickup}
            />
            <ModuleSwitch
              label="Reservaciones"
              description="Solicitudes de mesa"
              checked={hasReservations}
              disabled={submitting}
              onChange={setHasReservations}
            />
          </div>
        </Section>

        {errors.form ? (
          <p
            role="alert"
            className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-700 dark:text-red-300"
          >
            {errors.form}
          </p>
        ) : null}

        <div className="sticky bottom-4 z-10">
          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center rounded-2xl bg-foreground px-5 py-3.5 text-sm font-extrabold text-background shadow-lg disabled:opacity-60"
          >
            {submitting
              ? "Guardando configuración de tu marca…"
              : "Guardar cambios"}
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
    <section className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-neutral-900 md:p-6">
      <header className="mb-5">
        <h2 className="text-lg font-extrabold tracking-tight">{title}</h2>
        <p className="mt-1 text-sm text-black/50 dark:text-white/50">
          {description}
        </p>
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
      <span className="text-xs font-bold uppercase tracking-wide text-black/50 dark:text-white/50">
        {label}
      </span>
      {children}
      {error ? (
        <span className="text-xs font-medium text-red-600 dark:text-red-400">
          {error}
        </span>
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
      <span className="text-xs font-bold uppercase tracking-wide text-black/50 dark:text-white/50">
        {label}
      </span>
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={HEX_PATTERN.test(value) ? value : "#171717"}
          disabled={disabled}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            onChange(e.target.value.toUpperCase())
          }
          className="size-11 cursor-pointer rounded-xl border border-black/10 bg-transparent p-1 dark:border-white/15"
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
        />
      </div>
      {error ? (
        <span className="text-xs font-medium text-red-600 dark:text-red-400">
          {error}
        </span>
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
  onChange,
}: {
  label: string;
  previewUrl: string | null;
  error?: string;
  disabled?: boolean;
  aspect: "square" | "wide";
  onChange: (files: FileList | null) => void;
}) {
  const inputId = useId();
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-bold uppercase tracking-wide text-black/50 dark:text-white/50">
        {label}
      </span>
      <div
        className={`overflow-hidden rounded-2xl border border-dashed border-black/15 bg-neutral-50 dark:border-white/15 dark:bg-neutral-800/50 ${
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
          <div className="flex size-full items-center justify-center px-3 text-center text-xs font-semibold text-black/35 dark:text-white/35">
            Sin imagen
          </div>
        )}
      </div>
      <label
        htmlFor={inputId}
        className={`inline-flex cursor-pointer items-center justify-center rounded-2xl border border-black/10 bg-white px-3 py-2 text-xs font-bold hover:bg-black/[0.03] dark:border-white/15 dark:bg-neutral-900 dark:hover:bg-white/5 ${
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
        <span className="text-xs font-medium text-red-600 dark:text-red-400">
          {error}
        </span>
      ) : (
        <span className="text-[11px] text-black/40 dark:text-white/40">
          JPG, PNG, WEBP o GIF · máx. 5 MB
        </span>
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
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-black/5 bg-neutral-50 px-4 py-3 dark:border-white/10 dark:bg-neutral-800/40">
      <div className="min-w-0">
        <p className="font-bold">{label}</p>
        <p className="text-sm text-black/50 dark:text-white/50">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground disabled:opacity-50 ${
          checked ? "bg-emerald-500" : "bg-neutral-300 dark:bg-neutral-600"
        }`}
      >
        <span
          aria-hidden
          className={`inline-block size-6 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-7" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}

function inputClass(hasError: boolean): string {
  return `w-full rounded-2xl border bg-neutral-50 px-3.5 py-2.5 text-sm outline-none transition focus:border-foreground focus:ring-2 focus:ring-foreground/10 dark:bg-neutral-800 ${
    hasError ? "border-red-400" : "border-black/10 dark:border-white/15"
  }`;
}
