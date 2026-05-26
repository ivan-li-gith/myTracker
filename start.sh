#!/bin/bash
cd "$(dirname "$0")"

echo "Running database migrations..."
cd backend && .venv/bin/alembic upgrade head
if [ $? -ne 0 ]; then
  echo "Migration failed — aborting."
  exit 1
fi

echo "Starting backend..."
.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload --reload-dir app &
BACKEND_PID=$!

echo "Waiting for backend to be ready..."
for i in $(seq 1 30); do
  if curl -s http://localhost:8000/health > /dev/null 2>&1; then
    echo "Backend ready."
    break
  fi
  sleep 1
done

echo "Starting frontend..."
cd ../frontend && npm run dev &
FRONTEND_PID=$!

echo "Backend PID: $BACKEND_PID | Frontend PID: $FRONTEND_PID"
echo "Press Ctrl+C to stop both."

trap "kill $BACKEND_PID $FRONTEND_PID" EXIT
wait
