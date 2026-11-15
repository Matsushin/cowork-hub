import { createLoader, createParser, createSerializer, parseAsString, parseAsStringLiteral } from "nuqs/server";
import { isValidDate, isValidMonth } from "@/lib/format";

/*
 * URLのクエリパラメータ（?date= や ?month=）の定義（nuqs）
 * - Server Component は createLoader で読み、型付き・検証済みの値を受け取る
 * - クライアントは同じパーサーを useQueryState に渡して書き換える
 * - リンクは createSerializer で組み立てる
 * 形式が不正な値は null（＝指定なし）として扱う
 */

/** 日付（YYYY-MM-DD）。Dateに変換するとタイムゾーンでずれるので文字列のまま扱う */
export const parseAsDate = createParser({
  parse: (v) => (isValidDate(v) ? v : null),
  serialize: (v: string) => v,
});

/** 月（YYYY-MM） */
export const parseAsMonth = createParser({
  parse: (v) => (isValidMonth(v) ? v : null),
  serialize: (v: string) => v,
});

export const dateParams = { date: parseAsDate };
export const monthParams = { month: parseAsMonth };
export const keywordParams = { q: parseAsString.withDefault("") };
export const locationSearchParams = { q: parseAsString.withDefault(""), prefecture: parseAsString.withDefault("") };
export const reservationFilterParams = { filter: parseAsStringLiteral(["upcoming", "all"]).withDefault("upcoming") };

export const loadDateParams = createLoader(dateParams);
export const loadMonthParams = createLoader(monthParams);
export const loadKeywordParams = createLoader(keywordParams);
export const loadLocationSearchParams = createLoader(locationSearchParams);
export const loadReservationFilterParams = createLoader(reservationFilterParams);

export const serializeMonth = createSerializer(monthParams);
export const serializeReservationFilter = createSerializer(reservationFilterParams);
