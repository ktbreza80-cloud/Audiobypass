#!/bin/sh

set -e

echo "======================================"
echo "Starting Rezzz Audio"
echo "Starting BGUTIL PO Token Provider"
echo "======================================"

cd /opt/bgutil-ytdlp-pot-provider/server

node build/main.js --host 127.0.0.1 --port 4416 > /tmp/bgutil.log 2>&1 &

POT_PID=$!

echo "BGUTIL PID: $POT_PID"

sleep 3

if kill -0 "$POT_PID" 2>/dev/null; then
    echo "BGUTIL Provider: AKTIF"
else
    echo "BGUTIL Provider: GAGAL"
    cat /tmp/bgutil.log
    exit 1
fi

cd /app

echo "POT_URL=$POT_URL"
echo "Starting Rezzz Audio API..."

exec node server.js
