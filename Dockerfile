# Use a smaller, more specific Node.js base image
FROM node:20-slim as build

WORKDIR /usr/src/app

# Copy package.json and package-lock.json (or yarn.lock) to leverage Docker cache
COPY ./package*.json ./

COPY ./prisma ./prisma/

# Install ALL dependencies, including 'devDependencies'
RUN npm install --omit=dev

# Copy the rest of your app's source code from your host to your image filesystem.
COPY ./ .

# Install openssl and libssl
RUN apt-get update && apt-get install -y openssl libssl-dev make && rm -rf /var/lib/apt/lists/*


# Generate prisma client and compile TypeScript to JavaScript
RUN make setup && make build-backend

# Second stage: Setup runtime environment
FROM node:20-slim as runtime

WORKDIR /usr/src/app

# Install openssl and libssl
RUN apt-get update && apt-get install -y openssl libssl-dev && rm -rf /var/lib/apt/lists/*
# RUN apt-get install -y build-essential libpq-dev


# Only copy the build artifacts and necessary files from the previous stage
COPY --from=build /usr/src/app/bin ./bin
COPY --from=build /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/package*.json ./

ENV PORT=80

EXPOSE 80
CMD [ "node", "bin/index.js" ]
