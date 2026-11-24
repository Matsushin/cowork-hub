import { describe, expect, it } from "vitest";
import { addUsage, costMicroUsd, emptyUsage } from "./usage";

describe("costMicroUsd", () => {
  it("100万トークンあたりの料金から、米ドル×100万の整数にする", () => {
    // 入力 $4・出力 $20・キャッシュ読み $0.20・キャッシュ書き $5（100万トークンあたり）
    const usage = { input_tokens: 1000, output_tokens: 500, cache_read_input_tokens: 2000, cache_creation_input_tokens: 100 };
    // 4000 + 10000 + 400 + 500 = 14900（＝ $0.0149）
    expect(costMicroUsd("claude-opus-5-5", usage)).toBe(14900);
  });
});

describe("addUsage", () => {
  it("回ごとの usage を足す（キャッシュの値が null でも 0 として扱う）", () => {
    const total = addUsage(addUsage(emptyUsage(), { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: null }), {
      input_tokens: 3,
      output_tokens: 2,
      cache_read_input_tokens: 7,
      cache_creation_input_tokens: 1,
    });
    expect(total).toEqual({ input_tokens: 13, output_tokens: 7, cache_read_input_tokens: 7, cache_creation_input_tokens: 1 });
  });
});
