"use client";

import Link from "next/link";
import { login } from "@/app/actions/auth";
import { ErrorMessage, useActionForm } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const { state, pending, onSubmit } = useActionForm(login);

  return (
    <Card className="mx-auto max-w-sm px-5">
      <h1 className="mb-4 text-xl font-semibold">ログイン</h1>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {/* どの項目が誤りかは教えない（アカウントの存在を推測されないため） */}
        <ErrorMessage message={state.message} />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email_address">メールアドレス</Label>
          <Input id="email_address" name="email_address" type="email" autoComplete="email" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">パスワード</Label>
          <Input id="password" name="password" type="password" autoComplete="current-password" />
        </div>
        <Button type="submit" disabled={pending} className="w-full">
          ログイン
        </Button>
      </form>
      <p className="mt-4 text-sm text-muted-foreground">
        はじめての方は{" "}
        <Link href="/signup" className="text-primary underline">
          会員登録
        </Link>
      </p>
    </Card>
  );
}
