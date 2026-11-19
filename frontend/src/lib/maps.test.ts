import { describe, expect, it } from "vitest";
import { googleMapsUrl } from "./maps";

const base = "https://www.google.com/maps/search/?api=1&query=";

describe("googleMapsUrl", () => {
  it("都道府県と住所をつなげて日本語をエンコードする", () => {
    expect(googleMapsUrl("東京都", "渋谷区1-2-3")).toBe(`${base}${encodeURIComponent("東京都渋谷区1-2-3")}`);
    expect(googleMapsUrl("東京都", "渋谷区")).toContain("%E6%9D%B1%E4%BA%AC%E9%83%BD");
  });

  it("スペースをエンコードする", () => {
    expect(googleMapsUrl("大阪府", "北区 梅田 1-1")).toBe(
      `${base}%E5%A4%A7%E9%98%AA%E5%BA%9C%E5%8C%97%E5%8C%BA%20%E6%A2%85%E7%94%B0%201-1`,
    );
  });

  it("URLの区切りになる記号をエンコードする", () => {
    const url = googleMapsUrl("東京都", "A&B#ビル?/x=1+2");
    expect(url.slice(base.length)).not.toMatch(/[&#?/=+ ]/);
    expect(url.slice(base.length)).toContain("%26");
    expect(url.slice(base.length)).toContain("%23");
  });
});
