#!/bin/zsh
set -eu
recovery_project="${0:A:h:h}"
if command -v node >/dev/null 2>&1; then
  recovery_node="$(command -v node)"
else
  recovery_node="/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node"
fi
"$recovery_node" "$recovery_project/tools/private-recovery.mjs" --create
read -r '?Press Return to close this window.'
