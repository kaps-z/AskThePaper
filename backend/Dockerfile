# Use a modern, slim Python image
FROM python:3.12-slim

# Install uv for fast dependency management
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Set working directory
WORKDIR /app

# Copy dependency files first for better caching
COPY pyproject.toml uv.lock ./

# Install dependencies (without the app itself)
RUN uv sync --frozen --no-install-project

# Copy the application code
COPY . .

# Final project sync
RUN uv sync --frozen

# Expose the API port
EXPOSE 8000

# Start the application
# We use -m uvicorn for reliability and --host 0.0.0.0 for container access
CMD ["uv", "run", "python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
