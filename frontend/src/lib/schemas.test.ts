import { describe, expect, it } from "vitest";
import { z } from "zod";
import { locationSchema, profileSchema, signupSchema, spaceSchema } from "./schemas";

const fieldErrors = (result: { error?: z.ZodError }): Record<string, string[] | undefined> =>
  result.error ? z.flattenError(result.error).fieldErrors : {};

describe("signupSchema", () => {
  it("正しい入力を受け付ける", () => {
    expect(signupSchema.safeParse({ name: "会員", email_address: "a@example.com", password: "password123" }).success).toBe(true);
  });

  it("項目ごとに日本語のエラーを返す", () => {
    const errors = fieldErrors(signupSchema.safeParse({ name: " ", email_address: "invalid", password: "short" }));
    expect(errors).toEqual({
      name: ["名前を入力してください"],
      email_address: ["メールアドレスの形式が正しくありません"],
      password: ["パスワードは8文字以上で入力してください"],
    });
  });
});

describe("profileSchema", () => {
  it("パスワードは空欄なら変更しない扱いで通る", () => {
    expect(profileSchema.safeParse({ name: "会員", email_address: "a@example.com", password: "" }).success).toBe(true);
  });
});

describe("locationSchema", () => {
  const valid = {
    name: "梅田",
    prefecture: "大阪府",
    address: "大阪市北区1-1",
    open_hour: "9",
    close_hour: "21",
    hourly_price: "300",
    daily_max_price: "1500",
  };

  it("フォームの文字列を数値に変換する", () => {
    const result = locationSchema.parse(valid);
    expect(result.open_hour).toBe(9);
    expect(result.daily_max_price).toBe(1500);
  });

  it("空欄・範囲外・開店≧閉店をエラーにする", () => {
    expect(fieldErrors(locationSchema.safeParse({ ...valid, hourly_price: "" })).hourly_price).toEqual([
      "1時間料金を入力してください",
    ]);
    expect(fieldErrors(locationSchema.safeParse({ ...valid, hourly_price: "  " })).hourly_price).toEqual([
      "1時間料金を入力してください",
    ]);
    expect(fieldErrors(locationSchema.safeParse({ ...valid, open_hour: "24" })).open_hour).toEqual([
      "開店時刻は23以下で入力してください",
    ]);
    expect(fieldErrors(locationSchema.safeParse({ ...valid, open_hour: "21", close_hour: "9" })).close_hour).toEqual([
      "閉店時刻は開店時刻より後にしてください",
    ]);
  });

  it("一覧にない都道府県はエラーにする", () => {
    expect(fieldErrors(locationSchema.safeParse({ ...valid, prefecture: "" })).prefecture).toEqual([
      "都道府県を選択してください",
    ]);
  });
});

describe("spaceSchema", () => {
  it("拠点が未選択ならエラーにする", () => {
    const errors = fieldErrors(
      spaceSchema.safeParse({ location_id: "", name: "席A", kind: "seat", capacity: "1", hourly_price: "0" }),
    );
    expect(errors.location_id).toEqual(["拠点を選択してください"]);
  });
});
