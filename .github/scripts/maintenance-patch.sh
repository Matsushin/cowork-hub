#!/usr/bin/env bash
# weekly-maintenance.yml の AI のジョブから呼ばれ、AI が残した変更を patch にして、PR を作るジョブに渡す準備をする
#   使い方：maintenance-patch.sh <出力先のディレクトリ>
#   出力：changes.patch・pr-title.txt・pr-body.md。GITHUB_OUTPUT に changed=true/false
# このジョブには push できるトークンがないので、ここでは判定を厳しくしない（範囲の確認は PR を作るジョブで行う）。
set -euo pipefail

dest="$1"
mkdir -p "$dest"
changed=false

if [ -s /tmp/maintenance/pr-title.txt ] && [ -s /tmp/maintenance/pr-body.md ]; then
  # setup-ruby が入れた gem（backend/vendor/bundle）は含めない
  git add -A -- . ':(exclude)backend/vendor/bundle'
  git diff --cached --binary --no-renames > "$dest/changes.patch"
  if [ -s "$dest/changes.patch" ]; then
    cp /tmp/maintenance/pr-title.txt /tmp/maintenance/pr-body.md "$dest/"
    git diff --cached --stat --no-renames
    changed=true
  else
    echo "変更がないため、PR は作りません"
  fi
else
  echo "AI の出力がないため、PR は作りません（変える必要がなかった）"
fi

echo "changed=$changed" >> "$GITHUB_OUTPUT"
