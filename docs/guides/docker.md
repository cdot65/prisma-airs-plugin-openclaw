# Docker Deployment

Run OpenClaw with the Prisma AIRS plugin in a container.

## Base Image

The provided `docker/Dockerfile` builds a base OpenClaw node image with Python 3.12, Node.js 22, and the `openclaw` CLI pre-installed.

```dockerfile title="docker/Dockerfile"
FROM python:3.12-slim

# Install system dependencies + Node.js 22
RUN apt-get update && apt-get install -y \
    git \
    curl \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install openclaw CLI globally
RUN npm install -g openclaw@latest

# Create non-root user with standard directories
RUN useradd -m -u 1000 node && \
    mkdir -p /home/node/.openclaw /home/node/workspace/skills && \
    chown -R node:node /home/node

# Install uv for node user
USER node
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/home/node/.local/bin:$PATH"

WORKDIR /home/node

# Default command - child images can override
CMD ["openclaw", "node", "run"]
```

## Adding the Plugin

Extend the base image to install the Prisma AIRS plugin:

```dockerfile title="Dockerfile.prisma-airs"
FROM openclaw-base:latest

# Install the plugin
RUN openclaw plugins install @cdot65/prisma-airs

# Copy your gateway config (with api_key, profile_name, etc.)
COPY config.yaml /home/node/.openclaw/config.yaml
```

## Build and Run

```bash
# Build the base image
docker build -t openclaw-base docker/

# Build with plugin
docker build -t openclaw-prisma-airs -f Dockerfile.prisma-airs .

# Run the node
docker run -d \
  --name openclaw-node \
  -v $(pwd)/config.yaml:/home/node/.openclaw/config.yaml \
  openclaw-prisma-airs
```

## Docker Compose

```yaml title="docker-compose.yml"
services:
  openclaw-node:
    build:
      context: .
      dockerfile: docker/Dockerfile
    volumes:
      - ./config.yaml:/home/node/.openclaw/config.yaml
      - openclaw-data:/home/node/.openclaw/data
    restart: unless-stopped

volumes:
  openclaw-data:
```

```bash
# Start
docker compose up -d

# Check logs
docker compose logs -f openclaw-node
```
