import { z } from "zod";
import { PREFECTURES } from "@/lib/prefectures";

/*
 * フォームの入力チェック（Zod）
 * - ブラウザ（React Hook Form）とServer Actionの両方で同じスキーマを使う
 * - 項目名はRails APIのパラメータ名に揃える（サーバーのエラーと同じ <Field> に表示するため）
 * - ここでは形式のチェックだけを行う。重複・権限・業務ルールの最終判断はRails側
 */

const required = (label: string) => z.string().trim().min(1, `${label}を入力してください`);

const email = required("メールアドレス").pipe(z.email("メールアドレスの形式が正しくありません"));

const password = z.string().min(8, "パスワードは8文字以上で入力してください");

/** フォームの数値（文字列でも数値でも受け取り、空欄は未入力として扱う） */
const integer = (label: string, { min, max }: { min: number; max?: number }) => {
  let schema = z
    .number({ error: (issue) => (issue.input === undefined ? `${label}を入力してください` : `${label}は数値で入力してください`) })
    .int(`${label}は整数で入力してください`)
    .min(min, `${label}は${min}以上で入力してください`);
  if (max !== undefined) schema = schema.max(max, `${label}は${max}以下で入力してください`);
  return z.preprocess((v) => {
    if (v === null || v === undefined) return undefined;
    // 空白だけの入力も未入力として扱う（Number(" ") は 0 になってしまうため）
    if (typeof v === "string") return v.trim() === "" ? undefined : Number(v);
    return v;
  }, schema);
};

/** 選択式の項目（未選択は空文字で届く） */
const selected = (label: string) => z.string().min(1, `${label}を選択してください`);

export const loginSchema = z.object({
  email_address: email,
  password: z.string().min(1, "パスワードを入力してください"),
});

export const signupSchema = z.object({
  name: required("名前"),
  email_address: email,
  password,
});

export const profileSchema = z.object({
  name: required("名前"),
  email_address: email,
  // 空欄なら変更しない
  password: z.union([z.literal(""), password]).optional(),
});

export const locationSchema = z
  .object({
    name: required("拠点名"),
    prefecture: z.enum(PREFECTURES, "都道府県を選択してください"),
    address: required("住所"),
    description: z.string().trim().optional(),
    open_hour: integer("開店時刻", { min: 0, max: 23 }),
    close_hour: integer("閉店時刻", { min: 1, max: 24 }),
    hourly_price: integer("1時間料金", { min: 0 }),
    daily_max_price: integer("1日上限", { min: 0 }),
  })
  .refine((v) => v.open_hour < v.close_hour, {
    path: ["close_hour"],
    message: "閉店時刻は開店時刻より後にしてください",
  });

export const spaceSchema = z.object({
  location_id: selected("拠点"),
  name: required("名前"),
  kind: z.enum(["seat", "meeting_room"], "種別を選択してください"),
  capacity: integer("定員", { min: 1 }),
  hourly_price: integer("1時間料金", { min: 0 }),
});

export const adminUserSchema = z.object({
  role: z.enum(["member", "admin"], "権限を選択してください"),
  plan_id: z.string().optional(),
});

/** 予約の作成（画面の枠選択から組み立てる値。Server Actionは誰でも呼べるので、サーバー側でも型を確かめる） */
export const reservationSchema = z.object({
  space_id: z.number().int().positive(),
  starts_at: z.iso.datetime(),
  ends_at: z.iso.datetime(),
});
