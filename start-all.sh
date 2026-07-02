#!/usr/bin/env bash
# AgentNet — barcha servislarni ishga tushirish (Git Bash uchun)
# Ishlatish:  bash start-all.sh
set -e
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> 1/3 FastAPI agent-engine (port 8000)..."
cd "$ROOT/apps/agent-engine"
PYTHONUTF8=1 PYTHONIOENCODING=utf-8 .venv/Scripts/python.exe -m uvicorn main:app --port 8000 --host 127.0.0.1 --reload &
ENGINE_PID=$!

echo "==> 2/3 NestJS API (port 3001)..."
cd "$ROOT/apps/api"
npm run dev &
API_PID=$!

echo "==> 3/3 Next.js web (port 3000)..."
cd "$ROOT/apps/web"
npm run dev &
WEB_PID=$!

echo ""
echo "================================================"
echo "  Web UI:    http://localhost:3000"
echo "  NestJS:    http://localhost:3001/api/docs"
echo "  FastAPI:   http://localhost:8000/docs"
echo "================================================"
echo "To'xtatish uchun: Ctrl+C"
trap "kill $ENGINE_PID $API_PID $WEB_PID 2>/dev/null" EXIT
wait
