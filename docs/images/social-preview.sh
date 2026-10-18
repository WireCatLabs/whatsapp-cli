#!/usr/bin/env bash
# Renders social-preview.svg to the 1280×640 PNG the README and GitHub's social preview use.
# Needs Google Chrome, ImageMagick, optipng and the DejaVu Sans and DejaVu Sans Mono fonts, the same faces as tg's
# and max's banners.
set -euo pipefail
cd "$(dirname "$0")"
profile="$(mktemp -d)"
trap 'rm -rf "$profile"' EXIT
google-chrome --headless --no-sandbox --disable-gpu --hide-scrollbars --window-size=1280,640 \
  --user-data-dir="$profile" --screenshot="$PWD/social-preview.png" "file://$PWD/social-preview.svg" 2>/dev/null
magick social-preview.png -alpha off -strip -define png:color-type=2 social-preview.png
optipng -quiet -o7 social-preview.png
