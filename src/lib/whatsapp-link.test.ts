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

    it("rejects UK mobile with wrong digit count (10 digits — missing a digit)", () => {
      // Exact regression: locksmith profile had '0754251379' (10 digits) which
      // produced a `whatsapp://send?phone=0754251379` link that WhatsApp Mac
      // bounced with "This link couldn't be opened."
      expect(normalisePhoneForWa("0754251379")).toBeNull();
    });

    it("rejects UK landlines (only mobiles are supported for WhatsApp)", () => {
      expect(normalisePhoneForWa("0207 946 0000")).toBeNull();
      expect(normalisePhoneForWa("01234 567890")).toBeNull();
    });

    it("rejects empty / null / whitespace", () => {
      expect(normalisePhoneForWa("")).toBeNull();
      expect(normalisePhoneForWa("   ")).toBeNull();
      expect(normalisePhoneForWa(null)).toBeNull();
      expect(normalisePhoneForWa(undefined)).toBeNull();
    });

    it("accepts non-UK international numbers", () => {
      expect(normalisePhoneForWa("+1 555 123 4567")).toBe("15551234567");
      expect(normalisePhoneForWa("33612345678")).toBe("33612345678");
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