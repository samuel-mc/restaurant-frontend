import { expect, type Page, type BrowserContext, type CDPSession } from "@playwright/test";
import { e2eEnv } from "./env";

/**
 * Helpers compartidos del loop PICKUP (E2E-01 / E2E-02).
 */

export type KitchenLane = "PENDING" | "ACCEPTED" | "IN_KITCHEN" | "DELIVERED";

const wsBlockSessions = new WeakMap<Page, CDPSession>();

/** Bloquea SockJS/STOMP del tracking vía CDP (HTTP + WS). */
export async function blockOrderWebSocket(page: Page): Promise<void> {
  const existing = wsBlockSessions.get(page);
  if (existing) {
    await existing.send("Network.setBlockedURLs", {
      urls: ["*ws-orders*"],
    });
    return;
  }
  const session = await page.context().newCDPSession(page);
  await session.send("Network.enable");
  await session.send("Network.setBlockedURLs", { urls: ["*ws-orders*"] });
  wsBlockSessions.set(page, session);
}

export async function unblockOrderWebSocket(page: Page): Promise<void> {
  const session = wsBlockSessions.get(page);
  if (!session) return;
  await session.send("Network.setBlockedURLs", { urls: [] });
}

export async function customerPlacePickupOrder(page: Page): Promise<string> {
  await page.goto("/menu");
  await expect(page.getByTestId("menu-add-product").first()).toBeVisible({
    timeout: 30_000,
  });

  await page.getByTestId("menu-add-product").first().click();
  await page.getByTestId("product-add-confirm").click();

  await page.getByTestId("cart-open").click();
  await page.getByLabel("Nombre").fill("Comensal E2E");
  await page.getByLabel("Teléfono").fill("5512345678");
  await page.getByTestId("cart-confirm-order").click();

  await expect(page).toHaveURL(/\/orders\/[0-9a-f-]{36}/i, { timeout: 30_000 });
  await expect(page.getByTestId("order-status-label")).toHaveText(/Recibido/i);

  const match = page.url().match(/\/orders\/([0-9a-f-]{36})/i);
  if (!match?.[1]) {
    throw new Error(`No se pudo leer uuid del pedido desde ${page.url()}`);
  }
  return match[1];
}

export async function kitchenLogin(page: Page): Promise<void> {
  await page.goto("/admin/login");
  await page.locator('input[name="email"]').fill(e2eEnv.ownerEmail);
  await page.locator('input[name="password"]').fill(e2eEnv.ownerPassword);
  await page.getByRole("button", { name: /Entrar a cocina/i }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 30_000 });
}

/** El monitor solo muestra una etapa: hay que enfocar la pestaña correcta. */
export async function kitchenFocusLane(
  page: Page,
  lane: KitchenLane,
): Promise<void> {
  const tab = page.locator(`#kitchen-tab-${lane}`);
  await expect(tab).toBeVisible({ timeout: 15_000 });
  await tab.click();
  await expect(tab).toHaveAttribute("aria-selected", "true");
}

/**
 * Avanza un ticket concreto (Aceptar / Cocinar / Listo).
 * `lane` = etapa donde está el pedido antes del click.
 */
export async function kitchenAdvanceOrder(
  page: Page,
  orderUuid: string,
  lane: KitchenLane,
): Promise<void> {
  await kitchenFocusLane(page, lane);
  const ticket = page.locator(`#kitchen-ticket-${orderUuid}`);
  await expect(ticket).toBeVisible({ timeout: 30_000 });
  const advance = ticket.getByTestId("kitchen-advance");
  await expect(advance).toBeVisible({ timeout: 15_000 });
  await advance.click();
}

export async function openKitchenBoard(
  context: BrowserContext,
): Promise<Page> {
  const page = await context.newPage();
  await kitchenLogin(page);
  await page.goto("/admin/dashboard/kitchen");
  return page;
}

export async function expectTrackingStatus(
  page: Page,
  label: RegExp,
): Promise<void> {
  await expect(page.getByTestId("order-status-label")).toHaveText(label, {
    timeout: 20_000,
  });
}

export async function expectConnectionHint(
  page: Page,
  label: RegExp,
  timeoutMs = 25_000,
): Promise<void> {
  await expect(page.getByTestId("order-connection-hint")).toHaveText(label, {
    timeout: timeoutMs,
  });
}

export async function kitchenAdvanceToDelivered(
  page: Page,
  orderUuid: string,
): Promise<void> {
  await kitchenAdvanceOrder(page, orderUuid, "PENDING");
  await kitchenAdvanceOrder(page, orderUuid, "ACCEPTED");
  await kitchenAdvanceOrder(page, orderUuid, "IN_KITCHEN");
}

/** Cobrar desde Por cobrar + confirmar diálogo. */
export async function kitchenChargeAndClose(
  page: Page,
  orderUuid: string,
): Promise<void> {
  await kitchenFocusLane(page, "DELIVERED");
  const ticket = page.locator(`#kitchen-ticket-${orderUuid}`);
  await expect(ticket).toBeVisible({ timeout: 30_000 });
  await ticket.getByTestId("kitchen-charge").click();
  await page.getByTestId("confirm-dialog-confirm").click();
  await expect(ticket).toHaveCount(0, { timeout: 20_000 });
}


/** Pedido IN_TABLE anclado con QR (?m=&t=). Sin nombre/tel (no hace falta). */
export async function customerPlaceInTableOrder(
  page: Page,
  menuPath: string,
): Promise<string> {
  await page.goto(menuPath);
  await expect(page.getByTestId("menu-add-product").first()).toBeVisible({
    timeout: 30_000,
  });

  await page.getByTestId("menu-add-product").first().click();
  await page.getByTestId("product-add-confirm").click();

  await page.getByTestId("cart-open").click();
  // En mesa no pide nombre/tel obligatorio.
  await page.getByTestId("cart-confirm-order").click();

  await expect(page).toHaveURL(/\/orders\/[0-9a-f-]{36}/i, { timeout: 30_000 });
  await expect(page.getByTestId("order-status-label")).toHaveText(/Recibido/i);

  const match = page.url().match(/\/orders\/([0-9a-f-]{36})/i);
  if (!match?.[1]) {
    throw new Error(`No se pudo leer uuid del pedido desde ${page.url()}`);
  }
  return match[1];
}

export async function customerPlaceDeliveryOrder(
  page: Page,
  address = "Calle E2E 123, Col. Centro",
): Promise<string> {
  await page.goto("/menu");
  await expect(page.getByTestId("menu-add-product").first()).toBeVisible({
    timeout: 30_000,
  });

  await page.getByTestId("menu-add-product").first().click();
  await page.getByTestId("product-add-confirm").click();

  await page.getByTestId("cart-open").click();
  await page.getByTestId("cart-channel-DELIVERY").click();
  await page.getByLabel("Nombre").fill("Comensal Delivery E2E");
  await page.getByLabel("Teléfono").fill("5512345678");
  await page.getByTestId("cart-delivery-address").fill(address);
  await page.getByTestId("cart-confirm-order").click();

  await expect(page).toHaveURL(/\/orders\/[0-9a-f-]{36}/i, { timeout: 30_000 });
  await expect(page.getByTestId("order-status-label")).toHaveText(/Recibido/i);

  const match = page.url().match(/\/orders\/([0-9a-f-]{36})/i);
  if (!match?.[1]) {
    throw new Error(`No se pudo leer uuid del pedido desde ${page.url()}`);
  }
  return match[1];
}

/** Login staff PIN → home del rol (MESERO salón / COCINA cocina). */
export async function staffPinLogin(
  page: Page,
  staffName: string,
  pin: string,
  expectedPath: RegExp,
): Promise<void> {
  await page.goto("/staff/login");
  await expect(page.getByRole("button", { name: new RegExp(staffName, "i") })).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole("button", { name: new RegExp(staffName, "i") }).click();
  await expect(page.getByTestId("staff-pin-pad")).toBeVisible({ timeout: 15_000 });
  await page.keyboard.type(pin);
  await expect(page).toHaveURL(expectedPath, { timeout: 30_000 });
}

export async function openSalonBoard(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  await kitchenLogin(page);
  await page.goto("/admin/dashboard/orders");
  return page;
}

/** FAB ayuda → Llamar mesero → Sí, avisar (requiere menú con QR mesa). */
export async function customerCallWaiter(page: Page): Promise<void> {
  await page.getByTestId("table-help-fab").click();
  await page.getByTestId("table-help-waiter").click();
  await page.getByTestId("table-help-waiter-confirm").click();
}

export async function mergeSalonTables(
  page: Page,
  primary: string,
  secondary: string,
): Promise<void> {
  await page.getByTestId("salon-merge-open").click();
  const modal = page.getByTestId("merge-tables-modal");
  await expect(modal).toBeVisible({ timeout: 15_000 });
  await modal.getByTestId(`merge-primary-${primary}`).click();
  await modal.getByTestId("merge-continue").click();
  await modal.getByTestId(`merge-secondary-${secondary}`).click();
  await modal.getByTestId("merge-confirm").click();
  await expect(modal).toHaveCount(0, { timeout: 20_000 });
}
