#!/usr/bin/env bash
# Rename the Netlify site (changes the *.netlify.app subdomain).
# Usage:  NETLIFY_AUTH_TOKEN=your_token ./rename_site.sh india-investment-journey
set -euo pipefail
cd "$(dirname "$0")"

NEW_NAME="${1:-india-investment-journey}"
SITE_ID="e86cd480-9016-4a6c-b6eb-60ce514767b0"

if [ -z "${NETLIFY_AUTH_TOKEN:-}" ]; then
  echo "ERROR: set NETLIFY_AUTH_TOKEN. Example:"
  echo "  NETLIFY_AUTH_TOKEN=your_token ./rename_site.sh $NEW_NAME"
  exit 1
fi

echo "==> Renaming site to '$NEW_NAME' …"
RESP=$(curl -sS -H "Authorization: Bearer $NETLIFY_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -X PATCH "https://api.netlify.com/api/v1/sites/$SITE_ID" \
  -d "{\"name\": \"$NEW_NAME\"}")

URL=$(node -e "try{const j=JSON.parse(process.argv[1]);process.stdout.write(j.ssl_url||j.url||'')}catch(e){}" "$RESP")
ERR=$(node -e "try{const j=JSON.parse(process.argv[1]);process.stdout.write(j.error||'')}catch(e){}" "$RESP")

if [ -n "$ERR" ]; then
  echo "    Could not rename: $ERR"
  echo "    (That name may be taken — try another, names are globally unique.)"
  exit 1
fi
echo "==> Done. New URL: ${URL:-https://$NEW_NAME.netlify.app}"
