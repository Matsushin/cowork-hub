"use client";

import { createLocation } from "@/app/actions/admin";
import { Field, FormErrors, FormStatus, useActionForm } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { PREFECTURES } from "@/lib/prefectures";
import { locationSchema } from "@/lib/schemas";

export function LocationCreateForm() {
  // 追加できたら入力欄を初期値に戻す
  const { state, pending, onSubmit, errors } = useActionForm(createLocation, {
    schema: locationSchema,
    defaultValues: { prefecture: "", open_hour: 9, close_hour: 21, hourly_price: 300, daily_max_price: 1500 },
    resetOnSuccess: true,
  });

  return (
    <FormErrors value={errors}>
      <form onSubmit={onSubmit} className="space-y-3" noValidate>
        <FormStatus state={state} />
        <div className="grid gap-3 sm:grid-cols-[1fr_10rem_2fr]">
          <Field label="拠点名">
            <Input name="name" />
          </Field>
          <Field label="都道府県">
            <NativeSelect name="prefecture">
              <NativeSelectOption value="">選択</NativeSelectOption>
              {PREFECTURES.map((p) => (
                <NativeSelectOption key={p} value={p}>
                  {p}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field label="住所">
            <Input name="address" />
          </Field>
        </div>
        <Field label="紹介文">
          <Input name="description" />
        </Field>
        <div className="flex flex-wrap items-start gap-3">
          <div className="w-28">
            <Field label="開店（時）">
              <Input name="open_hour" type="number" />
            </Field>
          </div>
          <div className="w-28">
            <Field label="閉店（時）">
              <Input name="close_hour" type="number" />
            </Field>
          </div>
          <div className="w-36">
            <Field label="1時間料金（円）">
              <Input name="hourly_price" type="number" />
            </Field>
          </div>
          <div className="w-36">
            <Field label="1日上限（円）">
              <Input name="daily_max_price" type="number" />
            </Field>
          </div>
          <Button type="submit" disabled={pending} className="mt-5">
            追加
          </Button>
        </div>
      </form>
    </FormErrors>
  );
}
