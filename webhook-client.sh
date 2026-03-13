#!/bin/bash
# Webhook Client - sends a webhook message every 60 seconds
# Usage: ./webhook-client.sh [url]
# Default URL: http://localhost:8080/webhook/test
# For HTTPS: ./webhook-client.sh https://localhost:8443/webhook/test

URL="${1:-http://localhost:8080/webhook/test}"
COUNT=0

# Use -k for HTTPS with self-signed certificate
CURL_OPTS=""
if [[ "$URL" == https://* ]]; then
  CURL_OPTS="-k"
fi

echo "Webhook Client started"
echo "Target: $URL"
echo "Interval: 60s"
echo "Press Ctrl+C to stop"
echo "---"

while true; do
  COUNT=$((COUNT + 1))
  TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  BODY=$(cat <<EOF
{"seq":${COUNT},"timestamp":"${TIMESTAMP}","event":"heartbeat","source":"webhook-client","data":{"host":"$(hostname)","pid":$$}}
EOF
)
  STATUS=$(curl -s $CURL_OPTS -o /dev/null -w "%{http_code}" -X POST "$URL" \
    -H "Content-Type: application/json" \
    -H "X-Webhook-Source: webhook-client" \
    -H "X-Webhook-Seq: ${COUNT}" \
    -d "$BODY")

  echo "[${TIMESTAMP}] #${COUNT} -> ${STATUS}"
  sleep 60
done
