---
name: security-check
description: ee-office（cowork-hub）の変更をセキュリティの観点で確かめるときの手順とチェックリスト。PR ごとに .github/workflows/claude-security-review.yml から呼ばれる。AI が書いたコード（claude-implement・@claude・週1回のメンテナンスの PR）も人が書いたコードも同じ基準で見る。手元で「この変更のセキュリティを見て」と頼まれたときにも使う。
---

# セキュリティの確認（ee-office）

自動の静的解析（CI）は次のものを見ている。ここではそれで拾えないもの、**このアプリの守りの仕組みが崩れていないか**を見る。

| CI のチェック | 見ているもの |
|---|---|
| `bin/brakeman` | Rails の危ない書き方（SQL インジェクション、Mass Assignment など） |
| `bin/bundler-audit` | gem の既知の脆弱性 |
| `npm audit --omit=dev --audit-level=high` | 本番で使う npm パッケージの既知の脆弱性（high 以上） |
| GitHub の secret scanning・push protection | 秘密情報のコミット |

## 進め方

1. `gh pr diff` で変更を読み、変わったファイルの周辺（呼び出し元・Policy・ルーティング）も Read・Grep で確かめる
2. 下のチェックリストのうち、変更に関係する項目だけを確かめる
3. **攻撃の筋道を具体的に書けるものだけ**を指摘する（誰が・どのリクエストで・何ができてしまうか）。「念のため」「一般論として」の指摘はしない
4. 確信度が低いものは指摘にせず、総評の「気になったが確かめきれなかったこと」に1行で書く

重要度

- 【重大】マージすると、他人のデータの閲覧・変更、権限の昇格、秘密情報の漏えい、認証の回避ができてしまう
- 【注意】条件がそろえば悪用できる、または守りが一段減る（多層防御の1枚が外れる）
- 【参考】今は問題ないが、将来の変更で穴になりやすい書き方

## チェックリスト

### Rails（backend）

- **認可**：新しいアクションで `authorize` か `policy_scope` を通しているか。`Model.find(params[:id])` を直接使っていないか（他人のレコードは `policy_scope(...).find` で 404）
- 管理 API が `Admin::BaseController` を継承しているか（AdminPolicy の確認を通るか）
- **Strong Parameters**：`permit` に `role`・`admin`・`user_id`・`amount`・`status` など、利用者に決めさせてはいけない項目が入っていないか。料金（amount）はサーバーで確定しているか
- **認証**：`skip_before_action` で認証を外したアクションが、外してよいものか。パラメーターの型を確かめずに `authenticate_by` などに渡していないか（#44 で直した、配列やハッシュを渡されると 500 になる問題）
- **SQL**：`where("... #{...}")`・`order(params[...])`・`find_by_sql` に入力をそのまま入れていないか
- **レスポンス**：`password_digest`・トークン・他人のメールアドレスを JSON に含めていないか（シリアライズの対象を確かめる）
- **QR チェックイン**：`CheckinCode` の比較が時間枠の外を通さないか、比較に `ActiveSupport::SecurityUtils.secure_compare` を使っているか
- **並行操作**：予約・チェックインのロック（`reserve!`・`check_in!`）を通らずにレコードを作る道ができていないか
- **ログ**：トークンやパスワードをログに出していないか（`filter_parameters` に入っているか）

### Next.js（frontend）

- **Server Actions**：`app/actions/` の関数は外から直接呼べる公開 API と同じ。引数を `parseInput` で検証しているか、ID をそのまま Rails に渡しても Rails 側で認可されるか
- 認証トークン（httpOnly Cookie）をクライアントコンポーネント・props・ログに渡していないか
- `INTERNAL_API_KEY`・`BASIC_AUTH_PASSWORD` など `NEXT_PUBLIC_` の付かない環境変数を、クライアントに渡るコードで使っていないか。秘密に `NEXT_PUBLIC_` を付けていないか
- `dangerouslySetInnerHTML`・`href={入力}`（`javascript:` を通す）を使っていないか
- **リダイレクト**：`?next=` などの入力から飛び先を決めるときに `safeRedirectPath` を通しているか（外部の URL に飛ばせないか）
- `src/proxy.ts`：Basic 認証・ログイン確認の対象外にするパス（`config.matcher`）を広げていないか。完全一致になっているか
- ブラウザから Rails の API を直接呼ぶコードを足していないか（`apiFetch` を通す約束）

### インフラ・CI（infra・.github）

- セキュリティグループ・ALB のルールで、Rails（`/api/*`）を `X-Internal-Api-Key` なしで外に出していないか
- 秘密情報を `environment`（平文）に書いていないか（SSM の SecureString を `secrets` で渡す）
- IAM のポリシーで `*` の権限を足していないか
- ワークフロー：`pull_request_target` や、Issue・PR の本文やタイトルを `${{ }}` で `run:` に直接埋め込んでいないか（コマンドインジェクション）。
  AI のジョブの `--allowedTools` や `permissions` を広げていないか、ボットを起動条件に足すときに範囲を絞っているか
- 依存の追加：知らないパッケージ・作者の怪しい gem や npm パッケージ、`postinstall` で何かを実行するものを足していないか（タイポスクワッティング）

## 結果の書き方（ワークフローから呼ばれたとき）

- 指摘は該当行へのインラインコメント（`mcp__github_inline_comment__create_inline_comment` に confirmed: true）で、先頭に重要度（【重大】【注意】【参考】）を付け、「攻撃の筋道」と「直し方」を書く
- 最後に総評を `gh pr comment` で1件だけ書く。形は

```markdown
## AI によるセキュリティレビュー

指摘：重大 N 件／注意 N 件／参考 N 件
（指摘がなければ「セキュリティ上の問題は見つかりませんでした」と、見た観点を1行）

気になったが確かめきれなかったこと：（なければ省く）
```

- 【重大】の件数を `/tmp/security/high-count.txt` に数字だけで書く（1件以上あると CI のチェックが失敗し、マージ前に気づける）
