/** Clase en html/body mientras corre window.print() de ticket 80mm. */
export const PRINT_BODY_CLASS = "print-thermal-ticket";

const PRINT_PAGE_STYLE_ID = "thermal-print-page-style";

/** Quita clase + estilo @page inyectado (afterprint / cancel / unmount). */
export function clearThermalPrintArtifacts() {
  if (typeof document === "undefined") return;
  document.documentElement.classList.remove(PRINT_BODY_CLASS);
  document.body.classList.remove(PRINT_BODY_CLASS);
  document.getElementById(PRINT_PAGE_STYLE_ID)?.remove();
}

/**
 * Inyecta @page 80mm auto; margin 0 para sobrescribir el @page letter de QR admin.
 * Idempotente mientras el nodo style siga en el DOM.
 */
export function ensureThermalPrintPageStyle() {
  if (typeof document === "undefined") return;
  if (document.getElementById(PRINT_PAGE_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = PRINT_PAGE_STYLE_ID;
  style.textContent = [
    "@media print {",
    "  @page { size: 80mm auto; margin: 0; }",
    "  html.print-thermal-ticket, body.print-thermal-ticket {",
    "    height: auto !important; min-height: 0 !important;",
    "  }",
    "}",
  ].join("\n");
  document.head.appendChild(style);
}

/** Activa modo térmico: clase en html/body + @page 80mm. */
export function beginThermalPrint() {
  clearThermalPrintArtifacts();
  document.documentElement.classList.add(PRINT_BODY_CLASS);
  document.body.classList.add(PRINT_BODY_CLASS);
  ensureThermalPrintPageStyle();
}
