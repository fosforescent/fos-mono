# Build stage
FROM node:20-slim as build

WORKDIR /usr/src/app

# Add debugging steps
RUN which node
RUN node --version
RUN echo $PATH

# Copy entire workspace for dependency resolution
COPY package*.json ./
COPY infra/ ./infra/
COPY shared/ ./shared/
COPY backend/ ./backend/
COPY frontend/package*.json ./frontend/

# Install dependencies from workspace root
RUN npm install --legacy-peer-deps --workspaces

# Generate Prisma client
RUN cd infra && npx prisma generate

# Install build dependencies
RUN apt-get update && apt-get install -y \
    openssl \
    libssl-dev \
    make \
    && rm -rf /var/lib/apt/lists/*

# Set environment for development mode
ENV NODE_ENV=development \
    PORT=80

WORKDIR /usr/src/app

EXPOSE 80
CMD ["npx", "tsx", "./backend/index.ts"]
