import { LocationCard } from "@/components/LocationCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { apiFetch } from "@/lib/server/api";
import { PREFECTURES } from "@/lib/prefectures";
import { loadLocationSearchParams } from "@/lib/search-params";
import type { Location } from "@/lib/types";
import type { SearchParams } from "nuqs/server";

export default async function LocationsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { q, prefecture } = await loadLocationSearchParams(searchParams);
  const query = new URLSearchParams({ q, prefecture }).toString();
  const locations = await apiFetch<Location[]>(`/locations?${query}`, {
    auth: false,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">拠点を探す</h1>
      {/* JavaScriptなしでも動くよう、検索条件はGETフォームでURLに載せる */}
      <form className="flex flex-wrap gap-2" role="search">
        <NativeSelect name="prefecture" defaultValue={prefecture} aria-label="都道府県">
          <NativeSelectOption value="">すべての都道府県</NativeSelectOption>
          {PREFECTURES.map((p) => (
            <NativeSelectOption key={p} value={p}>
              {p}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <Input name="q" defaultValue={q} placeholder="拠点名・住所" aria-label="キーワード" className="w-56" />
        <Button type="submit">検索</Button>
      </form>
      {locations.length === 0 ? (
        <p className="text-sm text-muted-foreground">条件に合う拠点はありません。</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {locations.map((l) => (
            <LocationCard key={l.id} location={l} />
          ))}
        </div>
      )}
    </div>
  );
}
