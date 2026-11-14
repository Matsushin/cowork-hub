"use client";

import { useEffect, useRef } from "react";
import { createSpace } from "@/app/actions/admin";
import { Field, FormErrors, FormStatus, useActionForm } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { Location } from "@/lib/types";

export function SpaceCreateForm({ locations }: { locations: Location[] }) {
  const { state, pending, onSubmit, errors } = useActionForm(createSpace);
  const formRef = useRef<HTMLFormElement>(null);

  // 追加できたら入力欄を空に戻す
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <FormErrors value={errors}>
      <form ref={formRef} onSubmit={onSubmit} className="space-y-3" noValidate>
        <FormStatus state={state} />
        <div className="flex flex-wrap items-start gap-3">
          <Field label="拠点" errorKey="location">
            <NativeSelect name="location_id" defaultValue="">
              <NativeSelectOption value="">選択してください</NativeSelectOption>
              {locations.map((l) => (
                <NativeSelectOption key={l.id} value={l.id}>
                  {l.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <div className="min-w-40 flex-1">
            <Field label="名前">
              <Input name="name" />
            </Field>
          </div>
          <Field label="種別">
            <NativeSelect name="kind" defaultValue="seat">
              <NativeSelectOption value="seat">フリー席</NativeSelectOption>
              <NativeSelectOption value="meeting_room">会議室</NativeSelectOption>
            </NativeSelect>
          </Field>
          <div className="w-24">
            <Field label="定員">
              <Input name="capacity" type="number" defaultValue={1} />
            </Field>
          </div>
          <div className="w-32">
            <Field label="1時間料金（円）">
              <Input name="hourly_price" type="number" defaultValue={0} />
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
