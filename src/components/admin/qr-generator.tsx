"use client";

/**
 * Generador de códigos QR (menú general, mesa específica, masivo).
 * Las mesas incluyen token firmado (?t=) desde el backend.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Download, Printer, QrCode } from "lucide-react";
import { toPng } from "html-to-image";
import { QrCard } from "@/components/admin/qr-card";
import { AdminOptionGroup } from "@/components/admin/admin-option-group";
import {
  buildPublicMenuUrl,
  getPublicRootDomain,
  qrDownloadFilename,
  tableDisplayLabel,
  toQrTableParam,
} from "@/lib/qr-menu-url";
import { signTableQrLinks } from "@/services/adminTableQrService";
import { ApiError } from "@/services/apiClient";

type QrMode = "general" | "table" | "bulk";

interface QrTarget {
  id: string;
  headline: string;
  /** Número de mesa para `?m=` / nombre de archivo; null = menú general. */
  tableNumber: string | null;
  menuUrl: string;
}

interface QrGeneratorProps {
  tenantSlug: string;
  restaurantName: string;
  logoUrl?: string | null;
  primaryColor?: string;
}

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card";

const MODE_OPTIONS = [
  { id: "general" as const, label: "Menú general", hint: "Sin mesa fija" },
  {
    id: "table" as const,
    label: "Mesa específica",
    hint: "El comensal abre el menú de esa mesa",
  },
  {
    id: "bulk" as const,
    label: "Generación masiva",
    hint: "Rango de mesas",
  },
];

function slugifyId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "")
    .slice(0, 24);
}

function parseTableNumberInput(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 4);
}

async function downloadNodeAsPng(
  node: HTMLElement,
  filename: string,
): Promise<void> {
  const dataUrl = await toPng(node, {
    cacheBust: true,
    pixelRatio: 3,
    backgroundColor: "#ffffff",
  });
  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  link.click();
}

export function QrGenerator({
  tenantSlug,
  restaurantName,
  logoUrl = null,
  primaryColor = "#171717",
}: QrGeneratorProps) {
  const [mode, setMode] = useState<QrMode>("general");
  const [tableNumber, setTableNumber] = useState("4");
  const [bulkFrom, setBulkFrom] = useState(1);
  const [bulkTo, setBulkTo] = useState(12);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [signing, setSigning] = useState(false);
  const [targets, setTargets] = useState<QrTarget[]>([]);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const printSheetRef = useRef<HTMLDivElement | null>(null);
  const signRequestRef = useRef(0);

  const rootDomain = getPublicRootDomain();

  const bulkTooLarge =
    mode === "bulk" && Math.abs(bulkTo - bulkFrom) + 1 > 48;

  const tableNumbersToSign = useMemo(() => {
    if (mode === "general") return [] as string[];
    if (mode === "table") {
      const n = toQrTableParam(tableNumber);
      return n ? [n] : [];
    }
    if (bulkTooLarge) return [];
    const from = Math.min(bulkFrom, bulkTo);
    const to = Math.max(bulkFrom, bulkTo);
    const list: string[] = [];
    for (let n = from; n <= to; n += 1) list.push(String(n));
    return list;
  }, [mode, tableNumber, bulkFrom, bulkTo, bulkTooLarge]);

  useEffect(() => {
    if (mode === "general") {
      setTargets([
        {
          id: "general",
          headline: "Pide desde tu lugar",
          tableNumber: null,
          menuUrl: buildPublicMenuUrl(tenantSlug),
        },
      ]);
      setSigning(false);
      setError(null);
      return;
    }

    if (tableNumbersToSign.length === 0) {
      setTargets([]);
      setSigning(false);
      return;
    }

    const requestId = ++signRequestRef.current;
    setSigning(true);
    setError(null);

    void (async () => {
      try {
        const links = await signTableQrLinks(tenantSlug, tableNumbersToSign);
        if (requestId !== signRequestRef.current) return;
        const byTable = new Map(
          links.map((l) => [l.tableNumber, l.tableToken] as const),
        );
        setTargets(
          tableNumbersToSign.map((num) => {
            const token = byTable.get(num) ?? "";
            return {
              id: `mesa-${slugifyId(num)}`,
              headline: tableDisplayLabel(num),
              tableNumber: num,
              menuUrl: buildPublicMenuUrl(tenantSlug, {
                tableNumber: num,
                tableToken: token,
              }),
            };
          }),
        );
      } catch (err) {
        if (requestId !== signRequestRef.current) return;
        setTargets([]);
        setError(
          err instanceof ApiError
            ? err.message
            : "No se pudieron firmar los QR. Revisa tu sesión e intenta de nuevo.",
        );
      } finally {
        if (requestId === signRequestRef.current) setSigning(false);
      }
    })();
  }, [mode, tableNumbersToSign, tenantSlug]);

  const preview = targets[0] ?? null;

  const handleDownloadPng = useCallback(async () => {
    if (!preview || !previewRef.current) return;
    setBusy(true);
    setError(null);
    try {
      await downloadNodeAsPng(
        previewRef.current,
        qrDownloadFilename(tenantSlug, preview.tableNumber),
      );
    } catch {
      setError("No se pudo generar el PNG. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }, [preview, tenantSlug]);

  const handlePrint = useCallback(() => {
    if (targets.length === 0) return;
    setError(null);
    window.print();
  }, [targets.length]);

  function onBulkSubmit(event: FormEvent) {
    event.preventDefault();
  }

  return (
    <div className="font-jakarta-sans">
      <header className="border-b border-border px-4 py-5 print:hidden md:px-6">
        <div className="mx-auto w-full max-w-6xl">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <QrCode className="size-6 shrink-0" aria-hidden />
            Códigos QR
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Tarjetas para menú general o mesas. Cada mesa lleva un token de
            acceso en la URL (
            <span className="font-semibold text-foreground">
              {tenantSlug}.{rootDomain}/menu?m=…&amp;t=…
            </span>
            ). Reimprime los QR antiguos.
          </p>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-5 print:hidden md:gap-8 md:px-6 md:py-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-sm font-bold tracking-tight">Tipo de QR</h2>
          <AdminOptionGroup
            aria-label="Tipo de código QR"
            orientation="vertical"
            className="mt-3 flex flex-col gap-2"
          >
            {MODE_OPTIONS.map((item) => {
              const active = mode === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  data-roving-item
                  aria-pressed={active}
                  tabIndex={active ? 0 : -1}
                  onClick={() => setMode(item.id)}
                  className={`min-h-11 rounded-xl px-4 py-3 text-left transition-colors ${focusRing} ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary/70 text-foreground hover:bg-secondary"
                  }`}
                >
                  <span className="block text-sm font-semibold">
                    {item.label}
                  </span>
                  <span
                    className={`mt-0.5 block text-xs font-medium ${
                      active
                        ? "text-primary-foreground/70"
                        : "text-muted-foreground"
                    }`}
                  >
                    {item.hint}
                  </span>
                </button>
              );
            })}
          </AdminOptionGroup>

          {mode === "table" ? (
            <div className="mt-5">
              <span className="text-xs font-semibold text-muted-foreground">
                Número de mesa
              </span>
              <div className="mt-2 flex overflow-hidden rounded-xl border border-border bg-background">
                <span className="flex items-center bg-secondary px-4 text-sm font-semibold text-muted-foreground">
                  Mesa
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={tableNumber}
                  maxLength={4}
                  onChange={(e) =>
                    setTableNumber(parseTableNumberInput(e.target.value))
                  }
                  placeholder="4"
                  aria-label="Número de mesa"
                  className={`min-w-0 flex-1 bg-transparent px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-ring/20 ${focusRing}`}
                />
              </div>
              <span className="mt-2 block truncate text-xs text-muted-foreground">
                URL: {signing ? "Firmando…" : (preview?.menuUrl ?? "—")}
              </span>
            </div>
          ) : null}

          {mode === "bulk" ? (
            <form onSubmit={onBulkSubmit} className="mt-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-semibold text-muted-foreground">
                    Desde mesa
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={999}
                    value={bulkFrom}
                    onChange={(e) =>
                      setBulkFrom(Math.max(1, Number(e.target.value) || 1))
                    }
                    className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm font-semibold outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-muted-foreground">
                    Hasta mesa
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={999}
                    value={bulkTo}
                    onChange={(e) =>
                      setBulkTo(Math.max(1, Number(e.target.value) || 1))
                    }
                    className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm font-semibold outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
                  />
                </label>
              </div>
              <p className="text-xs text-muted-foreground">
                Se generarán {targets.length || 0} tarjetas (máx. 48 por lote).
                {signing ? " Firmando tokens…" : ""}
              </p>
              {bulkTooLarge ? (
                <p className="text-xs font-medium text-destructive" role="alert">
                  Reduce el rango a 48 mesas o menos.
                </p>
              ) : null}
            </form>
          ) : null}

          {mode === "general" && preview ? (
            <p className="mt-5 break-all text-xs text-muted-foreground">
              URL: {preview.menuUrl}
            </p>
          ) : null}

          <div className="mt-6 flex flex-col gap-2">
            <button
              type="button"
              disabled={!preview || busy || signing}
              onClick={() => void handleDownloadPng()}
              className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50 ${focusRing}`}
            >
              <Download className="size-4" aria-hidden />
              {busy ? "Generando…" : "Descargar PNG"}
            </button>
            <button
              type="button"
              disabled={targets.length === 0 || bulkTooLarge || signing}
              onClick={handlePrint}
              className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-live px-4 text-sm font-semibold text-live-foreground hover:brightness-110 disabled:opacity-50 ${focusRing}`}
            >
              <Printer className="size-4" aria-hidden />
              Imprimir / exportar PDF
            </button>
          </div>

          {error ? (
            <p
              role="alert"
              className="mt-3 text-sm font-medium text-destructive"
            >
              {error}
            </p>
          ) : null}
        </section>

        <section>
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold tracking-tight">Vista previa</h2>
              <p className="text-xs text-muted-foreground">
                Tarjeta de mesa · alta resolución
              </p>
            </div>
            {mode === "bulk" ? (
              <p className="text-xs font-semibold text-muted-foreground">
                {targets.length} tarjetas
              </p>
            ) : null}
          </div>

          {signing && !preview ? (
            <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center text-sm text-muted-foreground">
              Firmando códigos de mesa…
            </div>
          ) : preview ? (
            <div className="mx-auto w-full max-w-sm">
              <div className="rounded-2xl bg-secondary p-6">
                <QrCard
                  ref={previewRef}
                  cardId={`qr-preview-${preview.id}`}
                  restaurantName={restaurantName}
                  logoUrl={logoUrl}
                  primaryColor={primaryColor}
                  menuUrl={preview.menuUrl}
                  headline={preview.headline}
                />
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center text-sm text-muted-foreground">
              Ajusta el identificador o el rango para ver la vista previa.
            </div>
          )}

          {mode === "bulk" && targets.length > 1 ? (
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {targets.slice(0, 8).map((t) => (
                <div
                  key={t.id}
                  className="rounded-xl border border-border bg-card p-2"
                >
                  <QrCard
                    cardId={`qr-thumb-${t.id}`}
                    restaurantName={restaurantName}
                    logoUrl={logoUrl}
                    primaryColor={primaryColor}
                    menuUrl={t.menuUrl}
                    headline={t.headline}
                    qrSize={88}
                    className="rounded-xl p-3 shadow-none"
                  />
                </div>
              ))}
            </div>
          ) : null}
          {mode === "bulk" && targets.length > 8 ? (
            <p className="mt-3 text-center text-xs text-muted-foreground">
              +{targets.length - 8} más en la hoja de impresión
            </p>
          ) : null}
        </section>
      </div>

      {/* Hoja de impresión A4 / Carta con guías de corte */}
      <div
        ref={printSheetRef}
        className="qr-print-sheet hidden print:block"
        aria-hidden
      >
        <div className="mb-4 text-center text-xs font-semibold tracking-wide text-neutral-500">
          {restaurantName} · Códigos QR · {targets.length} tarjeta
          {targets.length === 1 ? "" : "s"} · Guías de corte
        </div>
        <div className="qr-print-grid mx-auto grid grid-cols-2 gap-6">
          {targets.map((t) => (
            <div key={t.id} className="qr-print-cell break-inside-avoid">
              <QrCard
                cardId={`qr-print-${t.id}`}
                restaurantName={restaurantName}
                logoUrl={logoUrl}
                primaryColor={primaryColor}
                menuUrl={t.menuUrl}
                headline={t.headline}
                qrSize={168}
                className="shadow-none"
              />
              <p className="mt-2 text-center text-xs text-neutral-400">
                {t.menuUrl}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
