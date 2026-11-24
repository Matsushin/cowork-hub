import { describe, expect, it } from "vitest";
import { requiresLogin } from "./login-required";

describe("requiresLogin", () => {
  it("会員・管理者のページはログインが必要", () => {
    for (const path of [
      "/assistant",
      "/visits",
      "/visits/1",
      "/reservations",
      "/billing",
      "/profile",
      "/admin",
      "/admin/locations/1/qr",
      "/checkin",
      "/locations/3/reserve",
    ]) {
      expect(requiresLogin(path), path).toBe(true);
    }
  });

  it("公開ページは不要", () => {
    for (const path of ["/", "/login", "/signup", "/locations", "/locations/3", "/visitsx", "/checkin-guide", "/healthz"]) {
      expect(requiresLogin(path), path).toBe(false);
    }
  });
});
