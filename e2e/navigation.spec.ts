import { test, expect } from "@playwright/test";

test.describe("Navigation", () => {
  test("homepage loads successfully", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/LockSafe/);
  });

  test("services page loads", async ({ page }) => {
    await page.goto("/services");
    await expect(page.locator("main h1").first()).toBeVisible();
  });

  test("pricing page loads", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.locator("h1")).toContainText("Before Work Starts");
  });

  test("about page loads", async ({ page }) => {
    await page.goto("/about");
    await expect(page.locator("h1")).toBeVisible();
  });

  test("contact page loads", async ({ page }) => {
    await page.goto("/contact");
    await expect(page.locator("h1")).toContainText("Contact");
  });

  test("how-it-works page loads", async ({ page }) => {
    await page.goto("/how-it-works");
    await expect(page.locator("h1")).toContainText("LockSafe");
  });

  test("for-locksmiths page loads", async ({ page }) => {
    await page.goto("/for-locksmiths");
    await expect(page.locator("h1")).toContainText("LockSafe");
  });
});

test.describe("Header Navigation", () => {
  test("header contains main navigation links", async ({ page }) => {
    await page.goto("/");
    const header = page.locator("header").first();
    await expect(header.getByRole("navigation").first()).toBeVisible();
    await expect(header.getByRole("link", { name: "How It Works", exact: true })).toBeVisible();
    await expect(header.getByRole("link", { name: "Services", exact: true })).toBeVisible();
    await expect(header.getByRole("link", { name: "Pricing", exact: true })).toBeVisible();
  });

  test("emergency help button is visible", async ({ page }) => {
    await page.goto("/");
    const header = page.locator("header").first();
    await expect(
      header.getByRole("link", { name: /Get Emergency Help|Emergency Help|Help Now/i }).first(),
    ).toBeVisible();
  });
});
