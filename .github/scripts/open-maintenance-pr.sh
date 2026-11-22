#!/usr/bin/env bash
# weekly-maintenance.yml から呼ばれ、AI が残した変更をコミットして PR にする（AI に push の権限を渡さないため、ここは決まったコマンドだけ）
#   使い方：open-maintenance-pr.sh <ブランチ名>
#   AI の出力：/tmp/maintenance/pr-title.txt・pr-body.md（ないときは、変える必要がなかったということ）
# ブランチは毎週上書きする（--force）。同じブランチの PR が開いていれば、タイトルと本文を更新する。
set -euo pipefail

branch="$1"
out=/tmp/maintenance
label=maintenance

if [ ! -s "$out/pr-title.txt" ] || [ ! -s "$out/pr-body.md" ]; then
  echo "AI の出力がないため、PR は作りません（変える必要がなかった）"
  exit 0
fi

# setup-ruby が入れた gem（backend/vendor/bundle）はコミットしない
git add -A -- . ':(exclude)backend/vendor/bundle'
if git diff --cached --quiet; then
  echo "変更がないため、PR は作りません"
  exit 0
fi

bot="matsushin-claude-bot[bot]"
bot_id=$(gh api "/users/${bot}" --jq .id)
git config user.name "$bot"
git config user.email "${bot_id}+${bot}@users.noreply.github.com"

title=$(head -n 1 "$out/pr-title.txt")
git switch -c "$branch"
git commit --quiet -m "$title" -m "$(printf 'weekly-maintenance.yml による自動の変更\n\nCo-Authored-By: Claude <noreply@anthropic.com>')"
git push --force origin "HEAD:${branch}"

gh label create "$label" --color c5def5 --description "AI による週1回のメンテナンス" 2>/dev/null || true
number=$(gh pr list --head "$branch" --state open --json number --jq '.[0].number // empty')
if [ -n "$number" ]; then
  gh pr edit "$number" --title "$title" --body-file "$out/pr-body.md"
  echo "#${number} を更新しました"
else
  gh pr create --base main --head "$branch" --title "$title" --body-file "$out/pr-body.md" --label "$label"
fi
