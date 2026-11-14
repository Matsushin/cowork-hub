"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";

/**
 * 入力値をURLの検索パラメータに反映する（Server Componentがその値で再取得する）
 * 文字入力は少し待ってから反映し、日付などは即時に反映する
 */
export function SearchParamInput({
  param,
  delay = 0,
  ...inputProps
}: { param: string; delay?: number } & Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "defaultValue">) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get(param) ?? "";
  const [value, setValue] = useState(current);

  useEffect(() => {
    if (value === current) return;
    const t = setTimeout(() => {
      const next = new URLSearchParams(searchParams);
      if (value) next.set(param, value);
      else next.delete(param);
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    }, delay);
    return () => clearTimeout(t);
  }, [value, current, delay, param, pathname, router, searchParams]);

  return <Input {...inputProps} value={value} onChange={(e) => setValue(e.target.value)} />;
}
