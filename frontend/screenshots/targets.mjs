// 変わったファイルの一覧（リポジトリ直下からのパス、1行に1つ）を標準入力で受け取り、
// 撮るページと、録画するE2Eのテストを JSON で出力する
//   node screenshots/targets.mjs < changed-files.txt
//   → {"pages":["location","visits"],"specs":["e2e/checkin.spec.ts"]}
//
// 決め方
// - src/app/<dir>/ のファイル … そのディレクトリのページと、その下のページ（layout などが効くため）
// - src/app 直下のファイル（layout・globals.css など） … 全ページ
// - src/app/actions・src/components・src/lib・src/proxy.ts など、src のそれ以外 … 全ページ（どの画面に効くか決めきれないため）
// - テスト（*.test.ts）・生成物（src/lib/api-schema.ts） … 対象外
// - e2e/*.spec.ts … そのテストを録画する
// - キャプチャの仕組み自体（このディレクトリ・設定・ワークフロー） … 全ページ（仕組みが動くかを確かめるため）
import { readFileSync } from "node:fs";
import { PAGES } from "./pages.mjs";

const changed = readFileSync(0, "utf8")
  .split("\n")
  .map((f) => f.trim())
  .filter(Boolean);
const files = changed.filter((f) => f.startsWith("frontend/")).map((f) => f.slice("frontend/".length));

const pages = new Set();
const specs = new Set();
const all = () => PAGES.forEach((p) => pages.add(p.name));

if (changed.includes(".github/workflows/pr-screenshots.yml")) all();

for (const file of files) {
  if (file.startsWith("screenshots/") || file === "playwright.screenshots.config.ts") {
    all();
    continue;
  }
  if (/^e2e\/[^/]+\.spec\.ts$/.test(file)) {
    specs.add(file);
    continue;
  }
  if (!file.startsWith("src/") || /\.test\.tsx?$/.test(file) || file === "src/lib/api-schema.ts") continue;

  const app = file.match(/^src\/app\/(.+)$/);
  if (!app || app[1].startsWith("actions/")) {
    all();
    continue;
  }
  const dir = app[1].includes("/") ? app[1].slice(0, app[1].lastIndexOf("/")) : "";
  if (dir === "") {
    all();
    continue;
  }
  for (const p of PAGES) {
    if (p.dir === dir || p.dir.startsWith(`${dir}/`)) pages.add(p.name);
  }
}

const order = PAGES.map((p) => p.name);
console.log(
  JSON.stringify({
    pages: [...pages].sort((a, b) => order.indexOf(a) - order.indexOf(b)),
    specs: [...specs].sort(),
  }),
);
