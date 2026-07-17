/**
 * Utilidades globales de formateo. Por regla de arquitectura, la moneda SIEMPRE
 * se formatea aquí (nunca ad-hoc en componentes) usando `Intl.NumberFormat`.
 */

const DEFAULT_LOCALE = process.env.NEXT_PUBLIC_LOCALE ?? "es-MX";
const DEFAULT_CURRENCY = process.env.NEXT_PUBLIC_CURRENCY ?? "MXN";

/**
 * Cache de formateadores por combinación locale+moneda. Crear un
 * `Intl.NumberFormat` es relativamente costoso; lo reutilizamos.
 */
const formatterCache = new Map<string, Intl.NumberFormat>();

function getCurrencyFormatter(locale: string, currency: string): Intl.NumberFormat {
  const key = `${locale}:${currency}`;
  let formatter = formatterCache.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, { style: "currency", currency });
    formatterCache.set(key, formatter);
  }
  return formatter;
}

/**
 * Formatea un importe como moneda.
 *
 * @param amount   Importe numérico (ej. 120.5).
 * @param currency Código ISO 4217 (por defecto `NEXT_PUBLIC_CURRENCY` o "MXN").
 * @param locale   Locale BCP-47 (por defecto `NEXT_PUBLIC_LOCALE` o "es-MX").
 * @returns Cadena formateada; para valores no finitos devuelve el formato de 0.
 */
export function formatCurrency(
  amount: number,
  currency: string = DEFAULT_CURRENCY,
  locale: string = DEFAULT_LOCALE,
): string {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  return getCurrencyFormatter(locale, currency).format(safeAmount);
}
