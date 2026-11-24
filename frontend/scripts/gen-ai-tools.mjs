// API の仕様書（backend/swagger/v1/openapi.yaml）から、AI に渡す道具の定義を作る
//   入力：src/lib/ai/allowlist.json（機能ごとに、渡してよい操作と AI 向けの説明）
//   出力：src/lib/ai/generated-tools.ts（コミットする。CI で最新かを確かめる）
// 許可リストにない操作は作らない。GET 以外の操作や、仕様書にない操作が許可リストにあれば失敗する
import { readFileSync, writeFileSync } from "node:fs";
import { load } from "js-yaml";

const spec = load(readFileSync("../backend/swagger/v1/openapi.yaml", "utf8"));
const allowlist = JSON.parse(readFileSync("src/lib/ai/allowlist.json", "utf8"));

function fail(message) {
  console.error(`gen-ai-tools: ${message}`);
  process.exit(1);
}

const tools = {};
for (const [feature, entries] of Object.entries(allowlist)) {
  if (feature.startsWith("$")) continue;
  tools[feature] = entries.map((entry) => {
    if (entry.method !== "GET") fail(`${entry.method} ${entry.path}：AI には読み取り（GET）だけを渡す`);
    const pathItem = spec.paths[entry.path];
    const op = pathItem?.[entry.method.toLowerCase()];
    if (!op) fail(`${entry.method} ${entry.path} が仕様書にない`);

    const params = [...(pathItem.parameters ?? []), ...(op.parameters ?? [])];
    const properties = {};
    const required = [];
    const pathParams = [];
    const queryParams = [];
    for (const p of params) {
      if (p.in !== "path" && p.in !== "query") fail(`${entry.path} の ${p.name}：path と query 以外の引数は扱わない`);
      properties[p.name] = { ...p.schema, ...(p.description ? { description: p.description } : {}) };
      if (p.in === "path") pathParams.push(p.name);
      else queryParams.push(p.name);
      if (p.in === "path" || p.required) required.push(p.name);
    }
    return {
      name: entry.name,
      description: `${entry.description}\n（${entry.method} ${entry.path}：${op.summary}）`,
      method: entry.method,
      path: entry.path,
      pathParams,
      queryParams,
      inputSchema: { type: "object", properties, required, additionalProperties: false },
    };
  });
}

const body = `// このファイルは scripts/gen-ai-tools.mjs が作る。手で直さない（npm run gen:api で作り直す）
import type { GeneratedTool } from "./tool-request";

export const GENERATED_TOOLS: Record<${Object.keys(tools)
  .map((k) => JSON.stringify(k))
  .join(" | ")}, GeneratedTool[]> = ${JSON.stringify(tools, null, 2)};
`;
writeFileSync("src/lib/ai/generated-tools.ts", body);
console.log(`gen-ai-tools: ${Object.values(tools).flat().length} 個の道具を作った`);
