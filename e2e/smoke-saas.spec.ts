import { test, expect } from "@playwright/test";
import { e2eEnv, tenantBaseUrl } from "./fixtures/env";
import {
  clearCouponRedemption,
  ownerApiLogin,
  resetRegistrationRateLimit,
  resolveSuperadminPassword,
  setTenantPlan,
  updateRestaurantProfile,
} from "./fixtures/api";

test.describe("smoke saas / calidad", () => {
  test("E2E-14 Registro onboarding: landing → slug → login admin", async ({
    browser,
  }) => {
    test.setTimeout(180_000);
    // Rate limit de registro es in-memory; limpia ventana de intentos previos de E2E.
    await resetRegistrationRateLimit();

    const stamp = Date.now().toString(36);
    const tenantSlug = `e2ereg${stamp}`.slice(0, 40);
    const ownerEmail = `e2e-ui-${stamp}@platolisto.test`;
    const ownerPassword = e2eEnv.ownerPassword;

    const page = await browser.newPage({ baseURL: e2eEnv.feOrigin });
    await page.goto("/#registro");
    await expect(page.getByRole("radiogroup", { name: /Plan/i })).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole("radio", { name: /Básico/i }).click();
    await page.getByRole("button", { name: /^Continuar$/i }).click();

    await page.locator('input[name="restaurantName"]').fill(`E2E UI ${stamp}`);
    await page.locator('input[name="tenantSlug"]').fill(tenantSlug);
    await page.getByRole("button", { name: /^Continuar$/i }).click();

    await page.locator('input[name="ownerName"]').fill("E2E UI Owner");
    await page.locator('input[name="ownerEmail"]').fill(ownerEmail);
    await page.locator('input[name="ownerPassword"]').fill(ownerPassword);
    await page
      .locator("#registro")
      .getByRole("button", { name: "Crear mi restaurante", exact: true })
      .click();

    await expect(
      page.getByRole("heading", {
        name: /Tu restaurante ha sido creado con éxito/i,
      }),
    ).toBeVisible({ timeout: 45_000 });

    const admin = await browser.newContext({
      baseURL: tenantBaseUrl(tenantSlug),
    });
    const adminPage = await admin.newPage();
    await adminPage.goto("/admin/login");
    await adminPage.locator('input[name="email"]').fill(ownerEmail);
    await adminPage.locator('input[name="password"]').fill(ownerPassword);
    await adminPage.getByRole("button", { name: /Entrar a cocina/i }).click();
    await expect(adminPage).toHaveURL(/\/admin\/dashboard/, { timeout: 30_000 });

    await page.close();
    await admin.close();
  });

  test("E2E-15 Cupón Pro: redeem → ACTIVE → pickup", async ({ browser }) => {
    // Evita rate-limit de registro: demote e2esmoke + limpia canje del cupón demo.
    clearCouponRedemption(e2eEnv.couponProDemo);
    setTenantPlan("BASIC");

    const token = await ownerApiLogin();
    const admin = await browser.newContext({
      baseURL: e2eEnv.tenantBaseUrl,
    });

    try {
      const page = await admin.newPage();
      await page.goto("/admin/login");
      await page.locator('input[name="email"]').fill(e2eEnv.ownerEmail);
      await page.locator('input[name="password"]').fill(e2eEnv.ownerPassword);
      await page.getByRole("button", { name: /Entrar a cocina/i }).click();
      await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 30_000 });

      await page.goto("/admin/dashboard/settings");
      await page.getByTestId("settings-coupon-input").fill(e2eEnv.couponProDemo);
      await page.getByTestId("settings-coupon-redeem").click();
      await expect(page.getByTestId("settings-coupon-success")).toContainText(
        /Cupón aplicado|Plan Pro|activo/i,
        { timeout: 20_000 },
      );

      await updateRestaurantProfile(token, {
        orderingEnabled: true,
        hasPickup: true,
        hasDelivery: true,
      });
    } finally {
      setTenantPlan("PRO");
      await updateRestaurantProfile(token, {
        orderingEnabled: true,
        hasPickup: true,
        hasDelivery: true,
      }).catch(() => undefined);
      await admin.close();
    }
  });

  test("E2E-16 Pedido no encontrado: UUID inválido → empty", async ({
    browser,
  }) => {
    const customer = await browser.newContext({
      baseURL: e2eEnv.tenantBaseUrl,
    });
    const page = await customer.newPage();
    await page.goto("/orders/00000000-0000-4000-8000-000000000099");

    const empty = page.getByTestId("order-unavailable");
    await expect(empty).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("order-unavailable-title")).toHaveText(
      /Pedido no disponible/i,
    );
    await expect(empty).toContainText(/No encontramos este pedido/i);
    await expect(page.getByRole("button", { name: /Reintentar/i })).toHaveCount(
      0,
    );
    await page.getByTestId("order-unavailable-menu-link").click();
    await expect(page).toHaveURL(/\/menu/, { timeout: 15_000 });

    await customer.close();
  });

  test("E2E-17 Menú sin ordering: sin Agregar + footer consulta", async ({
    browser,
  }) => {
    const token = await ownerApiLogin();
    const customer = await browser.newContext({
      baseURL: e2eEnv.tenantBaseUrl,
    });

    try {
      await updateRestaurantProfile(token, { orderingEnabled: false });

      const page = await customer.newPage();
      await page.goto("/menu");
      await expect(page.getByTestId("menu-consulta-footer")).toContainText(
        /Solo consulta · pedidos desactivados/i,
        { timeout: 30_000 },
      );
      await expect(page.getByTestId("menu-add-product")).toHaveCount(0);
      await expect(page.getByTestId("cart-open")).toHaveCount(0);
    } finally {
      await updateRestaurantProfile(token, {
        orderingEnabled: true,
        hasPickup: true,
        hasDelivery: true,
      });
      await customer.close();
    }

    // Smoke: ordering restaurado → Agregar vuelve.
    const check = await browser.newContext({
      baseURL: e2eEnv.tenantBaseUrl,
    });
    const page = await check.newPage();
    await page.goto("/menu");
    await expect(page.getByTestId("menu-add-product").first()).toBeVisible({
      timeout: 30_000,
    });
    await check.close();
  });

  test("E2E-18 Impersonación SuperAdmin: handoff read-only", async ({
    browser,
  }) => {
    test.skip(e2eEnv.skipSuperadmin, "E2E_SKIP_SUPERADMIN=1");

    const password = await resolveSuperadminPassword();
    test.skip(
      !password,
      "Sin SuperAdmin usable (define E2E_SUPERADMIN_PASSWORD o bootstrap local)",
    );

    const sa = await browser.newContext({ baseURL: e2eEnv.feOrigin });
    const page = await sa.newPage();
    await page.goto("/superadmin/login");
    await page.getByLabel("Correo").fill(e2eEnv.superadminEmail);
    await page.getByLabel("Contraseña").fill(password!);
    await page.getByTestId("superadmin-login-submit").click();
    await expect(page).not.toHaveURL(/\/superadmin\/login/, { timeout: 30_000 });
    await expect(page).toHaveURL(/\/superadmin/, { timeout: 10_000 });

    await page.goto("/superadmin/tenants");
    await expect(page).not.toHaveURL(/\/superadmin\/login/, { timeout: 20_000 });
    await expect(page.getByLabel(/Buscar restaurantes/i)).toBeVisible({
      timeout: 20_000,
    });
    await page.getByLabel(/Buscar restaurantes/i).fill(e2eEnv.tenantSlug);

    const row = page.locator("tr").filter({ hasText: e2eEnv.tenantSlug });
    await expect(row.getByRole("button", { name: /Gestionar/i })).toBeVisible({
      timeout: 20_000,
    });
    await row.getByRole("button", { name: /Gestionar/i }).click();

    const impersonate = page
      .locator("table")
      .getByTestId(`sa-tenant-impersonate-${e2eEnv.tenantSlug}`);
    await expect(impersonate).toBeVisible({ timeout: 15_000 });

    await impersonate.click();
    await page.getByTestId("sa-confirm-challenge").fill(e2eEnv.tenantSlug);

    // Si Playwright deja abrir el popup, ese es el handoff (un solo canje).
    // Si el navegador lo bloquea, canjeamos el code nosotros con Origin del tenant.
    const popupPromise = page
      .context()
      .waitForEvent("page", { timeout: 12_000 })
      .catch(() => null);
    const responsePromise = page.waitForResponse(
      (res) =>
        res.url().includes("/impersonate") &&
        res.request().method() === "POST" &&
        res.ok(),
    );
    await page.getByTestId("sa-confirm-submit").click();
    const [response, popup] = await Promise.all([
      responsePromise,
      popupPromise,
    ]);
    const body = (await response.json()) as {
      code?: string;
      tenantSlug?: string;
    };
    expect(body.code?.trim()).toBeTruthy();

    const slug = body.tenantSlug ?? e2eEnv.tenantSlug;
    const code = body.code!.trim();

    let supportPage = popup;
    let ownedContext = null as Awaited<
      ReturnType<typeof browser.newContext>
    > | null;

    if (!supportPage) {
      ownedContext = await browser.newContext({
        baseURL: tenantBaseUrl(slug),
      });
      supportPage = await ownedContext.newPage();
      await supportPage.goto("/admin/login");
      const exchange = await supportPage.evaluate(
        async ({ handoffCode, tenantSlug }) => {
          const res = await fetch("/api/auth/impersonate", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
              "x-tenant-slug": tenantSlug,
            },
            body: JSON.stringify({ code: handoffCode }),
            credentials: "same-origin",
          });
          const text = await res.text();
          return { ok: res.ok, status: res.status, text };
        },
        { handoffCode: code, tenantSlug: slug },
      );
      expect(
        exchange.ok,
        `Canje impersonate falló (${exchange.status}): ${exchange.text}`,
      ).toBeTruthy();
      await supportPage.goto("/admin/dashboard");
    }

    await expect(supportPage).toHaveURL(/\/admin\/dashboard/, {
      timeout: 30_000,
    });
    const banner = supportPage.getByTestId("admin-support-banner");
    await expect(banner).toBeVisible({ timeout: 30_000 });
    await expect(banner).toContainText(/Sesión de soporte · solo lectura/i);
    await expect(banner).toContainText(/No puedes guardar cambios/i);

    if (ownedContext) await ownedContext.close();
    await sa.close();
  });
});
