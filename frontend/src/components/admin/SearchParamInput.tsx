"use client";

import { debounce, parseAsString, useQueryState } from "nuqs";
import { Input } from "@/components/ui/input";

/**
 * 入力値をURLの検索パラメータに反映する（nuqs）
 * shallow: false でサーバーへ再リクエストし、Server Component がその値で再取得する。
 * 文字入力は delay ミリ秒待ってからURLに反映し（入力欄の表示はすぐ変わる）、日付などは即時に反映する
 */
export function SearchParamInput({
  param,
  delay = 0,
  ...inputProps
}: { param: string; delay?: number } & Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "defaultValue">) {
  const [value, setValue] = useQueryState(
    param,
    parseAsString.withDefault("").withOptions({
      shallow: false,
      history: "replace", // 1文字ごとに履歴を増やさない
      limitUrlUpdates: delay > 0 ? debounce(delay) : undefined,
    }),
  );

  // 空欄にしたら、既定値と同じなのでURLからパラメータごと消える（clearOnDefault）
  return <Input {...inputProps} value={value} onChange={(e) => setValue(e.target.value)} />;
}
