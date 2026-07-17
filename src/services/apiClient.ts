/**
 * Cliente base HTTP para el backend Spring Boot.
 *
 * Centraliza URL base, cabeceras, parseo y manejo de errores para que ningún
 * componente disperse URLs ni lógica de fetch. Consumo stateless vía REST.
 *
 * La URL base se lee de `NEXT_PUBLIC_API_URL` (ej. "http://localhost:8080").
 */

/** Opciones de caché/revalidación específicas de Next.js (App Router). */
interface NextFetchOptions {
  revalidate?: number | false;
  tags?: string[];
}

/** Opciones aceptadas por cada petición del cliente. */
export interface RequestOptions extends Omit<RequestInit, "body"> {
  /** Cuerpo ya serializable a JSON. Se codifica automáticamente. */
  body?: unknown;
  /** Cabeceras adicionales (se combinan con las por defecto). */
  headers?: HeadersInit;
  /** Timeout en milisegundos (por defecto 15000). */
  timeoutMs?: number;
  /** Opciones de caché de Next.js. */
  next?: NextFetchOptions;
}

/**
 * Error tipado de la capa de API. Distingue fallos de red/timeout (status 0)
 * de respuestas HTTP no exitosas, y conserva el cuerpo de error parseado.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly url: string;
  readonly body: unknown;

  constructor(params: {
    message: string;
    status: number;
    statusText: string;
    url: string;
    body?: unknown;
  }) {
    super(params.message);
    this.name = "ApiError";
    this.status = params.status;
    this.statusText = params.statusText;
    this.url = params.url;
    this.body = params.body;
  }

  /** `true` cuando el error proviene de la red o de un timeout (sin respuesta HTTP). */
  get isNetworkError(): boolean {
    return this.status === 0;
  }
}

/** Forma esperada de los errores JSON del backend (`GlobalExceptionHandler`). */
interface BackendErrorBody {
  error?: string;
  message?: string;
}

function resolveBaseUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!baseUrl) {
    throw new ApiError({
      message:
        "Falta la variable de entorno NEXT_PUBLIC_API_URL. Define la URL base del backend.",
      status: 0,
      statusText: "Configuration Error",
      url: "",
    });
  }
  return baseUrl.replace(/\/+$/, "");
}

function buildUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${resolveBaseUrl()}${normalizedPath}`;
}

/** Intenta parsear la respuesta según su `Content-Type`. Nunca lanza. */
async function parseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return null;
  const contentType = response.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("application/json")) {
      return (await response.json()) as unknown;
    }
    const text = await response.text();
    return text.length > 0 ? text : null;
  } catch {
    return null;
  }
}

/** Extrae un mensaje legible del cuerpo de error del backend. */
function extractErrorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === "object") {
    const parsed = body as BackendErrorBody;
    if (typeof parsed.error === "string") return parsed.error;
    if (typeof parsed.message === "string") return parsed.message;
  }
  if (typeof body === "string" && body.trim().length > 0) return body;
  return fallback;
}

/**
 * Ejecuta una petición HTTP tipada contra el backend.
 *
 * @typeParam T Tipo esperado del cuerpo de respuesta.
 * @throws {ApiError} Ante errores de red, timeout o respuestas no 2xx.
 */
async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, headers, timeoutMs = 15_000, next, ...rest } = options;
  const url = buildUrl(path);

  const finalHeaders = new Headers({ Accept: "application/json", ...headers });
  let serializedBody: BodyInit | undefined;
  if (body !== undefined && body !== null) {
    serializedBody = JSON.stringify(body);
    if (!finalHeaders.has("Content-Type")) {
      finalHeaders.set("Content-Type", "application/json");
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      ...rest,
      headers: finalHeaders,
      body: serializedBody,
      signal: options.signal ?? controller.signal,
      ...(next ? { next } : {}),
    } as RequestInit);
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === "AbortError";
    throw new ApiError({
      message: aborted
        ? `La petición a ${url} excedió el tiempo límite (${timeoutMs} ms).`
        : `No se pudo conectar con el backend (${url}).`,
      status: 0,
      statusText: aborted ? "Timeout" : "Network Error",
      url,
      body: error instanceof Error ? error.message : String(error),
    });
  } finally {
    clearTimeout(timeout);
  }

  const parsed = await parseBody(response);

  if (!response.ok) {
    throw new ApiError({
      message: extractErrorMessage(
        parsed,
        `La petición a ${url} falló con estado ${response.status}.`,
      ),
      status: response.status,
      statusText: response.statusText,
      url,
      body: parsed,
    });
  }

  return parsed as T;
}

/** Cliente HTTP con métodos por verbo. Todas las llamadas al backend pasan por aquí. */
export const apiClient = {
  get: <T>(path: string, options?: RequestOptions): Promise<T> =>
    request<T>(path, { ...options, method: "GET" }),

  post: <T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> =>
    request<T>(path, { ...options, method: "POST", body }),

  put: <T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> =>
    request<T>(path, { ...options, method: "PUT", body }),

  patch: <T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> =>
    request<T>(path, { ...options, method: "PATCH", body }),

  delete: <T>(path: string, options?: RequestOptions): Promise<T> =>
    request<T>(path, { ...options, method: "DELETE" }),
} as const;
