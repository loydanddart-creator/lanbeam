#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
command -v node >/dev/null 2>&1 || { echo "Установите Node.js с https://nodejs.org"; exit 1; }
command -v pnpm >/dev/null 2>&1 || npm install -g pnpm
[ -d node_modules ] || pnpm install
IP=$(hostname -I 2>/dev/null | awk '{print $1}')
[ -n "$IP" ] || IP="IP-компьютера"
echo "LanBeam запущен: http://localhost:3000"
echo "Для телефона в той же Wi-Fi сети: http://$IP:3000"
( sleep 2; xdg-open http://localhost:3000 2>/dev/null || open http://localhost:3000 2>/dev/null || true ) &
pnpm dev
