/**
 * Persistencia de mesa anclada por QR (?m= + ?t=).
 */

export interface StoredTableSession {
  tableNumber: string;
  tableToken: string | null;
}

export function tableStorageKey(tenantSlug: string): string {
  return `platolisto_table_session_${tenantSlug.trim().toLowerCase()}`;
}

/** @deprecated clave antigua solo con número de mesa */
function legacyTableStorageKey(tenantSlug: string): string {
  return `platolisto_table_number_${tenantSlug.trim().toLowerCase()}`;
}

/** Normaliza el valor de ?m= (ej. "Mesa4", "4", " mesa 12 "). */
export function normalizeTableParam(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (!trimmed) return null;
  return trimmed.slice(0, 10);
}

/** Token opaco del QR (?t=): v2 `{expires}.{hmacHex}` o legacy hex 32. */
export function normalizeTableToken(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().toLowerCase();
  // v2: epochSeconds.hmac (hmac = 32 hex)
  if (/^\d{9,12}\.[a-f0-9]{32}$/.test(trimmed)) {
    return trimmed;
  }
  // legacy v1
  if (/^[a-f0-9]{32}$/.test(trimmed)) {
    return trimmed;
  }
  return null;
}

export function readStoredTableSession(tenantSlug: string): StoredTableSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(tableStorageKey(tenantSlug));
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StoredTableSession>;
      const tableNumber = normalizeTableParam(parsed.tableNumber ?? null);
      if (!tableNumber) return null;
      return {
        tableNumber,
        tableToken: normalizeTableToken(parsed.tableToken ?? null),
      };
    }
    // Migración suave desde clave legacy (sin token).
    const legacy = normalizeTableParam(
      window.localStorage.getItem(legacyTableStorageKey(tenantSlug)),
    );
    if (legacy) {
      return { tableNumber: legacy, tableToken: null };
    }
    return null;
  } catch {
    return null;
  }
}

/** @deprecated prefer readStoredTableSession */
export function readStoredTable(tenantSlug: string): string | null {
  return readStoredTableSession(tenantSlug)?.tableNumber ?? null;
}

export function writeStoredTableSession(
  tenantSlug: string,
  tableNumber: string,
  tableToken: string | null,
): void {
  if (typeof window === "undefined") return;
  const value = normalizeTableParam(tableNumber);
  if (!value) return;
  const token = normalizeTableToken(tableToken);
  try {
    const payload: StoredTableSession = { tableNumber: value, tableToken: token };
    window.localStorage.setItem(tableStorageKey(tenantSlug), JSON.stringify(payload));
    window.localStorage.removeItem(legacyTableStorageKey(tenantSlug));
  } catch {
    // ignore quota / private mode
  }
}

/** @deprecated prefer writeStoredTableSession */
export function writeStoredTable(tenantSlug: string, tableNumber: string): void {
  writeStoredTableSession(tenantSlug, tableNumber, null);
}

export function clearStoredTable(tenantSlug: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(tableStorageKey(tenantSlug));
    window.localStorage.removeItem(legacyTableStorageKey(tenantSlug));
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
