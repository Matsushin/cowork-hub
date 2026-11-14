"use client";

import { useCallback, useEffect, useState } from "react";
import { api, spaceKindLabel } from "@/lib/api";
import type { Space } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { ErrorMessage, Field, FormErrors, useApiErrors } from "@/components/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function AdminSpacesPage() {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [form, setForm] = useState({ name: "", kind: "seat", capacity: 1 });
  const errors = useApiErrors();
  const handleError = errors.handle;

  const load = useCallback(() => {
    api<Space[]>("/admin/spaces").then(setSpaces).catch(handleError);
  }, [handleError]);

  useEffect(load, [load]);

  const run = async (fn: () => Promise<unknown>) => {
    errors.clear();
    try {
      await fn();
      load();
    } catch (e) {
      errors.handle(e);
    }
  };

  const create = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      await api("/admin/spaces", { method: "POST", body: { space: form } });
      setForm({ name: "", kind: "seat", capacity: 1 });
    });
  };

  return (
    <div className="space-y-6">
      <ErrorMessage message={errors.message} />
      <Card className="px-5">
        <h2 className="mb-3 font-semibold">スペースを追加</h2>
        <FormErrors value={errors}>
        <form onSubmit={create} className="flex flex-wrap items-start gap-3" noValidate>
          <div className="min-w-48 flex-1">
            <Field label="名前" name="name">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
          </div>
          <Field label="種別" name="kind">
            <NativeSelect value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
              <NativeSelectOption value="seat">フリー席</NativeSelectOption>
              <NativeSelectOption value="meeting_room">会議室</NativeSelectOption>
            </NativeSelect>
          </Field>
          <div className="w-36">
            <Field label="定員" name="capacity">
              <Input type="number" min={1} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} />
            </Field>
          </div>
          <Button type="submit" className="mt-5">追加</Button>
        </form>
        </FormErrors>
      </Card>
      <Card className="px-5 overflow-x-auto p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="px-4">名前</TableHead>
              <TableHead className="px-4">種別</TableHead>
              <TableHead className="px-4">定員</TableHead>
              <TableHead className="px-4">状態</TableHead>
              <TableHead className="px-4 py-2" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {spaces.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="px-4">{s.name}</TableCell>
                <TableCell className="px-4">{spaceKindLabel[s.kind]}</TableCell>
                <TableCell className="px-4">{s.capacity}名</TableCell>
                <TableCell className="px-4">{s.active ? "公開中" : <span className="text-muted-foreground">停止中</span>}</TableCell>
                <TableCell className="space-x-2 px-4 py-2 text-right whitespace-nowrap">
                  <Button variant="outline" onClick={() => run(() => api(`/admin/spaces/${s.id}`, { method: "PATCH", body: { space: { active: !s.active } } }))}>
                    {s.active ? "停止" : "公開"}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => confirm(`${s.name}を削除しますか？`) && run(() => api(`/admin/spaces/${s.id}`, { method: "DELETE" }))}
                  >
                    削除
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
