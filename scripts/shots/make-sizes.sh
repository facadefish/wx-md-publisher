#!/usr/bin/env bash
# 把 2x 原图整理成两套可直接用的尺寸：
#   预览区竖图 → 1080×1350（4:5，小红书竖版主流）
#   工作台横图 → 1920×1080（16:9，产品全景/功能展示）
# 发布弹窗里的账号 ID 做局部模糊（对外发图不露内部标识）。
set -eu
cd "$(dirname "$0")/../.."                    # 仓库根
RAW=docs/screenshots/raw
OUT=docs/screenshots/xiaohongshu
mkdir -p "$OUT/4x5" "$OUT/16x9"

p45()  { ffmpeg -y -v error -i "$1" -vf "scale=1080:-2,crop=1080:1350:0:(ih-1350)/2" -frames:v 1 "$2"; echo "  4:5  $2"; }
p169() { ffmpeg -y -v error -i "$1" -vf "scale=1920:-2" -frames:v 1 "$2"; echo "  16:9 $2"; }

p45  "$RAW/03-preview-editorial.png" "$OUT/4x5/01-排版效果-编辑部手记.png"
p45  "$RAW/09-preview-phone.png"     "$OUT/4x5/02-手机预览.png"
p45  "$RAW/03-preview-eastern.png"   "$OUT/4x5/03-排版效果-东方笺谱.png"
p45  "$RAW/03-preview-gold.png"      "$OUT/4x5/04-排版效果-黑金奢华.png"
p45  "$RAW/03-preview-bauhaus.png"   "$OUT/4x5/05-排版效果-包豪斯.png"

p169 "$RAW/01-workspace-default.png" "$OUT/16x9/01-工作台全景.png"
p169 "$RAW/02-editor.png"            "$OUT/16x9/02-只写Markdown.png"
p169 "$RAW/05-theme-panel.png"       "$OUT/16x9/03-自定义主题面板.png"
p169 "$RAW/08-snippets.png"          "$OUT/16x9/05-片段库.png"

# 发布弹窗：把「发布账号」那行抹糊
ffmpeg -y -v error -i "$RAW/07-publish.png" -filter_complex \
  "[0:v]scale=1920:-2,split[a][b];[b]crop=400:44:660:596,boxblur=10:2[bl];[a][bl]overlay=660:596" \
  -frames:v 1 "$OUT/16x9/04-一键进草稿箱.png"
echo "  16:9 $OUT/16x9/04-一键进草稿箱.png (账号已模糊)"

find "$OUT" -name "*.png" | sort
