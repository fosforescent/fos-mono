# Basic node vite typescript react frontend Dockerfile

FROM node:20-slim as build
WORKDIR /usr/src/app
# Add debugging steps
RUN which node
RUN node --version
RUN echo $PATH
# Copy frontend package files
COPY package*.json ./
COPY package-lock.json ./
# Install dependencies
RUN npm install
# Copy shared code
COPY shared/ ./shared/
# Copy frontend source code
COPY / ./
# Install build dependencies
RUN apt-get update && apt-get install -y \
    openssl \
    libssl-dev \
    make \
    && rm -rf /var/lib/apt/lists/*
# Build frontend with Vite
RUN npm run build
# Second stage: Setup runtime environment
FROM node:20-slim as runtime
WORKDIR /usr/src/app
ENV PORT=80 \
    NODE_ENV=production


# Install openssl and libssl
RUN apt-get update && apt-get install -y openssl libssl-dev && rm -rf /var/lib/apt/lists/*
# Copy built frontend files from build stage
COPY --from=build /usr/src/app/dist ./dist
# Copy shared code
COPY --from=build /usr/src/app/shared ./shared
# Copy package files for runtime
COPY package*.json ./
# Install only production dependencies
RUN npm install --only=production
# Expose the port
EXPOSE 80
# Start the application
CMD ["npm", "run", "start"]
# Healthcheck to ensure the server is running
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:80/ || exit 1
