import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Field, FormErrors, FormStatus, useActionForm } from "@/components/form";
import type { ActionState } from "@/lib/api-error";
import { signupSchema } from "@/lib/schemas";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

function SignupLikeForm({ action }: { action: Action }) {
  const { state, onSubmit, errors } = useActionForm(action, { schema: signupSchema, defaultValues: { name: "初期値" } });
  return (
    <FormErrors value={errors}>
      <form onSubmit={onSubmit} noValidate>
        <FormStatus state={state} />
        <Field label="名前">
          <input name="name" />
        </Field>
        <Field label="メールアドレス">
          <input name="email_address" />
        </Field>
        <Field label="パスワード">
          <input name="password" type="password" />
        </Field>
        <input type="hidden" name="next" value="/reservations" />
        <button type="submit">登録</button>
      </form>
    </FormErrors>
  );
}

describe("useActionForm / Field", () => {
  it("初期値を defaultValues から入れる", () => {
    render(<SignupLikeForm action={vi.fn()} />);
    expect(screen.getByLabelText("名前")).toHaveValue("初期値");
  });

  it("入力チェックに通らなければServer Actionを呼ばず、項目の下にエラーを出す", async () => {
    const action = vi.fn<Action>();
    render(<SignupLikeForm action={action} />);

    await userEvent.type(screen.getByLabelText("メールアドレス"), "invalid");
    await userEvent.click(screen.getByRole("button", { name: "登録" }));

    expect(await screen.findByText("メールアドレスの形式が正しくありません")).toBeInTheDocument();
    expect(screen.getByLabelText("メールアドレス")).toHaveAttribute("aria-invalid", "true");
    expect(action).not.toHaveBeenCalled();
  });

  it("通ったらフォームの値（hidden項目を含む）をServer Actionへ送り、サーバーのエラーを項目に出す", async () => {
    const action = vi.fn<Action>(async () => ({
      ok: false,
      message: "入力内容に誤りがあります。各項目を確認してください。",
      fieldErrors: { email_address: ["メールアドレスはすでに使用されています"] },
    }));
    render(<SignupLikeForm action={action} />);

    await userEvent.type(screen.getByLabelText("メールアドレス"), "taken@example.com");
    await userEvent.type(screen.getByLabelText("パスワード"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "登録" }));

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const formData = action.mock.calls[0][1];
    expect(Object.fromEntries(formData)).toEqual({
      name: "初期値",
      email_address: "taken@example.com",
      password: "password123",
      next: "/reservations",
    });
    expect(await screen.findByText("メールアドレスはすでに使用されています")).toBeInTheDocument();

    // 入力し直すとその項目のサーバーエラーは消える
    await userEvent.type(screen.getByLabelText("メールアドレス"), "x");
    expect(screen.queryByText("メールアドレスはすでに使用されています")).not.toBeInTheDocument();
  });
});
