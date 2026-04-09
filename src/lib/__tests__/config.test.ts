import { siteConfig, SITE_URL, SITE_NAME, getFullUrl } from "../config";

describe("Site Configuration", () => {
  it("should have correct site name", () => {
    expect(SITE_NAME).toBe("LockSafe UK");
  });

  it("should have a valid site URL", () => {
    expect(SITE_URL).toMatch(/^https?:\/\//);
  });

  it("should generate full URLs correctly", () => {
    const url = getFullUrl("/about");
    expect(url).toContain("/about");
    expect(url).toMatch(/^https?:\/\//);
  });

  it("should handle paths without leading slash", () => {
    const url = getFullUrl("about");
    expect(url).toContain("/about");
  });

  it("should have support email configured", () => {
    expect(siteConfig.supportEmail).toBeTruthy();
    expect(siteConfig.supportEmail).toContain("@");
  });

  it("should have phone number configured", () => {
    expect(siteConfig.phone).toBeTruthy();
  });
});
