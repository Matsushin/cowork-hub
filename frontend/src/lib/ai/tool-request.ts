// AI の道具（仕様書から作った定義）を、Rails API へのリクエストに変える。サーバー専用の部分は tools.ts
// ここは入力の検証とパスの組み立てだけ（テストしやすいよう、通信しない）

export type JsonSchemaProperty = {
  type?: "string" | "integer" | "number" | "boolean";
  format?: string;
  enum?: string[];
  pattern?: string;
  default?: string | number;
  description?: string;
};

export type GeneratedTool = {
  name: string;
  description: string;
  method: "GET";
  path: string;
  pathParams: string[];
  queryParams: string[];
  inputSchema: {
    type: "object";
    properties: Record<string, JsonSchemaProperty>;
    required: string[];
    additionalProperties: false;
  };
};

export class ToolInputError extends Error {}

// 値を仕様書の型に合わせて文字列にする。合わなければ ToolInputError（AI に間違いとして返す）
function serialize(name: string, value: unknown, schema: JsonSchemaProperty): string {
  if (schema.type === "integer") {
    if (typeof value === "number" && Number.isInteger(value) && value > 0) return String(value);
    if (typeof value === "string" && /^[1-9]\d*$/.test(value)) return value;
    throw new ToolInputError(`${name} は正の整数で指定してください`);
  }
  if (typeof value !== "string" || value.length === 0 || value.length > 100) {
    throw new ToolInputError(`${name} は100文字以内の文字列で指定してください`);
  }
  if (schema.format === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ToolInputError(`${name} は YYYY-MM-DD の形で指定してください`);
  }
  if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
    throw new ToolInputError(`${name} の形が正しくありません（${schema.pattern}）`);
  }
  if (schema.enum && !schema.enum.includes(value)) {
    throw new ToolInputError(`${name} は ${schema.enum.join("・")} のどれかで指定してください`);
  }
  return value;
}

/** 道具の入力から、apiFetch に渡すパス（先頭の /api を除く）を作る */
export function buildRequestPath(tool: GeneratedTool, input: Record<string, unknown>): string {
  const known = new Set([...tool.pathParams, ...tool.queryParams]);
  for (const key of Object.keys(input)) {
    if (!known.has(key)) throw new ToolInputError(`${key} という引数はありません`);
  }
  for (const name of tool.inputSchema.required) {
    if (input[name] === undefined || input[name] === null) throw new ToolInputError(`${name} を指定してください`);
  }

  let path = tool.path;
  for (const name of tool.pathParams) {
    const value = serialize(name, input[name], tool.inputSchema.properties[name] ?? {});
    path = path.replace(`{${name}}`, encodeURIComponent(value));
  }
  const query = new URLSearchParams();
  for (const name of tool.queryParams) {
    if (input[name] === undefined || input[name] === null) continue;
    query.set(name, serialize(name, input[name], tool.inputSchema.properties[name] ?? {}));
  }
  const qs = query.toString();
  return `${path.replace(/^\/api/, "")}${qs ? `?${qs}` : ""}`;
}
