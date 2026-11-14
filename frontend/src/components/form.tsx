"use client";

import { cloneElement, createContext, isValidElement, useCallback, useContext, useId, useMemo, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { ApiError, type FieldErrors } from "@/lib/api";

/**
 * APIのエラーをフォームで扱うためのフック
 * - message: フォーム上部に出すメッセージ（項目に属さないエラーや通信エラー）
 * - fieldErrors: 項目ごとのメッセージ（<Field name="..."> の下に表示）
 */
export function useApiErrors() {
  const [message, setMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const handle = useCallback((e: unknown) => {
    if (e instanceof ApiError) {
      const { base, ...fields } = e.fieldErrors;
      setFieldErrors(fields);
      if (base?.length) setMessage(base.join("\n"));
      else if (Object.keys(fields).length) setMessage("入力内容に誤りがあります。各項目を確認してください。");
      else setMessage(e.message);
    } else {
      setFieldErrors({});
      setMessage("予期しないエラーが発生しました");
    }
  }, []);

  const clear = useCallback(() => {
    setMessage(null);
    setFieldErrors({});
  }, []);

  // 入力し直した項目のエラーを消す
  const clearField = useCallback((name: string) => {
    setFieldErrors((prev) => {
      if (!(name in prev)) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }, []);

  return useMemo(() => ({ message, fieldErrors, handle, clear, clearField }), [message, fieldErrors, handle, clear, clearField]);
}

type ApiErrors = ReturnType<typeof useApiErrors>;

const FormErrorsContext = createContext<ApiErrors | null>(null);

// 囲んだ範囲の <Field name="..."> に項目ごとのエラーを配る
export function FormErrors({ value, children }: { value: ApiErrors; children: React.ReactNode }) {
  return <FormErrorsContext.Provider value={value}>{children}</FormErrorsContext.Provider>;
}

type InputLikeProps = {
  id?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
};

// ラベル付きの入力欄。name を渡すと、その項目のエラーを下に表示する
export function Field({ label, name, children }: { label: string; name?: string; children: React.ReactNode }) {
  const ctx = useContext(FormErrorsContext);
  const id = useId();
  const errors = name ? ctx?.fieldErrors[name] : undefined;
  const errorId = `${id}-error`;

  let control = children;
  if (isValidElement<InputLikeProps>(children)) {
    const original = children.props.onChange;
    control = cloneElement(children, {
      id: children.props.id ?? id,
      "aria-invalid": errors ? true : undefined,
      "aria-describedby": errors ? errorId : undefined,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
        if (name) ctx?.clearField(name);
        original?.(e);
      },
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={isValidElement<InputLikeProps>(children) ? (children.props.id ?? id) : undefined} className={errors ? "text-destructive" : undefined}>
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

export function ErrorMessage({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <Alert variant="destructive" role="alert">
      <AlertDescription className="whitespace-pre-line">{message}</AlertDescription>
    </Alert>
  );
}
