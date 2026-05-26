/**
 * TelLinkAttribution — global tel: click listener tests.
 *
 * Pins the contract:
 *   • Fires recordCallIntent on tel: anchor click (anywhere in tree)
 *   • Walks ancestor chain — works for nested <a><span>text</span></a>
 *   • Picks up data-call-id from anchor OR its ancestors
 *   • Falls back to anchor id when no data-call-id present
 *   • Ignores non-tel anchors and non-anchor elements
 *   • Cleans up the listener on unmount
 */

const recordSpy = jest.fn();

jest.mock("@/lib/marketing/click-to-call", () => ({
  __esModule: true,
  recordCallIntent: (...args: unknown[]) => recordSpy(...args),
}));

import { render, fireEvent, cleanup } from "@testing-library/react";
import { TelLinkAttribution } from "@/components/marketing/TelLinkAttribution";

beforeEach(() => {
  recordSpy.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("TelLinkAttribution — listener wiring", () => {
  it("records intent when a tel: anchor is clicked directly", () => {
    render(
      <>
        <TelLinkAttribution />
        <a href="tel:+442045771989" data-testid="cta">Call Us</a>
      </>,
    );
    const link = document.querySelector('a[href="tel:+442045771989"]')!;
    fireEvent.click(link);
    expect(recordSpy).toHaveBeenCalledTimes(1);
    expect(recordSpy.mock.calls[0][1]).toBe("website_call_button");
  });

  it("picks up data-call-id from the anchor", () => {
    render(
      <>
        <TelLinkAttribution />
        <a href="tel:+442045771989" data-call-id="hero">Call</a>
      </>,
    );
    fireEvent.click(document.querySelector('a[href^="tel:"]')!);
    expect(recordSpy.mock.calls[0][0]).toBe("hero");
  });

  it("walks ancestor chain to find data-call-id when nested", () => {
    render(
      <>
        <TelLinkAttribution />
        <div data-call-id="sticky-footer">
          <a href="tel:+442045771989">
            <span>Call Now</span>
          </a>
        </div>
      </>,
    );
    // Click on the nested span — listener walks up to find the anchor,
    // then walks up further to find the data-call-id on the container
    fireEvent.click(document.querySelector("span")!);
    expect(recordSpy).toHaveBeenCalledTimes(1);
    expect(recordSpy.mock.calls[0][0]).toBe("sticky-footer");
  });

  it("falls back to anchor id when no data-call-id present", () => {
    render(
      <>
        <TelLinkAttribution />
        <a href="tel:+442045771989" id="header-cta">Call</a>
      </>,
    );
    fireEvent.click(document.querySelector('a[href^="tel:"]')!);
    expect(recordSpy.mock.calls[0][0]).toBe("header-cta");
  });

  it("does not fire for non-tel anchors", () => {
    render(
      <>
        <TelLinkAttribution />
        <a href="https://locksafe.uk/book">Book online</a>
      </>,
    );
    fireEvent.click(document.querySelector("a")!);
    expect(recordSpy).not.toHaveBeenCalled();
  });

  it("does not fire when clicking outside any anchor", () => {
    render(
      <>
        <TelLinkAttribution />
        <button>Not an anchor</button>
        <a href="tel:+442045771989">Call</a>
      </>,
    );
    fireEvent.click(document.querySelector("button")!);
    expect(recordSpy).not.toHaveBeenCalled();
  });

  it("recognises tel: case-insensitively (TEL:, Tel:, tel:)", () => {
    render(
      <>
        <TelLinkAttribution />
        <a href="TEL:+442045771989" data-testid="upper">Call</a>
      </>,
    );
    fireEvent.click(document.querySelector('a[href^="TEL:"]')!);
    expect(recordSpy).toHaveBeenCalledTimes(1);
  });

  it("removes the listener on unmount", () => {
    const { unmount } = render(
      <>
        <TelLinkAttribution />
        <a href="tel:+442045771989">Call</a>
      </>,
    );
    unmount();
    // After unmount: clicking the still-existing anchor (added directly
    // to document body by jsdom) does not fire intent
    const stray = document.createElement("a");
    stray.href = "tel:+442045771989";
    document.body.appendChild(stray);
    fireEvent.click(stray);
    expect(recordSpy).not.toHaveBeenCalled();
    document.body.removeChild(stray);
  });
});
