import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { siteCopy } from "@/content/site";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => createElement("a", { href, ...props }, children),
}));

import NotFound from "@/app/not-found";

describe("not-found page", () => {
  it("exposes a main landmark (PageMain, not a bare div)", () => {
    render(createElement(NotFound));
    const main = screen.getByRole("main");
    expect(main).toBeInTheDocument();
    expect(main).toHaveAttribute("id", "main-content");
    expect(
      screen.getByRole("heading", { name: siteCopy.notFound.title }),
    ).toBeInTheDocument();
  });
});
