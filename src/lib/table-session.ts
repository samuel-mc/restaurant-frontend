/**
 * Persistencia de mesa anclada por QR (?m=).
 */

export function tableStorageKey(tenantSlug: string): string {
  return `platolisto_table_number_${tenantSlug.trim().toLowerCase()}`;
}

/** Normaliza el valor de ?m= (ej. "Mesa4", "4", " mesa 12 "). */
export function normalizeTableParam(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (!trimmed) return null;
  return trimmed.slice(0, 10);
}

export function readStoredTable(tenantSlug: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return normalizeTableParam(window.localStorage.getItem(tableStorageKey(tenantSlug)));
  } catch {
    return null;
  }
}

export function writeStoredTable(tenantSlug: string, tableNumber: string): void {
  if (typeof window === "undefined") return;
  const value = normalizeTableParam(tableNumber);
  if (!value) return;
  try {
    window.localStorage.setItem(tableStorageKey(tenantSlug), value);
  } catch {
    // ignore quota / private mode
  }
}

export function clearStoredTable(tenantSlug: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(tableStorageKey(tenantSlug));
  } catch {
    // ignore
  }
}

/** Etiqueta amigable para UI. */
export function formatTableLabel(tableNumber: string): string {
  const t = tableNumber.trim();
  if (/^mesa\b/i.test(t)) return t;
  return `Mesa ${t}`;
}
