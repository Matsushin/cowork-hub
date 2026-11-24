import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-error";
import { GENERATED_TOOLS } from "./generated-tools";
import { executeTool } from "./tools";

vi.mock("server-only", () => ({}));

const getLocation = GENERATED_TOOLS.booking.find((t) => t.name === "get_location")!;

describe("executeTool", () => {
  it("会員のトークンで Rails API を呼び、結果を JSON の文字列で返す", async () => {
    const fetcher = vi.fn().mockResolvedValue({ id: 3, name: "渋谷" });
    expect(await executeTool(getLocation, { id: 3 }, fetcher)).toBe('{"id":3,"name":"渋谷"}');
    expect(fetcher).toHaveBeenCalledWith("/locations/3");
  });

  it("引数の誤り・API のエラーは、AI が読める error として返す（例外にしない）", async () => {
    const fetcher = vi.fn().mockRejectedValue(new ApiError(404, "見つかりません"));
    expect(JSON.parse(await executeTool(getLocation, { id: 999 }, fetcher))).toEqual({ error: "見つかりません", status: 404 });
    expect(JSON.parse(await executeTool(getLocation, { id: "x" }, fetcher))).toEqual({
      error: "id は正の整数で指定してください",
    });
  });

  it("結果が長すぎるときは打ち切って、条件を絞るよう返す", async () => {
    const fetcher = vi.fn().mockResolvedValue({ big: "あ".repeat(30_000) });
    expect(JSON.parse(await executeTool(getLocation, { id: 1 }, fetcher)).error).toContain("条件を絞って");
  });
});
