"use client";

/**
 * Generador de códigos QR (menú general, mesa específica, masivo).
 */

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Download, Printer, QrCode } from "lucide-react";
import { toPng } from "html-to-image";
import { QrCard } from "@/components/admin/qr-card";
import {
  buildPublicMenuUrl,
  getPublicRootDomain,
  qrDownloadFilename,
  tableDisplayLabel,
  toQrTableParam,
} from "@/lib/qr-menu-url";

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
  const previewRef = useRef<HTMLDivElement | null>(null);
  const printSheetRef = useRef<HTMLDivElement | null>(null);

  const rootDomain = getPublicRootDomain();

  const targets = useMemo<QrTarget[]>(() => {
    if (mode === "general") {
      return [
        {
          id: "general",
          headline: "Pide desde tu lugar",
          tableNumber: null,
          menuUrl: buildPublicMenuUrl(tenantSlug),
        },
      ];
    }

    if (mode === "table") {
      const n = toQrTableParam(tableNumber);
      if (!n) return [];
      return [
        {
          id: `table-${slugifyId(n)}`,
          headline: tableDisplayLabel(n),
          tableNumber: n,
          menuUrl: buildPublicMenuUrl(tenantSlug, n),
        },
      ];
    }

    const from = Math.min(bulkFrom, bulkTo);
    const to = Math.max(bulkFrom, bulkTo);
    const span = to - from + 1;
    if (span > 48) return [];

    const list: QrTarget[] = [];
    for (let n = from; n <= to; n += 1) {
      const num = String(n);
      list.push({
        id: `mesa-${n}`,
        headline: tableDisplayLabel(num),
        tableNumber: num,
        menuUrl: buildPublicMenuUrl(tenantSlug, num),
      });
    }
    return list;
  }, [mode, tableNumber, bulkFrom, bulkTo, tenantSlug]);

  const preview = targets[0] ?? null;
  const bulkTooLarge =
    mode === "bulk" && Math.abs(bulkTo - bulkFrom) + 1 > 48;

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
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
      <header className="print:hidden">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-black/40 dark:text-white/40">
          {restaurantName}
        </p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-black tracking-tight sm:text-3xl">
          <QrCode className="size-7 shrink-0" aria-hidden />
          Códigos QR
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-black/55 dark:text-white/55">
          Genera tarjetas para el menú general o mesas específicas. La URL
          apunta a{" "}
          <span className="font-semibold text-foreground">
            {tenantSlug}.{rootDomain}/menu
          </span>
          .
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] print:hidden">
        <section className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-neutral-900">
          <h2 className="text-sm font-extrabold tracking-tight">Tipo de QR</h2>
          <div
            role="tablist"
            aria-label="Tipo de código QR"
            className="mt-3 flex flex-col gap-2"
          >
            {(
              [
                { id: "general", label: "Menú General", hint: "Sin mesa fija" },
                {
                  id: "table",
                  label: "Mesa Específica",
                  hint: "Ancla ?m= en la URL",
                },
                {
                  id: "bulk",
                  label: "Generación Masiva",
                  hint: "Rango de mesas",
                },
              ] as const
            ).map((item) => {
              const active = mode === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setMode(item.id)}
                  className={`rounded-2xl px-4 py-3 text-left transition-colors ${
                    active
                      ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-950"
                      : "bg-black/[0.03] hover:bg-black/[0.06] dark:bg-white/[0.05] dark:hover:bg-white/[0.08]"
                  }`}
                >
                  <span className="block text-sm font-bold">{item.label}</span>
                  <span
                    className={`mt-0.5 block text-[11px] font-medium ${
                      active
                        ? "text-white/70 dark:text-neutral-600"
                        : "text-black/45 dark:text-white/45"
                    }`}
                  >
                    {item.hint}
                  </span>
                </button>
              );
            })}
          </div>

          {mode === "table" ? (
            <div className="mt-5">
              <span className="text-xs font-bold uppercase tracking-wide text-black/45 dark:text-white/45">
                Número de mesa
              </span>
              <div className="mt-2 flex overflow-hidden rounded-2xl border border-black/10 bg-white dark:border-white/15 dark:bg-neutral-950">
                <span className="flex items-center bg-black/[0.04] px-4 text-sm font-extrabold text-black/70 dark:bg-white/[0.06] dark:text-white/70">
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
                  className="min-w-0 flex-1 bg-transparent px-4 py-3 text-sm font-semibold outline-none ring-neutral-900 focus:ring-2"
                />
              </div>
              <span className="mt-2 block truncate text-[11px] text-black/45 dark:text-white/45">
                URL: {preview?.menuUrl ?? "—"}
              </span>
            </div>
          ) : null}

          {mode === "bulk" ? (
            <form onSubmit={onBulkSubmit} className="mt-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wide text-black/45 dark:text-white/45">
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
                    className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold outline-none ring-neutral-900 focus:ring-2 dark:border-white/15 dark:bg-neutral-950"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wide text-black/45 dark:text-white/45">
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
                    className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold outline-none ring-neutral-900 focus:ring-2 dark:border-white/15 dark:bg-neutral-950"
                  />
                </label>
              </div>
              <p className="text-[11px] text-black/45 dark:text-white/45">
                Se generarán {targets.length || 0} tarjetas (máx. 48 por lote).
              </p>
              {bulkTooLarge ? (
                <p className="text-xs font-medium text-red-600 dark:text-red-300">
                  Reduce el rango a 48 mesas o menos.
                </p>
              ) : null}
            </form>
          ) : null}

          {mode === "general" && preview ? (
            <p className="mt-5 break-all text-[11px] text-black/45 dark:text-white/45">
              URL: {preview.menuUrl}
            </p>
          ) : null}

          <div className="mt-6 flex flex-col gap-2">
            <button
              type="button"
              disabled={!preview || busy}
              onClick={() => void handleDownloadPng()}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-neutral-900 px-4 text-sm font-bold text-white disabled:opacity-50 dark:bg-white dark:text-neutral-950"
            >
              <Download className="size-4" aria-hidden />
              {busy ? "Generando…" : "Descargar PNG"}
            </button>
            <button
              type="button"
              disabled={targets.length === 0 || bulkTooLarge}
              onClick={handlePrint}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 text-sm font-bold text-white disabled:opacity-50"
            >
              <Printer className="size-4" aria-hidden />
              Imprimir Tarjetas / Exportar PDF
            </button>
          </div>

          {error ? (
            <p className="mt-3 text-sm font-medium text-red-600 dark:text-red-300">
              {error}
            </p>
          ) : null}
        </section>

        <section>
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-sm font-extrabold tracking-tight">
                Vista previa
              </h2>
              <p className="text-xs text-black/45 dark:text-white/45">
                Simulación de acrílico de mesa · alta resolución
              </p>
            </div>
            {mode === "bulk" ? (
              <p className="text-xs font-bold text-black/50 dark:text-white/50">
                {targets.length} tarjetas
              </p>
            ) : null}
          </div>

          {preview ? (
            <div className="mx-auto w-full max-w-sm">
              <div className="rounded-[2rem] bg-gradient-to-b from-neutral-200/80 to-neutral-100 p-6 dark:from-neutral-800 dark:to-neutral-900">
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
            <div className="rounded-3xl border border-dashed border-black/10 px-6 py-16 text-center text-sm text-black/50 dark:border-white/10 dark:text-white/50">
              Ajusta el identificador o el rango para ver la vista previa.
            </div>
          )}

          {mode === "bulk" && targets.length > 1 ? (
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {targets.slice(0, 8).map((t) => (
                <div
                  key={t.id}
                  className="rounded-2xl border border-black/5 bg-white p-2 dark:border-white/10 dark:bg-neutral-950"
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
            <p className="mt-3 text-center text-xs text-black/45 dark:text-white/45">
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
        <div className="mb-4 text-center text-xs font-bold uppercase tracking-[0.14em] text-neutral-500">
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
              <p className="mt-2 text-center text-[9px] text-neutral-400">
                {t.menuUrl}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
