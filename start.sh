#!/bin/bash
cd "$(dirname "$0")"

echo "Starting backend..."
cd backend && .venv/bin/uvicorn app.main:app --reload &
BACKEND_PID=$!

echo "Starting frontend..."
cd frontend && npm run dev &
FRONTEND_PID=$!

echo "Backend PID: $BACKEND_PID | Frontend PID: $FRONTEND_PID"
echo "Press Ctrl+C to stop both."

trap "kill $BACKEND_PID $FRONTEND_PID" EXIT
wait
