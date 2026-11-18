import { describe, expect, it } from "vitest";
import { secondsLeft } from "./countdown";

describe("secondsLeft", () => {
  it("残り秒数を切り上げで返す", () => {
    expect(secondsLeft(60_000, 0)).toBe(60);
    expect(secondsLeft(60_000, 1)).toBe(60);
    expect(secondsLeft(60_000, 59_001)).toBe(1);
  });

  it("締め切りちょうど・過ぎたら0", () => {
    expect(secondsLeft(60_000, 60_000)).toBe(0);
    expect(secondsLeft(60_000, 61_000)).toBe(0);
  });
});
