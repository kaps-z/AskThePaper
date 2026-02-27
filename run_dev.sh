#!/bin/bash

# run_dev.sh — Start both Backend and Admin Panel concurrently.

# Function to handle cleanup on script exit
cleanup() {
    echo ""
    echo "Stopping all services..."
    kill $(jobs -p)
    exit
}

trap cleanup SIGINT SIGTERM

echo "🚀 Starting AskThePaper Development Environment..."

# 1. Start Backend
echo "Starting Backend (FastAPI)..."
cd backend
uv run uvicorn app.main:app --reload --port 8000 &
BACKEND_PID=$!
cd ..

# 2. Start Admin Panel
echo "Starting Admin Panel (React)..."
cd admin
npm run dev -- --port 3000 &
ADMIN_PID=$!
cd ..

echo ""
echo "✅ Services are running!"
echo "   - Backend: http://localhost:8000"
echo "   - Admin:   http://localhost:3000"
echo "   - API Docs: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop both."

wait
