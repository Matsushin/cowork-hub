---
name: weekly-maintenance
description: ee-office（cowork-hub）の週1回のメンテナンスを AI が行うときの手順。依存ライブラリの更新（パッチ・マイナーまで）と、ドキュメント（README・CLAUDE.md・スキル）とコードの食い違いの修正の2つ。.github/workflows/weekly-maintenance.yml から呼ばれる。手元で同じ作業をするときにも使える。
---

# 週1回のメンテナンス（ee-office）

`.github/workflows/weekly-maintenance.yml` が毎週月曜 9:00（日本時間）に、次の2つを別々のジョブで行う。

| 作業 | ブランチ | AI ができること |
|---|---|---|
| 依存ライブラリの更新 | `maintenance/deps` | ファイルの読み書き、bundle・npm、テスト・静的解析の実行 |
| ドキュメントの見直し | `maintenance/docs` | ファイルを読む、git の履歴を見る、ドキュメントだけ書き換える |

**AI はコミット・push・PR の作成をしない。** 変更をファイルに残し、PR のタイトルと本文を `/tmp/maintenance/` に書くところまで。
コミット・push・PR はワークフローの次のステップ（決まったコマンド）が行う。main にブランチ保護がないため、AI に push の権限を渡さない。

出力するファイル（両方の作業で共通）

- `/tmp/maintenance/pr-title.txt`：PR のタイトル1行（日本語）
- `/tmp/maintenance/pr-body.md`：PR の本文（日本語。形は各作業の最後に書く）
- 変える必要がなかったときは**どちらのファイルも作らない**（PR は作られない）

PR はブランチごとに1本で、毎週上書きされる（`--force` で push）。このブランチに人が手でコミットを積まない。
マージは人が行う。

---

## A. 依存ライブラリの更新

対象は backend（`Gemfile.lock`）と frontend（`package-lock.json`）。**パッチ・マイナーの更新まで**。メジャーの更新は行わず、PR の本文で知らせるだけ。
Ruby・Node.js・Docker のベースイメージ・Terraform のバージョンは対象外（人が判断する）。

1. 更新前の状態を記録する
   - backend：`bundle outdated --only-explicit --parseable`
   - frontend：`npm outdated --json`（更新が残っているときは終了コードが 1 になるが、失敗ではない）
2. 更新する
   - backend：`bundle update --minor`（Gemfile の指定の範囲で、メジャーを上げない）
   - frontend：`npm update`（package.json の `^` の範囲で、メジャーを上げない）
   - `git diff --stat` で何が変わったかを確かめる。何も変わらなければ、ここで終わる（ファイルを作らない）
3. CI と同じ確認をする。すべて通るまで次に進まない
   - backend：`bundle exec rspec`、`bin/rubocop`、`bin/brakeman --no-pager`、`bin/bundler-audit check --update`
   - backend：`bin/rails rswag:specs:swaggerize` のあと `git diff --stat swagger/` で、仕様書が変わっていないか（変わったら差分を本文に書く）
   - frontend：`npm run lint`、`npm run format:check`、`npx tsc --noEmit`、`npm test`、`npm run build`
4. 失敗したとき
   - 原因の更新を絞り込む（失敗のメッセージに出るライブラリ、変更履歴の中で関係しそうなもの）
   - **更新に合わせた小さな修正**（非推奨になった書き方の置き換え、型の付け直し、RuboCop の新しいルールへの対応）なら直してよい。直したファイルと理由を本文に書く
   - 直すのに仕様の判断や大きな書き換えが要るなら、そのライブラリだけ元のバージョンに戻す
     - backend：`Gemfile.lock` の該当の gem の行を `git diff` で見て、元のバージョンに Edit で戻し、`bundle install` で整合を取る
     - frontend：`git checkout -- package-lock.json` で戻してから、戻したいもの以外を `npm update <名前> ...` で個別に上げ直す（`npm install <名前>@<版>` は package.json の範囲を書き換えるので使わない）
   - 戻したものは本文の「見送ったもの」に、失敗の要点と一緒に書く
5. `/tmp/maintenance/` に出力する。タイトルは「依存ライブラリの更新（YYYY-MM-DD）」。本文は次の形

```markdown
AI による週1回の依存ライブラリの更新です（`.github/workflows/weekly-maintenance.yml`、手順は `.claude/skills/weekly-maintenance/SKILL.md`）。

## 更新したもの
| | ライブラリ | 変更前 | 変更後 | 種類 |
|---|---|---|---|---|
| backend | rails | 8.1.1 | 8.1.2 | パッチ |

## 更新に合わせて直したコード
（なければ「なし」）

## 見送ったもの
（更新すると失敗するため元に戻したもの。なければ「なし」）

## メジャーの更新が出ているもの（人の判断が要る）
| | ライブラリ | 今 | 最新 |
|---|---|---|---|

## 確認したこと
- [x] backend：rspec・rubocop・brakeman・bundler-audit
- [x] frontend：lint・format・tsc・test・build

## 確認できていないこと
- E2E（Playwright）はこの PR の CI で確かめる
- 本番での動作はマージ・デプロイ後に確かめる
```

- 変更履歴を Web で調べることはできない。セキュリティの修正を含むかどうかは、bundler-audit・`npm audit` の結果と、手元で分かる範囲で書き、推測なら推測と書く

---

## B. ドキュメントの見直し

README.md、CLAUDE.md、`.claude/skills/*/SKILL.md` が、今のコードと食い違っていないかを確かめて直す。

1. この1週間の変更を見る：`git log --since="8 days ago" --stat --format="%h %s"`。コードを変えたのにドキュメントを変えていないコミットに注目する
2. ドキュメントに書かれた事実をコードと照らし合わせる。特に
   - コマンド（`bin/…`・`npm run …`・`terraform …`）が今も存在し、書かれた通りに使えるか（package.json の scripts、`backend/bin/`、Makefile など）
   - ファイル・ディレクトリのパス、環境変数・SSM のパラメーター名、ワークフローのファイル名
   - API のパス（`backend/config/routes.rb`・`backend/swagger/`）、画面のパス（`frontend/src/app/`）
   - バージョン（`.ruby-version`・`package.json` の engines・Dockerfile・`infra/` の Terraform のバージョン）
3. 食い違いを直す。**事実の食い違いだけを直す**。言い回しの好み、章立ての変更、新しい説明の追加はしない。コードは変えない
   - 判断できないもの（どちらが正しいか分からない、仕様の話になる）は直さず、本文の「人に確かめてほしいこと」に書く
4. 直すものがなければ、ファイルを作らずに終わる
5. `/tmp/maintenance/` に出力する。タイトルは「ドキュメントとコードの食い違いを直す（YYYY-MM-DD）」。本文は次の形

```markdown
AI による週1回のドキュメントの見直しです（`.github/workflows/weekly-maintenance.yml`、手順は `.claude/skills/weekly-maintenance/SKILL.md`）。

## 直したこと
| ファイル | 書かれていたこと | 実際（根拠のファイル） |
|---|---|---|

## 人に確かめてほしいこと
（なければ「なし」）

## 見た範囲
- この1週間のコミット：N 件
- 照らし合わせたドキュメント：…
```
