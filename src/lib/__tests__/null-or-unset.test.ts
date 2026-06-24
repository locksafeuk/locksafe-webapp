import { nullOrUnset } from "@/lib/db";

describe("nullOrUnset", () => {
  it("builds an OR matching both present-null and missing (isSet:false)", () => {
    expect(nullOrUnset("email")).toEqual({
      OR: [{ email: null }, { email: { isSet: false } }],
    });
  });

  it("uses the given field name", () => {
    expect(nullOrUnset("winBackSentAt")).toEqual({
      OR: [{ winBackSentAt: null }, { winBackSentAt: { isSet: false } }],
    });
  });

  it("spreads into a where without clobbering sibling conditions", () => {
    const where = { status: "new", phone: { not: null }, ...nullOrUnset("email") };
    expect(where).toEqual({
      status: "new",
      phone: { not: null },
      OR: [{ email: null }, { email: { isSet: false } }],
    });
  });
});
