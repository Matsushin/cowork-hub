"use client";

import { cloneElement, createContext, isValidElement, startTransition, useActionState, useContext, useId, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { initialActionState, type ActionState, type FieldErrors } from "@/lib/api-error";

type FormAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * Server Actionを使うフォームのためのフック
 * - onSubmit: フォームに渡す。送信後も入力内容を残すため、<form action> ではなく手動で送る
 * - errors: <FormErrors> に渡すと <Field name="..."> の下に項目ごとのエラーが出る
 */
export function useActionForm(action: FormAction) {
  const [state, dispatch, pending] = useActionState(action, initialActionState);

  // 入力し直した項目のエラーは消す（新しい結果が返ったらリセット）
  const [cleared, setCleared] = useState<string[]>([]);
  const [prevState, setPrevState] = useState(state);
  if (prevState !== state) {
    setPrevState(state);
    setCleared([]);
  }

  const fieldErrors: FieldErrors = Object.fromEntries(Object.entries(state.fieldErrors).filter(([k]) => !cleared.includes(k)));
  const clearField = (name: string) => setCleared((c) => (c.includes(name) ? c : [...c, name]));

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(() => dispatch(formData));
  };

  return { state, pending, onSubmit, errors: { fieldErrors, clearField } };
}

type FormErrorsValue = { fieldErrors: FieldErrors; clearField: (name: string) => void };

const FormErrorsContext = createContext<FormErrorsValue | null>(null);

// 囲んだ範囲の <Field name="..."> に項目ごとのエラーを配る
export function FormErrors({ value, children }: { value: FormErrorsValue; children: React.ReactNode }) {
  return <FormErrorsContext.Provider value={value}>{children}</FormErrorsContext.Provider>;
}

type InputLikeProps = {
  id?: string;
  name?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
};

/**
 * ラベル付きの入力欄。errorKey（省略時は子要素のname）の項目エラーを下に表示する
 */
export function Field({ label, errorKey, children }: { label: string; errorKey?: string; children: React.ReactNode }) {
  const ctx = useContext(FormErrorsContext);
  const id = useId();
  const child = isValidElement<InputLikeProps>(children) ? children : null;
  const key = errorKey ?? child?.props.name;
  const errors = key ? ctx?.fieldErrors[key] : undefined;
  const errorId = `${id}-error`;
  const inputId = child?.props.id ?? id;

  const control = child
    ? cloneElement(child, {
        id: inputId,
        "aria-invalid": errors ? true : undefined,
        "aria-describedby": errors ? errorId : undefined,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
          if (key) ctx?.clearField(key);
          child.props.onChange?.(e);
        },
      })
    : children;

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
