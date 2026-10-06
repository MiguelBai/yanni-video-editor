#!/bin/bash
# One time install for the Yanni video editor. Safe to run again: every step
# checks first and only installs what is missing. Prints a status line per tool.
set -u
ok()   { printf "OK      %s\n" "$1"; }
miss() { printf "MISSING %s\n" "$1"; }
step() { printf "\n== %s\n" "$1"; }

step "macOS"
if [ "$(uname)" != "Darwin" ]; then miss "this editor is built for macOS"; exit 1; fi
ok "$(sw_vers -productName) $(sw_vers -productVersion) on $(uname -m)"

step "Homebrew"
if ! command -v brew >/dev/null 2>&1; then
  for b in /opt/homebrew/bin/brew /usr/local/bin/brew; do [ -x "$b" ] && eval "$($b shellenv)"; done
fi
if command -v brew >/dev/null 2>&1; then ok "brew $(brew --version | head -1)"; else
  miss "Homebrew. It needs your Mac password, so YOU run it once:"
  echo '  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
  echo "Then run setup again."
  exit 2
fi

step "Node 22+, FFmpeg, whisper.cpp"
need=()
node_major=$(node -v 2>/dev/null | sed 's/v\([0-9]*\).*/\1/')
if [ -z "${node_major}" ] || [ "${node_major}" -lt 22 ]; then need+=(node); else ok "node $(node -v)"; fi
command -v ffmpeg >/dev/null 2>&1 && ok "ffmpeg $(ffmpeg -version | head -1 | cut -d' ' -f3)" || need+=(ffmpeg)
command -v whisper-cli >/dev/null 2>&1 && ok "whisper-cli" || need+=(whisper-cpp)
if [ ${#need[@]} -gt 0 ]; then
  echo "installing: ${need[*]} (a few minutes the first time)"
  brew install "${need[@]}" || { miss "brew install failed"; exit 3; }
  [ " ${need[*]} " == *" node "* ] && brew link --overwrite node >/dev/null 2>&1
  ok "installed ${need[*]}"
fi

step "Browser for screenshots and rendering"
found=""
for a in "/Applications/Google Chrome.app" "/Applications/Chromium.app" "/Applications/Microsoft Edge.app" "/Applications/Brave Browser.app"; do
  [ -d "$a" ] && found="$a"
done
if [ -n "$found" ]; then ok "$found"; else echo "no desktop Chrome; HyperFrames will use its own headless browser"; fi

step "HyperFrames (the video renderer)"
npx -y hyperframes@latest --version >/dev/null 2>&1 && ok "hyperframes $(npx -y hyperframes@latest --version 2>/dev/null | tail -1)" || { miss "hyperframes via npx"; exit 4; }
npx -y hyperframes@latest browser ensure >/dev/null 2>&1 && ok "render browser ready" || echo "render browser will download on first render"

step "Whisper model (speech to text)"
model="${1:-small.en}"
mdir="$HOME/.cache/hyperframes/whisper/models"
mkdir -p "$mdir"
if [ -s "$mdir/ggml-$model.bin" ]; then ok "ggml-$model.bin"; else
  echo "downloading $model (small.en is ~470 MB, medium.en ~1.5 GB)"
  curl -L --fail -o "$mdir/ggml-$model.bin" "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-$model.bin" && ok "ggml-$model.bin" || miss "whisper model download"
fi

step "Settings folder"
mkdir -p "$HOME/.yanni-editor"
[ -f "$HOME/.yanni-editor/brand.json" ] && ok "brand.json exists" || echo "brand.json not written yet (the setup skill asks you a few questions)"

printf "\nSETUP DONE\n"
