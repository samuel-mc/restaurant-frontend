import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { e2eEnv } from "./fixtures/env";

/**
 * Loop operativo PICKUP:
 * menú → carrito → pedido → tracking "Recibido"
 * → cocina Aceptar → tracking "Confirmado" (WS, sin reload).
 */

async function customerPlacePickupOrder(page: Page): Promise<void> {
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
}

async function kitchenAcceptLatestPickup(
  context: BrowserContext,
): Promise<void> {
  const page = await context.newPage();
  await page.goto("/admin/login");
  await page.locator('input[name="email"]').fill(e2eEnv.ownerEmail);
  await page.locator('input[name="password"]').fill(e2eEnv.ownerPassword);
  await page.getByRole("button", { name: /Entrar a cocina/i }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 30_000 });

  await page.goto("/admin/dashboard/kitchen");
  await expect(page.getByTestId("kitchen-advance").first()).toBeVisible({
    timeout: 30_000,
  });
  await page.getByTestId("kitchen-advance").first().click();
}

test.describe("smoke ops loop", () => {
  test("PICKUP: pedido → cocina acepta → tracking WS", async ({
    browser,
    baseURL,
  }) => {
    expect(baseURL).toContain(e2eEnv.tenantSlug);

    const customer = await browser.newContext({
      baseURL: e2eEnv.tenantBaseUrl,
    });
    const kitchen = await browser.newContext({
      baseURL: e2eEnv.tenantBaseUrl,
    });

    const customerPage = await customer.newPage();
    await customerPlacePickupOrder(customerPage);

    await kitchenAcceptLatestPickup(kitchen);

    await expect(customerPage.getByTestId("order-status-label")).toHaveText(
      /Confirmado/i,
      { timeout: 20_000 },
    );

    await customer.close();
    await kitchen.close();
  });
});
