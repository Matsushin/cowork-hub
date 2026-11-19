/** Googleマップで住所を検索するURLを返す。クエリは「都道府県＋住所」をエンコードする */
export function googleMapsUrl(prefecture: string, address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${prefecture}${address}`)}`;
}
