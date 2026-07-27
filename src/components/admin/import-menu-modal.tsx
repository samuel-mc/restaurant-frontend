"use client";

/**
 * Modal de carga masiva de platillos (.xlsx / .csv).
 */

import { useCallback, useId, useRef, useState, type DragEvent } from "react";
import { FileSpreadsheet, Upload, X } from "lucide-react";
import type { MenuImportResult } from "@/types/menu-import";
import { uploadMenuExcel } from "@/services/adminMenuImportService";
import { ApiError } from "@/services/apiClient";
import { useModalFocusTrap } from "@/hooks/useModalFocusTrap";

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

  const focusRing =
    "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card";
  const locked = uploading || busy;
  const panelRef = useModalFocusTrap({
    open,
    onEscape: handleClose,
    escapeEnabled: !locked,
  });

  if (!open) return null;

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
      onClick={handleClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${inputId}-title`}
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-card shadow-[0_16px_40px_rgba(0,0,0,0.28)] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0 pr-2">
            <h2
              id={`${inputId}-title`}
              className="text-lg font-bold tracking-tight"
            >
              Importar menú
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Usa la plantilla oficial. Las categorías se crean solas si no
              existen.
            </p>
          </div>
          <button
            type="button"
            aria-label="Cerrar"
            disabled={locked}
            onClick={handleClose}
            className={`inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-40 ${focusRing}`}
          >
            <X className="size-5" aria-hidden />
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
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-10 text-center transition-colors ${
              dragging
                ? "border-live bg-live-muted"
                : "border-border bg-secondary/60"
            }`}
          >
            <Upload className="size-8 text-muted-foreground" aria-hidden />
            <span className="text-sm font-semibold">
              Arrastra tu archivo aquí o haz clic para elegir
            </span>
            <span className="text-xs text-muted-foreground">
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
            <div className="flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3">
              <FileSpreadsheet
                className="size-5 shrink-0 text-live"
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
              <button
                type="button"
                disabled={uploading}
                onClick={() => pickFile(null)}
                className={`text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-40 ${focusRing}`}
              >
                Quitar
              </button>
            </div>
          ) : null}

          {uploading ? (
            <p
              role="status"
              className="rounded-xl bg-warn-muted px-4 py-3 text-sm font-medium text-warn-ink"
            >
              Procesando platillos y categorías…
            </p>
          ) : null}

          {error ? (
            <p
              role="alert"
              className="rounded-xl bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive"
            >
              {error}
            </p>
          ) : null}

          {result ? (
            <div className="space-y-3 rounded-xl border border-border p-4">
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex rounded-full bg-live-muted px-3 py-1 text-xs font-bold text-live-ink">
                  {result.creadosExitosamente} importados
                </span>
                <span className="inline-flex rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-muted-foreground">
                  {result.totalProcesados} filas procesadas
                </span>
                {result.errores.length > 0 ? (
                  <span className="inline-flex rounded-full bg-warn-muted px-3 py-1 text-xs font-bold text-warn-ink">
                    {result.errores.length} con error
                  </span>
                ) : null}
              </div>

              {result.categoriesCreated.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  Categorías nuevas:{" "}
                  {result.categoriesCreated.map((c) => c.name).join(", ")}
                </p>
              ) : null}

              {result.errores.length > 0 ? (
                <ul className="max-h-40 space-y-1.5 overflow-y-auto text-xs">
                  {result.errores.map((err) => (
                    <li
                      key={`${err.row}-${err.reason}`}
                      className="rounded-lg bg-warn-muted px-3 py-2 text-warn-ink"
                    >
                      <span className="font-bold">Fila {err.row}:</span>{" "}
                      {err.reason}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-live-ink">
                  Todos los platillos válidos se importaron correctamente.
                </p>
              )}
            </div>
          ) : null}
        </div>

        <footer className="flex gap-2 border-t border-border px-5 py-4">
          <button
            type="button"
            disabled={locked}
            onClick={handleClose}
            className={`flex-1 rounded-xl border border-border px-4 py-3 text-sm font-semibold transition-colors hover:bg-secondary disabled:opacity-40 ${focusRing}`}
          >
            {result ? "Cerrar" : "Cancelar"}
          </button>
          {!result ? (
            <button
              type="button"
              disabled={!file || uploading}
              onClick={() => void handleUpload()}
              className={`flex-1 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-40 ${focusRing}`}
            >
              {uploading ? "Importando…" : "Importar"}
            </button>
          ) : null}
        </footer>
      </div>
    </div>
  );
}
