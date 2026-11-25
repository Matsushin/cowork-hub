#!/usr/bin/env bash
# AI 機能のデモを録画して、docs/ai/demo/ に GIF を作る（実際の Claude を呼ぶので料金がかかる）
#   cd frontend && npm run demo:record
set -euo pipefail
cd "$(dirname "$0")/.."
command -v ffmpeg >/dev/null || { echo "ffmpeg が必要です（brew install ffmpeg）"; exit 1; }

# 録画し直さずに GIF だけ作り直すときは SKIP_RECORD=1
if [[ -z "${SKIP_RECORD:-}" ]]; then
  rm -rf test-results-demo
  npx playwright test -c playwright.demo.config.ts "$@"
fi

out=../docs/ai/demo
mkdir -p "$out"
for f in test-results-demo/*/video.webm; do
  dir=$(basename "$(dirname "$f")")
  case "$dir" in
    *予約*) name=booking ;;
    *分析*) name=analytics ;;
    *FAQ*) name=faq ;;
    *) continue ;;
  esac
  # 左下の Next.js の開発用の表示（「N」のボタン）を、背景の色で塗りつぶす（画面の中身は x=144 から始まるので重ならない）
  # 幅 960px・毎秒10コマ、最後の画面で2秒止める。色は動画ごとに作ったパレットで減らす
  ffmpeg -nostdin -loglevel error -y -i "$f" \
    -vf "drawbox=x=0:y=ih-90:w=140:h=90:color=0xFAFBF8:t=fill,fps=10,tpad=stop_mode=clone:stop_duration=2,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer" \
    "$out/$name.gif"
  echo "$out/$name.gif（$(du -h "$out/$name.gif" | cut -f1)）"
done
