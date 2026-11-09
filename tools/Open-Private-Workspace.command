#!/bin/zsh
# Local development workspace only. No credential values or file contents are printed.
cc_project_dir="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd -P)" || exit 1
cd "$cc_project_dir" || exit 1
cc_node="$(command -v node 2>/dev/null)"
if [[ -z "$cc_node" ]] || ! "$cc_node" -e 'if(Number(process.versions.node.split(".")[0])<22)process.exit(1)' 2>/dev/null; then
  cc_node="/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node"
fi
if [[ ! -x "$cc_node" ]] || ! "$cc_node" -e 'if(Number(process.versions.node.split(".")[0])<22)process.exit(1)' 2>/dev/null; then
  print 'A supported Node runtime is needed to open this private workspace.'
  read -r 'cc_finish?Press Return to close.'
  exit 1
fi
print 'Opening Curated Chaos on this Mac, using the separate development workspace.'
print 'Keep this window open. Control-C stops the private workspace and closes its sign-ins.'
print 'Task and note changes require review and approval in the app.'
"$cc_node" tools/private-session-preview-server.mjs \
  --start-private-session-preview --project=fngauurauwvbawlfzbbe \
  --allow-private-brief-read --serve-private-dashboard \
  --allow-private-task-create-reviewed --allow-private-task-edit-reviewed \
  --allow-private-task-completion --allow-private-note-read \
  --allow-private-note-edit-reviewed --allow-private-note-create-reviewed \
  --allow-private-title-search --allow-private-appearance-read --open-private-dashboard
cc_result=$?
if [[ "$cc_result" -ne 0 ]]; then
  print 'The private workspace did not open. Existing files and services were left in place.'
  read -r 'cc_finish?Press Return to close.'
fi
exit "$cc_result"
