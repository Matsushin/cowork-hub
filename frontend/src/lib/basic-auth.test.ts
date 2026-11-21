import { describe, expect, it } from "vitest";
import { basicAuthCredentials, isAuthorized } from "./basic-auth";

const credentials = { user: "ee-office", password: "s3cret" };
const basic = (s: string) => `Basic ${Buffer.from(s).toString("base64")}`;

describe("basicAuthCredentials", () => {
  it("ID とパスワードの両方があるときだけ有効", () => {
    expect(basicAuthCredentials({ BASIC_AUTH_USER: "a", BASIC_AUTH_PASSWORD: "b" })).toEqual({ user: "a", password: "b" });
    expect(basicAuthCredentials({ BASIC_AUTH_USER: "a" })).toBeNull();
    expect(basicAuthCredentials({ BASIC_AUTH_PASSWORD: "b" })).toBeNull();
    expect(basicAuthCredentials({})).toBeNull();
  });
});

describe("isAuthorized", () => {
  it("ID とパスワードが一致すれば通す", () => {
    expect(isAuthorized(basic("ee-office:s3cret"), credentials)).toBe(true);
  });

  it("パスワードの違い・ID の違い・ヘッダーなし・Basic 以外は通さない", () => {
    expect(isAuthorized(basic("ee-office:wrong"), credentials)).toBe(false);
    expect(isAuthorized(basic("other:s3cret"), credentials)).toBe(false);
    expect(isAuthorized(null, credentials)).toBe(false);
    expect(isAuthorized("Bearer token", credentials)).toBe(false);
    expect(isAuthorized("Basic !!!", credentials)).toBe(false);
  });

  it("パスワードに : を含んでも正しく比べる", () => {
    expect(isAuthorized(basic("ee-office:a:b"), { user: "ee-office", password: "a:b" })).toBe(true);
  });
});
