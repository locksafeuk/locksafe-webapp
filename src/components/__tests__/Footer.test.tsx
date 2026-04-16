/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { Footer } from "../layout/Footer";

jest.mock("next/link", () => {
  return ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  );
});

describe("Footer Component", () => {
  it("renders LockSafe branding", () => {
    render(<Footer />);
    expect(screen.getByText("Safe")).toBeInTheDocument();
  });

  it("renders company links", () => {
    render(<Footer />);
    expect(screen.getByText("About Us")).toBeInTheDocument();
    expect(screen.getByText("Services")).toBeInTheDocument();
    expect(screen.getByText("Pricing")).toBeInTheDocument();
  });

  it("renders contact information", () => {
    render(<Footer />);
    expect(screen.getByText("07818 333 989")).toBeInTheDocument();
  });

  it("renders legal links", () => {
    render(<Footer />);
    expect(screen.getByText("Terms & Conditions")).toBeInTheDocument();
    expect(screen.getByText("Privacy Policy")).toBeInTheDocument();
  });
});
