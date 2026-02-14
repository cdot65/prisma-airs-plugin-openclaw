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
