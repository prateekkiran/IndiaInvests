#!/usr/bin/env bash
# project-sync.sh — the one command for the git-first workflow in AGENTS.md.
#
#   bash project-sync.sh                 # START/VERIFY: fetch, rebase, install, test
#   bash project-sync.sh "commit message" # END: commit all, rebase, push, verify clean
#
# With no argument it syncs the local copy FROM origin/main and runs the test
# baseline. With a message it commits everything, pushes to origin/main, and
# confirms the tree is clean and up to date — i.e. safe to delete locally.
set -euo pipefail
cd "$(dirname "$0")"

BRANCH="main"
MSG="${1:-}"

echo "== Repository =="
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || { echo "Not a git repo."; exit 1; }
git remote -v | sed -n '1p'
echo "Branch: $(git rev-parse --abbrev-ref HEAD)"
echo

echo "== Fetching origin =="
git fetch origin

if [ -n "$MSG" ]; then
  echo "== Committing all local changes =="
  git add -A
  if git diff --cached --quiet; then
    echo "(nothing new to commit)"
  else
    git commit -m "$MSG"
  fi
fi

echo "== Rebasing onto origin/$BRANCH =="
git pull --rebase origin "$BRANCH"

if [ -n "$MSG" ]; then
  echo "== Pushing to origin/$BRANCH =="
  git push origin "$BRANCH"
fi

echo "== Dependencies =="
npm install

echo "== Test baseline =="
npm test

echo
echo "== Final status (clean + up to date == safe to delete locally) =="
git status -sb
git log --oneline -3
echo
echo "Done. If status shows '## main...origin/main' with no ahead/behind and a clean tree,"
echo "the project is fully checked in to git and the local folder is safe to delete."
