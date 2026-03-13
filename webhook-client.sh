#!/bin/bash
# Webhook Client - sends a webhook message every 60 seconds
# Usage: ./webhook-client.sh [http_url] [https_url]
# Default: sends to both http://localhost:8080 and https://localhost:8443

HTTP_URL="${1:-http://localhost:8080/webhook/test}"
HTTPS_URL="${2:-https://localhost:8443/webhook/test}"
COUNT=0

echo "Webhook Client started"
echo "HTTP target:  $HTTP_URL"
echo "HTTPS target: $HTTPS_URL"
echo "Interval: 60s"
echo "Press Ctrl+C to stop"
echo "---"

while true; do
  COUNT=$((COUNT + 1))
  TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  BODY="{\"seq\":${COUNT},\"timestamp\":\"${TIMESTAMP}\",\"event\":\"heartbeat\",\"source\":\"webhook-client\",\"data\":{\"host\":\"$(hostname)\",\"pid\":$$}}"

  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$HTTP_URL" \
    -H "Content-Type: application/json" \
    -H "X-Webhook-Source: webhook-client" \
    -H "X-Webhook-Seq: ${COUNT}" \
    -d "$BODY" 2>/dev/null) || HTTP_STATUS="ERR"

  HTTPS_STATUS=$(curl -s -k -o /dev/null -w "%{http_code}" -X POST "$HTTPS_URL" \
    -H "Content-Type: application/json" \
    -H "X-Webhook-Source: webhook-client" \
    -H "X-Webhook-Seq: ${COUNT}" \
    -d "$BODY" 2>/dev/null) || HTTPS_STATUS="ERR"

  echo "[${TIMESTAMP}] #${COUNT} -> HTTP:${HTTP_STATUS} HTTPS:${HTTPS_STATUS}"
  sleep 60
done
