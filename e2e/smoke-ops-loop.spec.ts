import { test, expect } from "@playwright/test";
import { e2eEnv } from "./fixtures/env";
import {
  BASIC_MAX_PRODUCTS,
  BASIC_PRODUCT_LIMIT_MESSAGE,
  buildTableMenuPath,
  createAdminProduct,
  deleteAdminProduct,
  deleteProductsByNamePrefix,
  freeTableIfOccupied,
  listAdminProducts,
  ownerApiLogin,
  replaceProductModifiers,
  setTenantPlan,
  setTenantProPendingPayment,
  setTenantCurrentPeriodEnd,
  signTableQr,
  tryCreateAdminProduct,
} from "./fixtures/api";
import {
  blockOrderWebSocket,
  customerCallWaiter,
  customerPlaceDeliveryOrder,
  customerPlaceInTableOrder,
  customerPlacePickupOrder,
  expectConnectionHint,
  expectTrackingStatus,
  kitchenAdvanceOrder,
  kitchenAdvanceToDelivered,
  kitchenChargeAndClose,
  kitchenLogin,
  mergeSalonTables,
  openKitchenBoard,
  openSalonBoard,
  staffPinLogin,
  unblockOrderWebSocket,
} from "./fixtures/ops-loop";

/** Mesas dentro del piso default (1–12); dedicadas al smoke IN_TABLE / merge. */
const E2E_TABLE = "8";
const E2E_TABLE_B = "9";

test.describe("smoke ops loop", () => {
  test("E2E-01 PICKUP: pedido → cocina acepta → tracking Confirmado", async ({
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
    const orderUuid = await customerPlacePickupOrder(customerPage);

    const kitchenPage = await openKitchenBoard(kitchen);
    await kitchenAdvanceOrder(kitchenPage, orderUuid, "PENDING");

    await expectTrackingStatus(customerPage, /Confirmado/i);

    await customer.close();
    await kitchen.close();
  });

  test("E2E-02 PICKUP: loop completo hasta Entregado", async ({
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
    const orderUuid = await customerPlacePickupOrder(customerPage);

    const kitchenPage = await openKitchenBoard(kitchen);

    await kitchenAdvanceOrder(kitchenPage, orderUuid, "PENDING");
    await expectTrackingStatus(customerPage, /Confirmado/i);

    await kitchenAdvanceOrder(kitchenPage, orderUuid, "ACCEPTED");
    await expectTrackingStatus(customerPage, /Preparando/i);

    await kitchenAdvanceOrder(kitchenPage, orderUuid, "IN_KITCHEN");
    await expectTrackingStatus(customerPage, /Entregado/i);

    await customer.close();
    await kitchen.close();
  });

  test("E2E-03 IN_TABLE: QR tableToken → menú mesa → cocina", async ({
    browser,
    baseURL,
  }) => {
    expect(baseURL).toContain(e2eEnv.tenantSlug);

    const ownerToken = await ownerApiLogin();
    await freeTableIfOccupied(ownerToken, E2E_TABLE);
    const { tableNumber, tableToken } = await signTableQr(
      ownerToken,
      E2E_TABLE,
    );
    const menuPath = buildTableMenuPath(tableNumber, tableToken);

    const customer = await browser.newContext({
      baseURL: e2eEnv.tenantBaseUrl,
    });
    const kitchen = await browser.newContext({
      baseURL: e2eEnv.tenantBaseUrl,
    });

    const customerPage = await customer.newPage();
    const orderUuid = await customerPlaceInTableOrder(customerPage, menuPath);

    const kitchenPage = await openKitchenBoard(kitchen);
    await kitchenAdvanceOrder(kitchenPage, orderUuid, "PENDING");

    // Tras Aceptar el ticket sigue en Aceptados con label de mesa.
    await kitchenPage.locator(`#kitchen-tab-ACCEPTED`).click();
    const ticket = kitchenPage.locator(`#kitchen-ticket-${orderUuid}`);
    await expect(ticket).toBeVisible({ timeout: 15_000 });
    await expect(ticket).toContainText(new RegExp(`Mesa\\s*${tableNumber}`, "i"));

    await expectTrackingStatus(customerPage, /Confirmado/i);

    await customer.close();
    await kitchen.close();
  });

  test("E2E-04 PICKUP: cobrar y cerrar → Cuenta cerrada", async ({
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
    const orderUuid = await customerPlacePickupOrder(customerPage);

    const kitchenPage = await openKitchenBoard(kitchen);
    await kitchenAdvanceToDelivered(kitchenPage, orderUuid);
    await expectTrackingStatus(customerPage, /Entregado/i);

    await kitchenChargeAndClose(kitchenPage, orderUuid);
    await expectTrackingStatus(customerPage, /Cuenta cerrada/i);

    await customer.close();
    await kitchen.close();
  });

  test("E2E-05 IN_TABLE: pre-cuenta desde salón → Imprimir", async ({
    browser,
    baseURL,
  }) => {
    expect(baseURL).toContain(e2eEnv.tenantSlug);

    const ownerToken = await ownerApiLogin();
    await freeTableIfOccupied(ownerToken, E2E_TABLE);
    const { tableNumber, tableToken } = await signTableQr(
      ownerToken,
      E2E_TABLE,
    );
    const menuPath = buildTableMenuPath(tableNumber, tableToken);

    const customer = await browser.newContext({
      baseURL: e2eEnv.tenantBaseUrl,
    });
    const staff = await browser.newContext({
      baseURL: e2eEnv.tenantBaseUrl,
    });

    const customerPage = await customer.newPage();
    const orderUuid = await customerPlaceInTableOrder(customerPage, menuPath);

    const salonPage = await staff.newPage();
    await kitchenLogin(salonPage);
    await salonPage.goto("/admin/dashboard/orders");

    const card = salonPage.getByTestId(`salon-order-${orderUuid}`);
    await expect(card).toBeVisible({ timeout: 30_000 });
    await card.getByTestId("salon-pre-cuenta").click();

    const modal = salonPage.getByTestId("pre-cuenta-modal");
    await expect(modal).toBeVisible({ timeout: 15_000 });
    await expect(modal).toContainText(/PRE-CUENTA|Pre-cuenta/i);
    await expect(modal).toContainText(new RegExp(`Mesa\\s*${tableNumber}`, "i"));

    await salonPage.evaluate(() => {
      window.print = () => {
        queueMicrotask(() => window.dispatchEvent(new Event("afterprint")));
      };
    });
    await salonPage.getByTestId("pre-cuenta-print").click();
    await expect(modal.getByTestId("pre-cuenta-print")).toBeEnabled({
      timeout: 10_000,
    });

    await customer.close();
    await staff.close();
  });

  test("E2E-06 PICKUP: WS caído → reconecta → tracking sigue vivo", async ({
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
    const orderUuid = await customerPlacePickupOrder(customerPage);
    await expectConnectionHint(customerPage, /En vivo/i);

    // CDP Network.setBlockedURLs corta HTTP+WS; reload fuerza el fallo.
    await blockOrderWebSocket(customerPage);
    await customerPage.reload({ waitUntil: "domcontentloaded" });
    await expectTrackingStatus(customerPage, /Recibido/i);
    await expectConnectionHint(
      customerPage,
      /Reconectando|Sin conexión|Conectando/i,
      30_000,
    );

    await unblockOrderWebSocket(customerPage);
    await customerPage.reload({ waitUntil: "domcontentloaded" });
    await expectConnectionHint(customerPage, /En vivo/i, 30_000);

    const kitchenPage = await openKitchenBoard(kitchen);
    await kitchenAdvanceOrder(kitchenPage, orderUuid, "PENDING");
    await expectTrackingStatus(customerPage, /Confirmado/i);

    await customer.close();
    await kitchen.close();
  });

  test("E2E-07 Staff PIN: MESERO → salón · COCINA → cocina", async ({
    browser,
    baseURL,
  }) => {
    expect(baseURL).toContain(e2eEnv.tenantSlug);

    const mesero = await browser.newContext({
      baseURL: e2eEnv.tenantBaseUrl,
    });
    const cocina = await browser.newContext({
      baseURL: e2eEnv.tenantBaseUrl,
    });

    const meseroPage = await mesero.newPage();
    await staffPinLogin(
      meseroPage,
      e2eEnv.meseroName,
      e2eEnv.meseroPin,
      /\/admin\/dashboard\/orders/,
    );

    const cocinaPage = await cocina.newPage();
    await staffPinLogin(
      cocinaPage,
      e2eEnv.cocinaName,
      e2eEnv.cocinaPin,
      /\/admin\/dashboard\/kitchen/,
    );
    await expect(cocinaPage.locator("#kitchen-tab-PENDING")).toBeVisible({
      timeout: 15_000,
    });

    await mesero.close();
    await cocina.close();
  });

  test("E2E-08 IN_TABLE: llamar mesero → alerta en salón", async ({
    browser,
    baseURL,
  }) => {
    expect(baseURL).toContain(e2eEnv.tenantSlug);

    const ownerToken = await ownerApiLogin();
    await freeTableIfOccupied(ownerToken, E2E_TABLE);
    const { tableNumber, tableToken } = await signTableQr(
      ownerToken,
      E2E_TABLE,
    );
    const menuPath = buildTableMenuPath(tableNumber, tableToken);

    const customer = await browser.newContext({
      baseURL: e2eEnv.tenantBaseUrl,
    });
    const staff = await browser.newContext({
      baseURL: e2eEnv.tenantBaseUrl,
    });

    // Salón primero: las llamadas solo llegan por WS (no hay lista REST).
    const salonPage = await openSalonBoard(staff);
    await expect(salonPage).toHaveURL(/\/admin\/dashboard\/orders/);

    const customerPage = await customer.newPage();
    await customerPage.goto(menuPath);
    await expect(customerPage.getByTestId("table-help-fab")).toBeVisible({
      timeout: 30_000,
    });
    await customerCallWaiter(customerPage);

    const alerts = salonPage.getByTestId("table-call-alerts");
    await expect(alerts).toBeVisible({ timeout: 20_000 });
    await expect(alerts.getByTestId("table-call-alert").first()).toContainText(
      new RegExp(`Mesa\\s*${tableNumber}`, "i"),
    );
    await expect(alerts).toContainText(/Llaman al mesero/i);

    await customer.close();
    await staff.close();
  });

  test("E2E-09 IN_TABLE: unir mesas → label Mesa A-B", async ({
    browser,
    baseURL,
  }) => {
    expect(baseURL).toContain(e2eEnv.tenantSlug);

    const ownerToken = await ownerApiLogin();
    await freeTableIfOccupied(ownerToken, E2E_TABLE);
    await freeTableIfOccupied(ownerToken, E2E_TABLE_B);
    const a = await signTableQr(ownerToken, E2E_TABLE);
    const b = await signTableQr(ownerToken, E2E_TABLE_B);

    const customerA = await browser.newContext({
      baseURL: e2eEnv.tenantBaseUrl,
    });
    const customerB = await browser.newContext({
      baseURL: e2eEnv.tenantBaseUrl,
    });
    const staff = await browser.newContext({
      baseURL: e2eEnv.tenantBaseUrl,
    });

    const kitchen = await browser.newContext({
      baseURL: e2eEnv.tenantBaseUrl,
    });

    const pageA = await customerA.newPage();
    const pageB = await customerB.newPage();
    const orderA = await customerPlaceInTableOrder(
      pageA,
      buildTableMenuPath(a.tableNumber, a.tableToken),
    );
    const orderB = await customerPlaceInTableOrder(
      pageB,
      buildTableMenuPath(b.tableNumber, b.tableToken),
    );

    const salonPage = await openSalonBoard(staff);
    await expect(salonPage.getByTestId(`salon-order-${orderA}`)).toBeVisible({
      timeout: 30_000,
    });
    await expect(salonPage.getByTestId(`salon-order-${orderB}`)).toBeVisible({
      timeout: 30_000,
    });

    await mergeSalonTables(salonPage, E2E_TABLE, E2E_TABLE_B);

    const mergedLabel = new RegExp(`Mesa\\s*${E2E_TABLE}-${E2E_TABLE_B}`, "i");
    const primaryCard = salonPage.getByTestId(`salon-order-${orderA}`);
    await expect(primaryCard).toBeVisible({ timeout: 20_000 });
    await expect(primaryCard).toContainText(mergedLabel);
    await expect(salonPage.getByTestId(`salon-order-${orderB}`)).toHaveCount(0);

    const kitchenPage = await openKitchenBoard(kitchen);
    await kitchenPage.locator("#kitchen-tab-PENDING").click();
    const ticket = kitchenPage.locator(`#kitchen-ticket-${orderA}`);
    await expect(ticket).toBeVisible({ timeout: 20_000 });
    await expect(ticket).toContainText(mergedLabel);

    await customerA.close();
    await customerB.close();
    await staff.close();
    await kitchen.close();
  });

  test("E2E-10 DELIVERY: dirección → cocina A domicilio", async ({
    browser,
    baseURL,
  }) => {
    expect(baseURL).toContain(e2eEnv.tenantSlug);

    const address = "Av. Reforma 100, Roma Norte";
    const customer = await browser.newContext({
      baseURL: e2eEnv.tenantBaseUrl,
    });
    const kitchen = await browser.newContext({
      baseURL: e2eEnv.tenantBaseUrl,
    });

    const customerPage = await customer.newPage();
    const orderUuid = await customerPlaceDeliveryOrder(customerPage, address);

    const kitchenPage = await openKitchenBoard(kitchen);
    await kitchenPage.locator("#kitchen-tab-PENDING").click();
    const ticket = kitchenPage.locator(`#kitchen-ticket-${orderUuid}`);
    await expect(ticket).toBeVisible({ timeout: 30_000 });
    await expect(ticket).toContainText(/A domicilio/i);
    await expect(ticket).toContainText(address);

    await kitchenAdvanceOrder(kitchenPage, orderUuid, "PENDING");
    await expectTrackingStatus(customerPage, /Confirmado/i);

    await customer.close();
    await kitchen.close();
  });

  test("E2E-11 ABM menú: crear → toggle → borrar refleja en /menu", async ({
    browser,
    baseURL,
  }) => {
    expect(baseURL).toContain(e2eEnv.tenantSlug);

    const ownerToken = await ownerApiLogin();
    const productName = `E2E ABM ${Date.now()}`;
    const product = await createAdminProduct(ownerToken, {
      name: productName,
      price: 77,
      description: "ABM smoke",
    });

    const customer = await browser.newContext({
      baseURL: e2eEnv.tenantBaseUrl,
    });
    const admin = await browser.newContext({
      baseURL: e2eEnv.tenantBaseUrl,
    });

    try {
      const customerPage = await customer.newPage();
      await customerPage.goto("/menu");
      await expect(
        customerPage.getByTestId(`menu-product-${product.uuid}`),
      ).toBeVisible({ timeout: 30_000 });

      const adminPage = await admin.newPage();
      await kitchenLogin(adminPage);
      await adminPage.goto("/admin/dashboard/menu");
      const card = adminPage.getByTestId(`admin-product-${product.uuid}`);
      await expect(card).toBeVisible({ timeout: 30_000 });

      await card
        .getByTestId("admin-product-toggle")
        .getByRole("radio", { name: "Agotado" })
        .click();
      await expect(
        card.getByRole("radio", { name: "Agotado" }),
      ).toHaveAttribute("aria-checked", "true", { timeout: 15_000 });

      await customerPage.reload({ waitUntil: "domcontentloaded" });
      await expect(
        customerPage.getByTestId(`menu-product-${product.uuid}`),
      ).toHaveCount(0, { timeout: 20_000 });

      await card
        .getByTestId("admin-product-toggle")
        .getByRole("radio", { name: "En menú" })
        .click();
      await expect(
        card.getByRole("radio", { name: "En menú" }),
      ).toHaveAttribute("aria-checked", "true", { timeout: 15_000 });

      await customerPage.reload({ waitUntil: "domcontentloaded" });
      await expect(
        customerPage.getByTestId(`menu-product-${product.uuid}`),
      ).toBeVisible({ timeout: 20_000 });

      await card.getByTestId("admin-product-delete").click();
      await adminPage.getByTestId("confirm-dialog-confirm").click();
      await expect(card).toHaveCount(0, { timeout: 20_000 });

      await customerPage.reload({ waitUntil: "domcontentloaded" });
      await expect(
        customerPage.getByTestId(`menu-product-${product.uuid}`),
      ).toHaveCount(0, { timeout: 20_000 });
    } finally {
      await deleteAdminProduct(ownerToken, product.uuid).catch(() => undefined);
      await customer.close();
      await admin.close();
    }
  });

  test("E2E-12 Modificadores: obligatorio + subtotal", async ({
    browser,
    baseURL,
  }) => {
    expect(baseURL).toContain(e2eEnv.tenantSlug);

    const ownerToken = await ownerApiLogin();
    const productName = `E2E Mods ${Date.now()}`;
    const basePrice = 50;
    const delta = 15;
    const product = await createAdminProduct(ownerToken, {
      name: productName,
      price: basePrice,
    });
    await replaceProductModifiers(ownerToken, product.uuid, [
      {
        name: "Tamaño",
        minSelect: 1,
        maxSelect: 1,
        options: [
          { name: "Chico", priceDelta: 0 },
          { name: "Grande", priceDelta: delta },
        ],
      },
    ]);

    const customer = await browser.newContext({
      baseURL: e2eEnv.tenantBaseUrl,
    });

    try {
      const page = await customer.newPage();
      await page.goto("/menu");
      const card = page.getByTestId(`menu-product-${product.uuid}`);
      await expect(card).toBeVisible({ timeout: 30_000 });
      await card.getByTestId("menu-add-product").click();

      await page.getByTestId("product-add-confirm").click();
      await expect(page.getByTestId("product-add-error")).toContainText(
        /elige entre/i,
        { timeout: 10_000 },
      );

      await page.getByRole("button", { name: /Grande/i }).click();
      await page.getByTestId("product-add-confirm").click();

      await page.getByTestId("cart-open").click();
      await expect(page.getByText("Grande").first()).toBeVisible({
        timeout: 10_000,
      });
      const expected = new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: "MXN",
      }).format(basePrice + delta);
      await expect(page.getByTestId("cart-subtotal")).toHaveText(expected, {
        timeout: 10_000,
      });
    } finally {
      await deleteAdminProduct(ownerToken, product.uuid);
      await customer.close();
    }
  });

  test("E2E-13 Límite Basic: 21.º platillo rechazado", async ({
    browser,
    baseURL,
  }) => {
    expect(baseURL).toContain(e2eEnv.tenantSlug);

    const prefix = "E2E Limit ";
    const ownerToken = await ownerApiLogin();
    await deleteProductsByNamePrefix(ownerToken, prefix);

    try {
      setTenantPlan("BASIC");

      const existing = await listAdminProducts(ownerToken);
      const need = Math.max(0, BASIC_MAX_PRODUCTS - existing.length);
      for (let i = 0; i < need; i += 1) {
        await createAdminProduct(ownerToken, {
          name: `${prefix}${String(i).padStart(2, "0")}`,
          price: 10,
        });
      }

      const attempt = await tryCreateAdminProduct(ownerToken, {
        name: `${prefix}overflow`,
        price: 10,
      });
      expect(attempt.status).toBe(400);
      expect(attempt.error ?? attempt.raw).toContain(BASIC_PRODUCT_LIMIT_MESSAGE);

      const admin = await browser.newContext({
        baseURL: e2eEnv.tenantBaseUrl,
      });
      const adminPage = await admin.newPage();
      await kitchenLogin(adminPage);
      await adminPage.goto("/admin/dashboard/menu");
      await expect(adminPage.getByTestId("menu-plan-limit-banner")).toContainText(
        /20\/20/,
        { timeout: 20_000 },
      );
      await expect(adminPage.getByTestId("menu-new-product")).toBeDisabled();
      await admin.close();
    } finally {
      await deleteProductsByNamePrefix(ownerToken, prefix);
      setTenantPlan("PRO");
    }
  });

  test("E2E-13b Pro sin pago: tope free 20 platillos", async ({
    browser,
    baseURL,
  }) => {
    expect(baseURL).toContain(e2eEnv.tenantSlug);

    const prefix = "E2E Pending ";
    const ownerToken = await ownerApiLogin();
    await deleteProductsByNamePrefix(ownerToken, prefix);

    try {
      setTenantProPendingPayment();

      const existing = await listAdminProducts(ownerToken);
      const need = Math.max(0, BASIC_MAX_PRODUCTS - existing.length);
      for (let i = 0; i < need; i += 1) {
        await createAdminProduct(ownerToken, {
          name: `${prefix}${String(i).padStart(2, "0")}`,
          price: 10,
        });
      }

      const attempt = await tryCreateAdminProduct(ownerToken, {
        name: `${prefix}overflow`,
        price: 10,
      });
      expect(attempt.status).toBe(400);
      expect(attempt.error ?? attempt.raw).toContain(BASIC_PRODUCT_LIMIT_MESSAGE);

      const admin = await browser.newContext({
        baseURL: e2eEnv.tenantBaseUrl,
      });
      const adminPage = await admin.newPage();
      await kitchenLogin(adminPage);
      await adminPage.goto("/admin/dashboard/menu");
      await expect(adminPage.getByTestId("menu-plan-limit-banner")).toContainText(
        /Pro sin activar:\s*20\/20/,
        { timeout: 20_000 },
      );
      await expect(adminPage.getByTestId("menu-new-product")).toBeDisabled();
      await admin.close();
    } finally {
      await deleteProductsByNamePrefix(ownerToken, prefix);
      setTenantPlan("PRO");
    }
  });

  test("E2E-13c Pro vencido: tope free tras current_period_end", async ({
    browser,
    baseURL,
  }) => {
    expect(baseURL).toContain(e2eEnv.tenantSlug);

    const prefix = "E2E Expired ";
    const ownerToken = await ownerApiLogin();
    await deleteProductsByNamePrefix(ownerToken, prefix);

    try {
      setTenantPlan("PRO");
      setTenantCurrentPeriodEnd(new Date(Date.now() - 60_000).toISOString());

      const existing = await listAdminProducts(ownerToken);
      const need = Math.max(0, BASIC_MAX_PRODUCTS - existing.length);
      for (let i = 0; i < need; i += 1) {
        await createAdminProduct(ownerToken, {
          name: `${prefix}${String(i).padStart(2, "0")}`,
          price: 10,
        });
      }

      const attempt = await tryCreateAdminProduct(ownerToken, {
        name: `${prefix}overflow`,
        price: 10,
      });
      expect(attempt.status).toBe(400);
      expect(attempt.error ?? attempt.raw).toContain(BASIC_PRODUCT_LIMIT_MESSAGE);

      const admin = await browser.newContext({
        baseURL: e2eEnv.tenantBaseUrl,
      });
      const adminPage = await admin.newPage();
      await kitchenLogin(adminPage);
      await adminPage.goto("/admin/dashboard/menu");
      await expect(adminPage.getByTestId("menu-plan-limit-banner")).toContainText(
        /Pro vencido:\s*20\/20/,
        { timeout: 20_000 },
      );
      await expect(adminPage.getByTestId("menu-new-product")).toBeDisabled();
      await admin.close();
    } finally {
      await deleteProductsByNamePrefix(ownerToken, prefix);
      setTenantPlan("PRO");
    }
  });
});
