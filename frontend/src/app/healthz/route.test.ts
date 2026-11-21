import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /healthz", () => {
  it("Rails に問い合わせずに 200 を返す", async () => {
    const res = GET();
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok");
  });
});
