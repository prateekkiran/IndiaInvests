#!/usr/bin/env bash
# Create a GitHub repo for IndiaInvests and wire up GitHub Actions auto-deploy
# to the EXISTING Netlify site. On every push to main, Actions builds + deploys.
#
# Prereqs:
#   - gh CLI authenticated  (you already use it for HisaabKitaab; else: gh auth login)
#   - NETLIFY_AUTH_TOKEN set (same token you deployed with)
#
# Usage:
#   NETLIFY_AUTH_TOKEN=your_token ./setup_github.sh [repo-name] [public|private]
set -euo pipefail
cd "$(dirname "$0")"

REPO_NAME="${1:-IndiaInvests}"
VISIBILITY="${2:-public}"
SITE_ID="e86cd480-9016-4a6c-b6eb-60ce514767b0"

if [ -z "${NETLIFY_AUTH_TOKEN:-}" ]; then
  echo "ERROR: set NETLIFY_AUTH_TOKEN (the token you deployed with). Example:"
  echo "  NETLIFY_AUTH_TOKEN=your_token ./setup_github.sh $REPO_NAME $VISIBILITY"
  exit 1
fi
if ! command -v gh >/dev/null 2>&1; then
  echo "ERROR: GitHub CLI (gh) not found. Install it or run: gh auth login"
  exit 1
fi

# 1. Git init + first commit (safe to re-run).
if [ ! -d .git ]; then
  echo "==> Initialising git repo…"
  git init -b main
fi
git add -A
git commit -m "India Investment Journey — initial commit" >/dev/null 2>&1 || echo "    (nothing new to commit)"

# 2. Create the GitHub repo and push (or reuse if it already exists).
if gh repo view "$REPO_NAME" >/dev/null 2>&1; then
  echo "==> Repo $REPO_NAME already exists; adding remote if needed…"
  OWNER=$(gh api user --jq .login)
  git remote add origin "https://github.com/$OWNER/$REPO_NAME.git" 2>/dev/null || true
  git push -u origin main
else
  echo "==> Creating GitHub repo '$REPO_NAME' ($VISIBILITY) and pushing…"
  gh repo create "$REPO_NAME" "--$VISIBILITY" --source=. --remote=origin --push
fi

# 3. Store the two secrets the workflow needs.
echo "==> Setting repository secrets for the deploy workflow…"
gh secret set NETLIFY_AUTH_TOKEN -b"$NETLIFY_AUTH_TOKEN"
gh secret set NETLIFY_SITE_ID    -b"$SITE_ID"

# 4. Kick off the first Actions run now (optional; it also runs on every push).
gh workflow run "Build & Deploy to Netlify" >/dev/null 2>&1 || true

OWNER=$(gh api user --jq .login)
echo
echo "==> Done. Repo: https://github.com/$OWNER/$REPO_NAME"
echo "    Every 'git push' to main now builds, tests and deploys automatically."
echo "    Watch the first run:  gh run watch"
