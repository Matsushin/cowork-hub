"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { cloneElement, createContext, isValidElement, startTransition, useActionState, useContext, useEffect, useId, useState } from "react";
import { useForm, type DefaultValues, type FieldValues, type Resolver, type UseFormReturn } from "react-hook-form";
import type { z } from "zod";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { initialActionState, type ActionState, type FieldErrors } from "@/lib/api-error";

type FormAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

type Options<S extends z.ZodType> = {
  /** 入力チェックのスキーマ（lib/schemas.ts）。Server Action側でも同じものを使う */
  schema: S;
  /** 入力欄の初期値（<Input defaultValue> ではなくここで渡す） */
  defaultValues?: Record<string, unknown>;
  /** 成功したらフォームを初期値に戻す（追加フォームなど） */
  resetOnSuccess?: boolean;
};

/**
 * Server Actionを使うフォームのためのフック（React Hook Form＋Zod）
 * - ブラウザでZodの入力チェックを行い、通ったときだけServer Actionへ送る
 * - Rails側のエラー（重複など）は Server Action から fieldErrors として返り、同じ <Field> に表示される
 * - onSubmit: <form onSubmit> に渡す / errors: <FormErrors> に渡す / form: React Hook Form 本体
 */
export function useActionForm<S extends z.ZodType>(action: FormAction, { schema, defaultValues, resetOnSuccess = false }: Options<S>) {
  const [state, dispatch, pending] = useActionState(action, initialActionState);
  const form = useForm<FieldValues>({
    resolver: zodResolver(schema as never) as Resolver<FieldValues>,
    defaultValues: defaultValues as DefaultValues<FieldValues>,
    mode: "onTouched", // 一度触った項目は入力のたびにチェックし直す
  });

  // 入力し直した項目のサーバーエラーは消す（新しい結果が返ったらリセット）
  const [cleared, setCleared] = useState<string[]>([]);
  const [prevState, setPrevState] = useState(state);
  if (prevState !== state) {
    setPrevState(state);
    setCleared([]);
  }

  useEffect(() => {
    if (state.ok && resetOnSuccess) form.reset();
  }, [state, resetOnSuccess, form]);

  const serverErrors: FieldErrors = Object.fromEntries(Object.entries(state.fieldErrors).filter(([k]) => !cleared.includes(k)));
  const clearField = (name: string) => setCleared((c) => (c.includes(name) ? c : [...c, name]));

  // 送信後も入力内容を残すため、<form action> ではなくフォーム要素の値をそのまま送る（hidden項目も含む）
  const onSubmit = form.handleSubmit((_values, e) => {
    const formData = new FormData(e?.target as HTMLFormElement);
    startTransition(() => dispatch(formData));
  });

  return { state, pending, onSubmit, form, errors: { form, serverErrors, clearField } };
}

type FormErrorsValue = { form: UseFormReturn<FieldValues>; serverErrors: FieldErrors; clearField: (name: string) => void };

const FormErrorsContext = createContext<FormErrorsValue | null>(null);

// 囲んだ範囲の <Field name="..."> を React Hook Form に登録し、項目ごとのエラーを配る
export function FormErrors({ value, children }: { value: FormErrorsValue; children: React.ReactNode }) {
  return <FormErrorsContext.Provider value={value}>{children}</FormErrorsContext.Provider>;
}

type InputLikeProps = {
  id?: string;
  name?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
};

/**
 * ラベル付きの入力欄
 * 子要素の name で React Hook Form に登録し、その項目のエラー（ブラウザでのチェック → サーバーの順）を下に表示する。
 * Rails が別名でエラーを返す項目（location_id → location など）は errorKey で指定する
 *
 * 注意：直下の子要素は入力要素1つにし、name を付ける（フラグメントや <div> で包むと登録されず、
 * スキーマのエラーだけが残って表示先がないまま送信できなくなる）
 */
export function Field({ label, errorKey, children }: { label: string; errorKey?: string; children: React.ReactNode }) {
  const ctx = useContext(FormErrorsContext);
  const id = useId();
  const child = isValidElement<InputLikeProps>(children) ? children : null;
  const name = child?.props.name;
  if (process.env.NODE_ENV !== "production" && ctx && !name) {
    console.warn(`<Field label="${label}"> の直下に name 付きの入力要素がないため、React Hook Form に登録されません`);
  }

  const clientError = name ? ctx?.form.formState.errors[name]?.message : undefined;
  const serverError = [...(name ? (ctx?.serverErrors[name] ?? []) : []), ...(errorKey ? (ctx?.serverErrors[errorKey] ?? []) : [])];
  const errors = typeof clientError === "string" ? [clientError] : serverError.length ? serverError : undefined;
  const errorId = `${id}-error`;
  const inputId = child?.props.id ?? id;

  let control: React.ReactNode = children;
  if (child) {
    const registered = name && ctx ? ctx.form.register(name) : null;
    control = cloneElement(child, {
      id: inputId,
      "aria-invalid": errors ? true : undefined,
      "aria-describedby": errors ? errorId : undefined,
      ...(registered && {
        ...registered,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
          ctx?.clearField(name!);
          if (errorKey) ctx?.clearField(errorKey);
          return registered.onChange(e);
        },
      }),
    } as InputLikeProps);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={child ? inputId : undefined} className={errors ? "text-destructive" : undefined}>
        {label}
      </Label>
      {control}
      {errors && (
        <p id={errorId} className="text-xs text-destructive">
          {errors.join("／")}
        </p>
      )}
    </div>
  );
}

export function ErrorMessage({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <Alert variant="destructive" role="alert">
      <AlertDescription className="whitespace-pre-line">{message}</AlertDescription>
    </Alert>
  );
}

/** フォームの送信結果（成功メッセージ or エラー）を表示する */
export function FormStatus({ state }: { state: ActionState }) {
  if (state.ok) return state.message ? <p className="text-sm text-primary">{state.message}</p> : null;
  return <ErrorMessage message={state.message} />;
}

/**
 * 1クリックでServer Actionを実行するボタン（キャンセル・削除など）
 * action は Server Component 側で .bind(null, id) して渡す
 */
export function ActionButton({
  action,
  confirmMessage,
  children,
  ...buttonProps
}: {
  action: () => Promise<ActionState>;
  confirmMessage?: string;
} & Omit<React.ComponentProps<typeof Button>, "action" | "onClick">) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = () => {
    if (confirmMessage && !confirm(confirmMessage)) return;
    setError(null);
    setPending(true);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.message);
      setPending(false);
    });
  };

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button {...buttonProps} disabled={pending || buttonProps.disabled} onClick={run}>
        {children}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </span>
  );
}
