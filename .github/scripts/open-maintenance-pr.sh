#!/usr/bin/env bash
# weekly-maintenance.yml の PR を作るジョブから呼ばれ、AI のジョブが作った patch を、きれいに checkout し直した main に当てて PR にする
#   使い方：open-maintenance-pr.sh <ブランチ名> <patch などのディレクトリ> <変えてよいパスの正規表現> [除外するパスの正規表現]
#   入力：changes.patch・pr-title.txt・pr-body.md（AI のジョブの成果物。中身は信頼しない）
#   GH_TOKEN：専用 GitHub App のトークン（push と PR の作成に使う）
# AI や更新したライブラリのコードは、このジョブでは一切動かさない（patch を当てるだけ）。
# ブランチは毎週上書きする（--force）。同じブランチの PR が開いていれば、タイトルと本文を更新する。
set -euo pipefail

branch="$1"
dir="$2"
allowed="$3"
denied="${4:-}"
label=maintenance

# patch が触るファイル（名前の変更は「削除＋追加」として両方を見る）が、決まった範囲の中か
files=$(git apply --numstat "$dir/changes.patch" | cut -f3)
outside=$(echo "$files" | grep -vE "$allowed" || true)
if [ -n "$denied" ]; then
  outside=$(printf '%s\n%s\n' "$outside" "$(echo "$files" | grep -E "$denied" || true)" | sed '/^$/d')
fi
if [ -n "$outside" ]; then
  echo "::error::変えてよい範囲の外のファイルが変わっています。PR は作りません:"
  echo "$outside"
  exit 1
fi

git apply --index "$dir/changes.patch"
echo "変わったファイル："
git diff --cached --stat

bot="matsushin-claude-bot[bot]"
bot_id=$(gh api "/users/${bot}" --jq .id)
git config user.name "$bot"
git config user.email "${bot_id}+${bot}@users.noreply.github.com"
# checkout はトークンを残していないので、ここで App のトークンを使う
git remote set-url origin "https://x-access-token:${GH_TOKEN}@github.com/${GITHUB_REPOSITORY}.git"

title=$(head -n 1 "$dir/pr-title.txt" | cut -c1-120)
git switch -c "$branch"
git commit --quiet -m "$title" -m "$(printf 'weekly-maintenance.yml による自動の変更\n\nCo-Authored-By: Claude <noreply@anthropic.com>')"
git push --force origin "HEAD:${branch}"

gh label create "$label" --color c5def5 --description "AI による週1回のメンテナンス" 2>/dev/null || true
number=$(gh pr list --head "$branch" --state open --json number --jq '.[0].number // empty')
if [ -n "$number" ]; then
  gh pr edit "$number" --title "$title" --body-file "$dir/pr-body.md"
  echo "#${number} を更新しました"
else
  gh pr create --base main --head "$branch" --title "$title" --body-file "$dir/pr-body.md" --label "$label"
fi
