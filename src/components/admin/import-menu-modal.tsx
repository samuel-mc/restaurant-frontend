"use client";

/**
 * Modal de carga masiva de platillos (.xlsx / .csv).
 */

import { useCallback, useId, useRef, useState, type DragEvent } from "react";
import { FileSpreadsheet, Upload, X } from "lucide-react";
import type { MenuImportResult } from "@/types/menu-import";
import { uploadMenuExcel } from "@/services/adminMenuImportService";
import { ApiError } from "@/services/apiClient";

interface ImportMenuModalProps {
  open: boolean;
  tenantSlug: string;
  busy: boolean;
  onClose: () => void;
  onImported: (result: MenuImportResult) => void;
}

const ACCEPTED =
  ".xlsx,.xlsm,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv";

export function ImportMenuModal({
  open,
  tenantSlug,
  busy,
  onClose,
  onImported,
}: ImportMenuModalProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MenuImportResult | null>(null);

  const resetLocal = useCallback(() => {
    setFile(null);
    setError(null);
    setResult(null);
    setDragging(false);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  function handleClose() {
    if (uploading || busy) return;
    resetLocal();
    onClose();
  }

  function pickFile(next: File | null) {
    setError(null);
    setResult(null);
    if (!next) {
      setFile(null);
      return;
    }
    const name = next.name.toLowerCase();
    const ok =
      name.endsWith(".xlsx") ||
      name.endsWith(".xlsm") ||
      name.endsWith(".csv");
    if (!ok) {
      setFile(null);
      setError("Solo se admiten archivos .xlsx o .csv.");
      return;
    }
    setFile(next);
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    const dropped = event.dataTransfer.files?.[0] ?? null;
    pickFile(dropped);
  }

  async function handleUpload() {
    if (!file || uploading) return;
    setUploading(true);
    setError(null);
    setResult(null);
    try {
      const imported = await uploadMenuExcel(file, tenantSlug);
      setResult(imported);
      onImported(imported);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "No se pudo procesar el archivo.",
      );
    } finally {
      setUploading(false);
    }
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${inputId}-title`}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
      onClick={handleClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-black/5 px-5 py-4 dark:border-white/10">
          <div>
            <h2
              id={`${inputId}-title`}
              className="text-lg font-extrabold tracking-tight"
            >
              Cargar menú Excel
            </h2>
            <p className="mt-0.5 text-sm text-black/50 dark:text-white/50">
              Usa la plantilla oficial. Incluye Url_Imagen opcional; las
              categorías se crean solas si no existen.
            </p>
          </div>
          <button
            type="button"
            aria-label="Cerrar"
            disabled={uploading}
            onClick={handleClose}
            className="rounded-full p-2 text-black/50 hover:bg-black/5 disabled:opacity-40 dark:text-white/50 dark:hover:bg-white/10"
          >
            <X className="size-5" />
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <label
            htmlFor={inputId}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-10 text-center transition ${
              dragging
                ? "border-emerald-500 bg-emerald-500/10"
                : "border-black/15 bg-black/[0.02] dark:border-white/15 dark:bg-white/[0.03]"
            }`}
          >
            <Upload className="size-8 text-black/35 dark:text-white/35" />
            <span className="text-sm font-semibold">
              Arrastra tu archivo aquí o haz clic para elegir
            </span>
            <span className="text-xs text-black/45 dark:text-white/45">
              Formatos: .xlsx · .csv
            </span>
            <input
              id={inputId}
              ref={inputRef}
              type="file"
              accept={ACCEPTED}
              className="sr-only"
              disabled={uploading}
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />
          </label>

          {file ? (
            <div className="flex items-center gap-3 rounded-2xl border border-black/10 bg-white px-4 py-3 dark:border-white/10 dark:bg-neutral-950">
              <FileSpreadsheet className="size-5 shrink-0 text-emerald-600" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{file.name}</p>
                <p className="text-xs text-black/45 dark:text-white/45">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
              <button
                type="button"
                disabled={uploading}
                onClick={() => pickFile(null)}
                className="text-xs font-semibold text-black/50 hover:text-foreground disabled:opacity-40"
              >
                Quitar
              </button>
            </div>
          ) : null}

          {uploading ? (
            <p
              role="status"
              className="rounded-2xl bg-amber-500/10 px-4 py-3 text-sm font-medium text-amber-900 dark:text-amber-100"
            >
              Procesando platillos y categorías…
            </p>
          ) : null}

          {error ? (
            <p
              role="alert"
              className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-700 dark:text-red-300"
            >
              {error}
            </p>
          ) : null}

          {result ? (
            <div className="space-y-3 rounded-2xl border border-black/10 p-4 dark:border-white/10">
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-800 dark:text-emerald-200">
                  {result.creadosExitosamente} importados
                </span>
                <span className="inline-flex rounded-full bg-black/5 px-3 py-1 text-xs font-semibold text-black/60 dark:bg-white/10 dark:text-white/60">
                  {result.totalProcesados} filas procesadas
                </span>
                {result.errores.length > 0 ? (
                  <span className="inline-flex rounded-full bg-amber-500/15 px-3 py-1 text-xs font-bold text-amber-900 dark:text-amber-100">
                    {result.errores.length} con error
                  </span>
                ) : null}
              </div>

              {result.categoriesCreated.length > 0 ? (
                <p className="text-xs text-black/55 dark:text-white/55">
                  Categorías nuevas:{" "}
                  {result.categoriesCreated.map((c) => c.name).join(", ")}
                </p>
              ) : null}

              {result.errores.length > 0 ? (
                <ul className="max-h-40 space-y-1.5 overflow-y-auto text-xs">
                  {result.errores.map((err) => (
                    <li
                      key={`${err.row}-${err.reason}`}
                      className="rounded-lg bg-amber-500/10 px-3 py-2 text-amber-950 dark:text-amber-50"
                    >
                      <span className="font-bold">Fila {err.row}:</span>{" "}
                      {err.reason}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-emerald-700 dark:text-emerald-300">
                  Todos los platillos válidos se importaron correctamente.
                </p>
              )}
            </div>
          ) : null}
        </div>

        <footer className="flex gap-2 border-t border-black/5 px-5 py-4 dark:border-white/10">
          <button
            type="button"
            disabled={uploading}
            onClick={handleClose}
            className="flex-1 rounded-2xl border border-black/10 px-4 py-3 text-sm font-bold dark:border-white/15"
          >
            {result ? "Cerrar" : "Cancelar"}
          </button>
          {!result ? (
            <button
              type="button"
              disabled={!file || uploading}
              onClick={() => void handleUpload()}
              className="flex-1 rounded-2xl bg-foreground px-4 py-3 text-sm font-bold text-background disabled:opacity-40"
            >
              {uploading ? "Importando…" : "Importar"}
            </button>
          ) : null}
        </footer>
      </div>
    </div>
  );
}
