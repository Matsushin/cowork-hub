// サーバー・クライアントの両方で使うエラー型

// 項目名 → エラーメッセージ一覧（項目に属さないものは "base"）
export type FieldErrors = Record<string, string[]>;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fieldErrors: FieldErrors = {},
  ) {
    super(message);
  }
}

// Server Actionの戻り値。フォームはこれを見てエラーを表示する
export type ActionState = {
  ok: boolean;
  message: string | null;
  fieldErrors: FieldErrors;
};

export const initialActionState: ActionState = { ok: false, message: null, fieldErrors: {} };

export function toActionState(e: ApiError): ActionState {
  const { base, ...fields } = e.fieldErrors;
  let message = e.message;
  if (base?.length) message = base.join("\n");
  else if (Object.keys(fields).length) message = "入力内容に誤りがあります。各項目を確認してください。";
  return { ok: false, message, fieldErrors: fields };
}
