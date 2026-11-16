#!/usr/bin/env bash
# PostToolUse（Edit / Write）のフック。
# Claude が編集したファイルを整形し、自動で直せない指摘だけを Claude に返す（終了コード2）。
#   backend/  の Ruby       … RuboCop（-a：安全な自動修正のみ）
#   frontend/ の TS/JS など … Prettier（設定は frontend/.prettierrc.json）→ ESLint --fix
#   infra/    の Terraform  … terraform fmt
# 整形できない・対象外のファイルは何もせず終了する（編集そのものは止めない）。
set -uo pipefail

file=$(jq -r '.tool_input.file_path // empty')
[ -n "$file" ] && [ -f "$file" ] || exit 0

# ワークツリーでも動くように、プロジェクトの場所は編集したファイルから求める
root=$(git -C "$(dirname "$file")" rev-parse --show-toplevel 2>/dev/null) || exit 0
rel=${file#"$root"/}

# mise.toml のバージョン（Ruby・Node・Terraform）で実行する
in_dir() {
  local dir=$1
  shift
  if command -v mise >/dev/null 2>&1; then
    (cd "$root/$dir" && mise exec -- "$@")
  else
    (cd "$root/$dir" && "$@")
  fi
}

report() {
  # 終了コード2の標準エラーは Claude に渡り、修正を促す
  echo "$1（$rel）。以下を直してください：" >&2
  echo "$2" >&2
  exit 2
}

case "$rel" in
  backend/*.rb | backend/*.rake | backend/Gemfile)
    out=$(in_dir backend bin/rubocop -a --force-exclusion --format simple "${rel#backend/}" 2>&1) ||
      report "RuboCop の指摘が残っています" "$out"
    ;;
  frontend/*.ts | frontend/*.tsx | frontend/*.js | frontend/*.mjs | frontend/*.jsx)
    in_dir frontend node_modules/.bin/prettier --write --log-level warn "${rel#frontend/}" >/dev/null 2>&1
    out=$(in_dir frontend node_modules/.bin/eslint --fix "${rel#frontend/}" 2>&1) ||
      report "ESLint のエラーが残っています" "$out"
    ;;
  frontend/*.css | frontend/*.json | frontend/*.md)
    in_dir frontend node_modules/.bin/prettier --write --log-level warn --ignore-unknown "${rel#frontend/}" >/dev/null 2>&1
    ;;
  infra/*.tf)
    out=$(in_dir infra terraform fmt "${rel#infra/}" 2>&1) ||
      report "terraform fmt で整形できませんでした（構文エラーの可能性）" "$out"
    ;;
esac
exit 0
