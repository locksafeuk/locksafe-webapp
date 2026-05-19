import { maskSensitiveText } from "@/lib/retell-dataset";

describe("retell dataset masking", () => {
  it("masks phone numbers", () => {
    const input = "Call me on +44 7700 900123 when the locksmith arrives.";
    const masked = maskSensitiveText(input);

    expect(masked).toContain("[PHONE]");
    expect(masked).not.toContain("7700");
  });

  it("masks emails and postcodes", () => {
    const input = "Email john.smith@example.com and meet at SW1A 1AA.";
    const masked = maskSensitiveText(input);

    expect(masked).toContain("[EMAIL]");
    expect(masked).toContain("[POSTCODE]");
    expect(masked).not.toContain("example.com");
    expect(masked).not.toContain("SW1A 1AA");
  });

  it("masks simple address-like fragments", () => {
    const input = "The caller said 221 Baker Street and asked for urgent dispatch.";
    const masked = maskSensitiveText(input);

    expect(masked).toContain("[ADDRESS]");
    expect(masked).not.toContain("221 Baker Street");
  });
});