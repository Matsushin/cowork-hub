// AI の答えの数字を、道具（集計の API）が返した値と照らし合わせる
//   - 道具の結果にある数字（と、表の列の合計）はそのまま正しい
//   - 2つの数字の差・和・比（％・倍・増減率）も正しいとする（「先月より 12.3% 増えた」など）
//   - 丸めは、結果の値そのものなら整数・小数1桁まで、2つの値から作った数字なら小数1桁だけ許す
//   - 差や比は組み合わせが多いので、偶然当てはまることがある（印が付かないことは「正しい」の証明ではない）。
//     ずれを見つけるための仕組みで、評価データで正答率も別に測る
// ここで照らし合わせられない数字は、AI が作った（計算を間違えた）おそれがあるので、画面で印を付け、評価で数える

/** 照らし合わせに使わない項目（ID や、曜日・時間帯の番号などの見出し） */
const SKIP_KEYS = new Set(["id", "key", "location_id", "space_id", "plan_id", "open_hour", "close_hour"]);

/** 道具の結果の中の数字を集める。オブジェクトの配列（表）は、列ごとの合計も足す */
export function collectNumbers(data: unknown, out: Set<number> = new Set()): Set<number> {
  if (typeof data === "number" && Number.isFinite(data)) out.add(data);
  else if (Array.isArray(data)) {
    data.forEach((item) => collectNumbers(item, out));
    const sums = new Map<string, number>();
    for (const item of data) {
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      for (const [k, v] of Object.entries(item)) {
        if (typeof v === "number" && !SKIP_KEYS.has(k)) sums.set(k, (sums.get(k) ?? 0) + v);
      }
    }
    sums.forEach((v) => out.add(v));
  } else if (data && typeof data === "object") {
    for (const [k, v] of Object.entries(data)) if (!SKIP_KEYS.has(k)) collectNumbers(v, out);
  }
  return out;
}

/** 道具の結果の値そのもの：丸め（整数・小数1桁・小数2桁）を許す */
const matchesBase = (value: number, x: number) =>
  value === x || Math.round(x) === value || Math.round(x * 10) / 10 === value || Math.round(x * 100) / 100 === value;
/** 2つの値から作った数字：そのまま、または小数1桁に丸めたものだけ（何でも当てはまらないよう、整数への丸めは許さない） */
const matchesDerived = (value: number, x: number) => value === x || Math.round(x * 10) / 10 === value;

/** 数字が、集めた数字そのもの、またはそのうち2つの差・和・比で作れるか */
export function isSupported(value: number, numbers: Set<number>): boolean {
  const base = [...numbers];
  if (base.some((x) => matchesBase(value, x))) return true;
  for (const a of base) {
    for (const b of base) {
      if (a === b) continue;
      if (value === Math.abs(a - b) || value === a + b) return true;
      if (b !== 0 && a !== 0) {
        const ratio = a / b;
        // ◯倍・◯%（割合）・◯%（増減率）
        if (
          matchesDerived(value, ratio) ||
          matchesDerived(value, ratio * 100) ||
          matchesDerived(value, Math.abs(ratio - 1) * 100)
        )
          return true;
      }
    }
  }
  return false;
}

/** 日付・時刻・順位など、照らし合わせない数字の後ろに付く文字 */
const NOT_A_FIGURE_AFTER = /^(年|月|日|時|曜|位|番|つ|か月|ヶ月|カ月|週|拠点|プラン|名|分)/;

/** 答えの文から、照らし合わせる数字を取り出す（「1,234円」「12.5%」など。日付・時刻・順位は除く） */
export function extractNumbers(text: string): { raw: string; value: number }[] {
  const found: { raw: string; value: number }[] = [];
  for (const m of text.matchAll(/\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g)) {
    const after = text.slice(m.index! + m[0].length);
    const before = text.slice(0, m.index!);
    if (NOT_A_FIGURE_AFTER.test(after)) continue;
    if (/[-/:]$/.test(before) || /^[-/:]\d/.test(after)) continue; // 2026-11、10/1、10:00
    if (/第$/.test(before)) continue;
    found.push({ raw: m[0], value: Number(m[0].replaceAll(",", "")) });
  }
  return found;
}
