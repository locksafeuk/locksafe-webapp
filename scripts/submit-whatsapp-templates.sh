#!/bin/bash
# Create + submit WhatsApp templates via Twilio Content API.
# Idempotent-ish: run once; SIDs are printed — put them in env.
set -e
cd "$(dirname "$0")/.."
SID=$(grep '^TWILIO_ACCOUNT_SID' .env | sed 's/^[^=]*=//; s/"//g')
TOK=$(grep '^TWILIO_AUTH_TOKEN' .env | sed 's/^[^=]*=//; s/"//g')

create_and_submit() {
  local NAME="$1"; local CATEGORY="$2"; local BODY="$3"; local VARS="$4"
  echo "── $NAME"
  local RESP CONTENT_SID
  RESP=$(curl -s -u "$SID:$TOK" -X POST "https://content.twilio.com/v1/Content" \
    -H "Content-Type: application/json" \
    -d "{\"friendly_name\":\"$NAME\",\"language\":\"en_GB\",\"variables\":$VARS,\"types\":{\"twilio/text\":{\"body\":\"$BODY\"}}}")
  CONTENT_SID=$(echo "$RESP" | python3 -c "import json,sys; print(json.load(sys.stdin).get('sid',''))" 2>/dev/null)
  if [ -z "$CONTENT_SID" ]; then echo "CREATE FAILED: $RESP"; return 1; fi
  echo "content_sid: $CONTENT_SID"
  curl -s -u "$SID:$TOK" -X POST "https://content.twilio.com/v1/Content/$CONTENT_SID/ApprovalRequests/whatsapp" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"$NAME\",\"category\":\"$CATEGORY\"}" \
    | python3 -c "import json,sys; d=json.load(sys.stdin); print('approval:', d.get('status', d))"
}

create_and_submit "locksmith_recruit_invite" "MARKETING" \
  "Hi {{1}}, we're inviting trusted locksmiths in {{2}} to join LockSafe UK — free to join, you set your own rates, and emergency jobs in your area go straight to your phone. Interested? Reply YES and we'll get you set up. Reply STOP to opt out." \
  '{"1":"John","2":"Leeds"}'

create_and_submit "profile_incomplete_v1" "UTILITY" \
  "Hi {{1}}, your LockSafe profile has {{2}} item(s) left to complete — next up: {{3}}. Finish your setup to start receiving jobs: https://www.locksafe.uk/locksmith/settings — reply here if you need a hand." \
  '{"1":"John","2":"2","3":"Set your call-out fee"}'
