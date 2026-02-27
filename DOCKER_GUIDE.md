# 🐳 The AskThePaper Docker Guide

Welcome to the world of containerization! This guide will explain how we turned your project into a set of portable, isolated containers.

## 1. What is Docker?
Think of Docker like a **shipping container**. 
- Before containers, you had to worry if the recipient had the same "crane" or "environment" to open your goods. 
- With Docker, you pack your code, its dependencies, and its environment into a single unit that runs the same way everywhere.

## 2. The Building Blocks: Dockerfiles
Each part of your project (Backend & Admin) has a `Dockerfile`. This is a "recipe" for creating an **Image**.

### 🛠️ Backend Dockerfile (`backend/Dockerfile`)
- **Base Image**: We start with `python:3.12-slim`. It's a tiny, efficient version of Linux with Python pre-installed.
- **`uv`**: We use `uv` to install your Python packages lightning-fast.
- **Layers**: Every command (like `COPY` or `RUN`) creates a "layer". Docker caches these, so if you only change your code, it doesn't have to reinstall your packages!
- **`CMD`**: This tells the container what to do when it starts: `uv run python -m uvicorn ...`

### 🎨 Admin Dockerfile (`admin/Dockerfile`)
- **Multi-Stage Build**: This is a pro technique! 
  1. **Build Stage**: We use Node.js to turn your React code into static files (`index.html`, `js`, `css`). 
  2. **Serve Stage**: We throw away the heavy Node.js environment and just copy the small static files into **Nginx**, a super-fast web server. 
- Result: A tiny, secure image that only contains what it needs to run.

## 3. The Orchestrator: Docker Compose
If Docker is the container, **Docker Compose** is the fleet manager.
Our `docker-compose.yml` defines 3 services:
1. **`mongodb`**: Your database.
2. **`backend`**: Your FastAPI logic.
3. **`admin`**: Your React interface.

### 🔗 Networking & Local Services
Inside Docker, containers can talk to each other by name!
- **Container to Container**: The admin panel talks to the backend via its name `backend`.
- **Container to Host (Your Machine)**: Since you have MongoDB running locally on your computer, we use `host.docker.internal:27017`. 
- This tells the container: "Don't look inside yourself for MongoDB, look at the main computer I'm running on."

## 4. How to Use It
The best part? You only need one command now:

```bash
# Build and start everything
docker compose up --build

# Or start in the background
docker compose up --build -d

# See what's happening
docker compose logs -f

# Shut it all down
docker compose down
```

## 5. Local vs. Docker Dependencies
One of the best parts about Docker is that you **don't need to install anything locally** except Docker itself.

- **No more `node_modules`**: The thousands of files for React are now inside the Docker image, not cluttering your project folder.
- **No more `.venv`**: Your Python environment is isolated inside the backend container.
- **Why we removed them**: Since Docker builds its own environment, the local folders were just taking up space and potentially causing confusion (like the `uvicorn` error you saw earlier).

> [!TIP]
> **Pro Tip**: Your IDE (like VS Code) might show red squiggles because it can't "see" the libraries anymore. That's okay! The code will still run perfectly in Docker.

Happy Dockering! 🚀
