import { describe, expect, it } from "vitest";
import {
  BASIC_MAX_PRODUCTS,
  BASIC_PRODUCT_LIMIT_UPGRADE_MESSAGE,
  basicImportWouldExceedMessage,
  hasUnlimitedMenu,
  isPeriodExpired,
} from "./subscription-plan";

describe("subscription-plan menu limits", () => {
  it("caps free tier at 20 products", () => {
    expect(BASIC_MAX_PRODUCTS).toBe(20);
    expect(BASIC_PRODUCT_LIMIT_UPGRADE_MESSAGE).toContain("20");
  });

  it("grants unlimited menu only for Pro with active payment", () => {
    expect(hasUnlimitedMenu("BASIC", "ACTIVE")).toBe(false);
    expect(hasUnlimitedMenu("PRO", "PENDING_PAYMENT")).toBe(false);
    expect(hasUnlimitedMenu("PRO", "ACTIVE")).toBe(true);
    expect(hasUnlimitedMenu("PRO", "ACTIVE", null)).toBe(true);
  });

  it("revokes unlimited menu when currentPeriodEnd has passed", () => {
    const expired = new Date(Date.now() - 60_000).toISOString();
    const future = new Date(Date.now() + 86_400_000).toISOString();
    expect(isPeriodExpired(expired)).toBe(true);
    expect(isPeriodExpired(future)).toBe(false);
    expect(isPeriodExpired(null)).toBe(false);
    expect(hasUnlimitedMenu("PRO", "ACTIVE", expired)).toBe(false);
    expect(hasUnlimitedMenu("PRO", "ACTIVE", future)).toBe(true);
  });

  it("builds import exceed message with current and file counts", () => {
    expect(basicImportWouldExceedMessage(18, 3)).toContain("18");
    expect(basicImportWouldExceedMessage(18, 3)).toContain("3");
    expect(basicImportWouldExceedMessage(18, 3)).toContain("20");
  });
});
