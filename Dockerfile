# Build stage
FROM node:20-slim as build

WORKDIR /usr/src/app

# Add debugging steps
RUN which node
RUN node --version
RUN echo $PATH

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Copy the rest of your app's source code
COPY . .

# Install build dependencies
RUN apt-get update && apt-get install -y \
    openssl \
    libssl-dev \
    make \
    && rm -rf /var/lib/apt/lists/*

# More debugging
RUN ls -la /usr/src/app/node_modules/.bin
RUN ls -la /usr/src/app/node_modules/vite/bin
RUN which npx

# Try building without make first
RUN node ./node_modules/vite/bin/vite.js build --mode backend

# If that works, then try make
# RUN make setup && make build-backend



# Second stage: Setup runtime environment
FROM node:20-slim as runtime

WORKDIR /usr/src/app


ENV PORT=80 \
    NODE_ENV=production \
    DATABASE_URL="" \
    STRIPE_TOKEN="" \
    JWT_SECRET="" \
    PINECONE_API_KEY="" \
    OPENAI_API_KEY="" \
    EMAIL_WEBHOOK_PASSWORD="" \
    POSTMARK_API_TOKEN="" \
    STRIPE_TOPUP_PRICE_ID="" \
    STRIPE_SUBSCRIPTION_PRICE_ID=""

# Install openssl and libssl
RUN apt-get update && apt-get install -y openssl libssl-dev && rm -rf /var/lib/apt/lists/*
# RUN apt-get install -y build-essential libpq-dev


# Only copy the build artifacts and necessary files from the previous stage
COPY --from=build /usr/src/app/dist ./dist
COPY --from=build /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/package*.json ./
COPY --from=build /usr/src/app/prisma ./prisma

ENV PORT=80

EXPOSE 80
CMD [ "node", "/usr/src/app/dist/backend/index.js" ]
