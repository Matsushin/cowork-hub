// 変わったファイルの一覧（リポジトリ直下からのパス、1行に1つ）を標準入力で受け取り、
// 撮るページと、録画するE2Eのテストを JSON で出力する
//   node frontend/screenshots/targets.mjs < changed-files.txt
//   → {"pages":["location","visits"],"specs":["e2e/checkin.spec.ts"]}
//
// 決め方
// - src のファイルは、import をたどって、そのファイルを使っているページ（page.tsx）とレイアウト（layout.tsx）を探す
//   - ページに届いたら、そのページを撮る
//   - レイアウトに届いたら、そのディレクトリの下のページを全部撮る（src/app 直下の layout なら全ページ）。loading・error なども同じ
//   - 型だけの import（import type）はたどらない（見た目は変わらないため）
// - src/app 直下の layout 以外のファイル（globals.css など）と src/proxy.ts … 全ページ
// - どのページからも使われていないファイル … 撮らない
// - テスト（*.test.ts）・生成物（src/lib/api-schema.ts） … 対象外
// - e2e/*.spec.ts … そのテストを録画する
// - キャプチャの仕組み自体（このディレクトリ・設定・ワークフロー） … 全ページと、E2Eの全部の録画（仕組みが動くかを確かめるため）
// - 削除されたファイル … 使っていた画面が分からないので全ページ
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PAGES } from "./pages.mjs";

const frontendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = path.join(frontendDir, "src");

const changed = readFileSync(0, "utf8")
  .split("\n")
  .map((f) => f.trim())
  .filter(Boolean);
const files = changed.filter((f) => f.startsWith("frontend/")).map((f) => f.slice("frontend/".length));

const pages = new Set();
const specs = new Set();
const all = () => PAGES.forEach((p) => pages.add(p.name));

// --- import のつながり（使われる側 → 使う側）を作る ---
const EXTENSIONS = ["", ".ts", ".tsx", ".js", ".mjs", ".css", "/index.ts", "/index.tsx"];
const sources = readdirSync(srcDir, { recursive: true })
  .map((f) => `src/${String(f).split(path.sep).join("/")}`)
  .filter((f) => /\.(tsx?|mjs|js)$/.test(f));

function resolveImport(from, spec) {
  let base;
  if (spec.startsWith("@/")) base = `src/${spec.slice(2)}`;
  else if (spec.startsWith(".")) base = path.posix.normalize(path.posix.join(path.posix.dirname(from), spec));
  else return null; // パッケージ
  for (const ext of EXTENSIONS) {
    if (existsSync(path.join(frontendDir, base + ext))) return base + ext;
  }
  return null;
}

const importedBy = new Map();
const IMPORT_RE =
  /(?:^|\n)\s*(import|export)\s+(type\s+)?(?:[^'"]*?\sfrom\s+)?["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;
for (const file of sources) {
  const text = readFileSync(path.join(frontendDir, file), "utf8");
  for (const m of text.matchAll(IMPORT_RE)) {
    if (m[2]) continue; // import type
    const target = resolveImport(file, m[3] ?? m[4]);
    if (!target) continue;
    if (!importedBy.has(target)) importedBy.set(target, new Set());
    importedBy.get(target).add(file);
  }
}

// ファイルを使っている page.tsx・layout.tsx を探し、撮るページを足す
function addPagesUsing(file) {
  const seen = new Set([file]);
  const queue = [file];
  while (queue.length > 0) {
    const current = queue.shift();
    // page 以外の特別なファイル（layout・loading・error など）は import されないが、そのディレクトリの下のページに効く
    const app = current.match(/^src\/app\/(?:(.*)\/)?(page|layout|loading|error|not-found|template)\.tsx$/);
    if (app) {
      const dir = app[1] ?? "";
      for (const p of PAGES) {
        if (app[2] === "page" ? p.dir === dir : dir === "" || p.dir === dir || p.dir.startsWith(`${dir}/`)) pages.add(p.name);
      }
    }
    for (const user of importedBy.get(current) ?? []) {
      if (!seen.has(user)) {
        seen.add(user);
        queue.push(user);
      }
    }
  }
}

// キャプチャの仕組み自体が変わったときは、全ページを撮り、E2Eも全部録画して、仕組みが動くかを確かめる
function allWithVideos() {
  all();
  for (const f of readdirSync(path.join(frontendDir, "e2e"))) {
    if (f.endsWith(".spec.ts")) specs.add(`e2e/${f}`);
  }
}

if (changed.includes(".github/workflows/pr-screenshots.yml")) allWithVideos();

for (const file of files) {
  if (file.startsWith("screenshots/") || file === "playwright.screenshots.config.ts") {
    allWithVideos();
    continue;
  }
  if (/^e2e\/[^/]+\.spec\.ts$/.test(file)) {
    specs.add(file);
    continue;
  }
  if (!file.startsWith("src/") || /\.test\.tsx?$/.test(file) || file === "src/lib/api-schema.ts") continue;
  const rootSpecial = /^src\/app\/(page|layout|loading|error|not-found|template)\.tsx$/.test(file);
  if (!existsSync(path.join(frontendDir, file)) || file === "src/proxy.ts" || (/^src\/app\/[^/]+$/.test(file) && !rootSpecial)) {
    all();
    continue;
  }
  addPagesUsing(file);
}

const order = PAGES.map((p) => p.name);
console.log(
  JSON.stringify({
    pages: [...pages].sort((a, b) => order.indexOf(a) - order.indexOf(b)),
    specs: [...specs].sort(),
  }),
);
