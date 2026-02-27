#!/bin/bash

# run_dev.sh — Start the entire AskThePaper project using Docker Compose.

# Function to handle cleanup on script exit
cleanup() {
    echo ""
    echo "🐳 Stopping Docker containers..."
    docker compose down
    exit
}

trap cleanup SIGINT SIGTERM

echo "🚀 Starting AskThePaper Development Environment (Dockerized)..."

# Build and start all services (Backend, Admin, MongoDB)
# We use --build to ensure any code changes are picked up.
docker compose up --build

# The script will wait here until Ctrl+C is pressed, then 'cleanup' will run.
