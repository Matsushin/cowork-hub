// ご利用ルール（docs/rules/*.md）を、画面の表示と FAQ ボットの検索に使うデータにする
//   出力：src/lib/ai/faq/generated-rules.ts（コミットする。CI で最新かを確かめる）
//   書き方の約束は docs/rules/README.md。項目（## 見出し {#id}）が検索の1単位、段落と箇条書きの1行が引用の1単位
import { readdirSync, readFileSync, writeFileSync } from "node:fs";

const DIR = "../docs/rules";

function fail(message) {
  console.error(`gen-rules: ${message}`);
  process.exit(1);
}

const docs = readdirSync(DIR)
  .filter((f) => /^\d{2}_.+\.md$/.test(f))
  .sort()
  .map((file) => {
    const lines = readFileSync(`${DIR}/${file}`, "utf8").split("\n");
    const title = lines[0]?.match(/^# (.+)$/)?.[1];
    if (!title) fail(`${file}：最初の行は「# タイトル」にする`);
    const sections = [];
    let current = null;
    let paragraph = [];
    const flush = () => {
      if (current && paragraph.length) current.blocks.push(paragraph.join(""));
      paragraph = [];
    };
    for (const line of lines.slice(1)) {
      const heading = line.match(/^## (.+?) \{#([a-z0-9-]+)\}$/);
      if (line.startsWith("## ") && !heading) fail(`${file}：見出しに {#id} がない（${line}）`);
      if (heading) {
        flush();
        current = { id: heading[2], heading: heading[1], blocks: [] };
        sections.push(current);
      } else if (line.trim() === "") flush();
      else if (line.startsWith("- ")) {
        flush();
        current?.blocks.push(line.slice(2).trim());
      } else paragraph.push(line.trim());
    }
    flush();
    if (sections.length === 0) fail(`${file}：項目（## 見出し {#id}）がない`);
    return { file, title, sections };
  });

const ids = docs.flatMap((d) => d.sections.map((s) => s.id));
const dup = ids.find((id, i) => ids.indexOf(id) !== i);
if (dup) fail(`ID「${dup}」が重なっている`);

const body = `// このファイルは scripts/gen-rules.mjs が docs/rules/*.md から作る。手で直さない（npm run gen:rules で作り直す）
export type RuleSection = { id: string; heading: string; blocks: string[] };
export type RuleDoc = { file: string; title: string; sections: RuleSection[] };

export const RULE_DOCS: RuleDoc[] = ${JSON.stringify(docs, null, 2)};
`;
writeFileSync("src/lib/ai/faq/generated-rules.ts", body);
console.log(`gen-rules: ${docs.length} 個の文書・${ids.length} 個の項目`);
