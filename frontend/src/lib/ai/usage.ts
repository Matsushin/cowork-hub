// AI の利用量（トークン数）と料金の計算。Rails の利用記録（AiRequest）に書く値を作る

/** 100万トークンあたりの料金（米ドル）。https://platform.claude.com/docs/en/about-claude/pricing */
export const PRICES_PER_MTOK = {
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
} as const;

export type AiModel = keyof typeof PRICES_PER_MTOK;

export type TokenUsage = {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
};

export const emptyUsage = (): TokenUsage => ({
  input_tokens: 0,
  output_tokens: 0,
  cache_read_input_tokens: 0,
  cache_creation_input_tokens: 0,
});

/** 道具を使うと1回の相談で何回も API を呼ぶので、回ごとの usage を足し合わせる（null は 0 として扱う） */
export function addUsage(
  total: TokenUsage,
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens?: number | null;
    cache_creation_input_tokens?: number | null;
  },
): TokenUsage {
  return {
    input_tokens: total.input_tokens + usage.input_tokens,
    output_tokens: total.output_tokens + usage.output_tokens,
    cache_read_input_tokens: total.cache_read_input_tokens + (usage.cache_read_input_tokens ?? 0),
    cache_creation_input_tokens: total.cache_creation_input_tokens + (usage.cache_creation_input_tokens ?? 0),
  };
}

/** 料金を米ドル×1,000,000 の整数で返す（小数の誤差を避ける。Rails には整数で記録する） */
export function costMicroUsd(model: AiModel, usage: TokenUsage): number {
  const p = PRICES_PER_MTOK[model];
  // 100万トークンあたりの米ドル × トークン数 ＝ 米ドル×100万
  return Math.round(
    p.input * usage.input_tokens +
      p.output * usage.output_tokens +
      p.cacheRead * usage.cache_read_input_tokens +
      p.cacheWrite * usage.cache_creation_input_tokens,
  );
}
