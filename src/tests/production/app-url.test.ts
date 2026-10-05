import { describe, expect, it, vi, afterEach } from "vitest";
import { absoluteUrl, authCallbackUrl, getAppUrl } from "@/lib/app-url";

describe("app-url", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("usa NEXT_PUBLIC_APP_URL quando definido", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.sorria.com.br/");
    expect(getAppUrl()).toBe("https://app.sorria.com.br");
    expect(absoluteUrl("/login")).toBe("https://app.sorria.com.br/login");
    expect(authCallbackUrl()).toBe("https://app.sorria.com.br/auth/callback");
  });

  it("cai em localhost sem APP_URL", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("VERCEL_URL", "");
    expect(getAppUrl()).toBe("http://localhost:3000");
  });

  it("usa VERCEL_URL como fallback", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("VERCEL_URL", "sorria-staging.vercel.app");
    expect(getAppUrl()).toBe("https://sorria-staging.vercel.app");
  });
});
