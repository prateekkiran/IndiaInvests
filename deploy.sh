#!/usr/bin/env bash
# Non-interactive build + deploy for India Investment Journey -> Netlify (free).
#
# Why a token: netlify-cli's interactive browser login crashes on some setups
# ("TypeError: Cannot set property name ..."). A Personal Access Token skips that
# login flow entirely and is the standard way to deploy non-interactively.
#
# One-time setup (30 seconds, free):
#   1. Open https://app.netlify.com/user/applications#personal-access-tokens
#   2. "New access token" -> name it (e.g. "cli") -> Generate -> copy it.
# Then run:
#   NETLIFY_AUTH_TOKEN=paste_your_token_here ./deploy.sh
#
set -euo pipefail
cd "$(dirname "$0")"

if [ -z "${NETLIFY_AUTH_TOKEN:-}" ]; then
  echo "ERROR: NETLIFY_AUTH_TOKEN is not set."
  echo
  echo "Create one (free, 30s):"
  echo "  1. https://app.netlify.com/user/applications#personal-access-tokens"
  echo "  2. 'New access token' -> copy it."
  echo "  3. Re-run:  NETLIFY_AUTH_TOKEN=your_token ./deploy.sh"
  exit 1
fi

echo "==> Installing dependencies…"
npm install

echo "==> Running engine tests (PRD golden fixtures)…"
npm test

echo "==> Building production bundle into ./dist …"
npm run build

# Prefer a direct binary (bypasses any npx/npm wrapper); fall back to npx.
if [ -x "./node_modules/.bin/netlify" ]; then
  NETLIFY="./node_modules/.bin/netlify"
else
  NETLIFY="npx --yes netlify"
fi

# Create & link a site on first run; reuse it afterwards.
if [ ! -f ".netlify/state.json" ]; then
  echo "==> Creating a new Netlify site…"
  RESP=$(curl -sS -H "Authorization: Bearer $NETLIFY_AUTH_TOKEN" \
    -H "Content-Type: application/json" \
    -X POST "https://api.netlify.com/api/v1/sites" -d '{}')
  SITE_ID=$(node -e "try{process.stdout.write(String(JSON.parse(process.argv[1]).id||''))}catch(e){}" "$RESP")
  if [ -z "$SITE_ID" ]; then
    echo "    Failed to create a site. API response was:"
    echo "$RESP"
    exit 1
  fi
  mkdir -p .netlify
  node -e "require('fs').writeFileSync('.netlify/state.json', JSON.stringify({siteId: process.argv[1]}, null, 2))" "$SITE_ID"
  echo "    Created and linked site $SITE_ID"
else
  SITE_ID=$(node -e "process.stdout.write(String(JSON.parse(require('fs').readFileSync('.netlify/state.json','utf8')).siteId||''))")
  echo "==> Reusing linked site $SITE_ID"
fi

echo "==> Deploying to production…"
$NETLIFY deploy --prod --dir=dist --site "$SITE_ID" --auth "$NETLIFY_AUTH_TOKEN"

echo
echo "==> Done. The 'Website URL' printed above is your live app."
