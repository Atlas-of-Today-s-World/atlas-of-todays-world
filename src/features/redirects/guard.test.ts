import { beforeEach, describe, expect, it, vi } from "vitest";

import { guardedLayout } from "./guard";

const { redirectOrNotFound } = vi.hoisted(() => ({
  redirectOrNotFound: vi.fn(async (path: string, locale: string): Promise<never> => {
    throw new Error(`redirect-or-404 ${path} ${locale}`);
  }),
}));
vi.mock("./queries", () => ({ redirectOrNotFound }));

const params = <T extends object>(value: T) => Promise.resolve({ locale: "en", ...value });

describe("guardedLayout", () => {
  beforeEach(() => {
    redirectOrNotFound.mockClear();
  });

  it("renders the page when the slug exists", async () => {
    const exists = vi.fn(async () => true);
    const Layout = guardedLayout(exists, (slug) => `/region/${slug}`);
    await expect(Layout({ children: "page", params: params({ slug: "europe" }) })).resolves.toBe(
      "page",
    );
    expect(exists).toHaveBeenCalledWith("europe", "en");
    expect(redirectOrNotFound).not.toHaveBeenCalled();
  });

  it("hands an unknown slug to the redirect lookup with its public path and language", async () => {
    const Layout = guardedLayout(
      async () => false,
      (slug) => `/region/${slug}`,
    );
    await expect(Layout({ children: "page", params: params({ slug: "old" }) })).rejects.toThrow(
      "redirect-or-404 /region/old en",
    );
  });

  it("reads a differently named segment", async () => {
    const exists = vi.fn(async () => false);
    const Layout = guardedLayout(exists, (id) => `/view/${id}`, "indicator");
    await expect(
      Layout({ children: "page", params: params({ indicator: "hdi" }) }),
    ).rejects.toThrow("redirect-or-404 /view/hdi en");
    expect(exists).toHaveBeenCalledWith("hdi", "en");
  });
});
