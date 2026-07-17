/**
 * Constantes de la sesión administrativa (JWT en cookie HttpOnly).
 */

/** Nombre de la cookie que guarda el JWT del panel admin. */
export const ADMIN_TOKEN_COOKIE = "pl_admin_token";

/** Duración de la sesión (segundos) — 8 horas operativas. */
export const ADMIN_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 8;
