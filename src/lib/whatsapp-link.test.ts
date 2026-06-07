import { buildWhatsAppUrl, normalisePhoneForWa } from "@/lib/whatsapp-link";

describe("whatsapp-link", () => {
  describe("normalisePhoneForWa", () => {
    it("normalises UK mobile numbers that start with 07", () => {
      expect(normalisePhoneForWa("07818 333989")).toBe("447818333989");
    });

    it("keeps international numbers without the plus sign", () => {
      expect(normalisePhoneForWa("+447818333989")).toBe("447818333989");
    });

    it("returns null for invalid inputs", () => {
      expect(normalisePhoneForWa("abc")).toBeNull();
    });
  });

  describe("buildWhatsAppUrl", () => {
    it("builds the WhatsApp app deep-link URL", () => {
      expect(buildWhatsAppUrl("07818 333989", "Hi LockSafe")).toBe(
        "whatsapp://send?phone=447818333989&text=Hi+LockSafe",
      );
    });

    it("returns null when the phone cannot be normalised", () => {
      expect(buildWhatsAppUrl("", "Hi")).toBeNull();
    });
  });
});