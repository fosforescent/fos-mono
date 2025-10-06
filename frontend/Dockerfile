# Frontend Dockerfile - standalone package build
FROM node:20-slim as build

WORKDIR /usr/src/app

# Copy workspace dependencies first
COPY package*.json ./
COPY shared/ ./shared/
COPY frontend/ ./frontend/

# Install workspace dependencies
RUN npm install

# Build argument for API URL (passed from docker-compose)
ARG VITE_FOS_API_URL=http://localhost:4000
ARG VITE_BASE_URL=http://localhost:5173

# Build the frontend directly
WORKDIR /usr/src/app/frontend
RUN npm run build

# Production stage with nginx
FROM nginx:alpine

# Copy built assets
COPY --from=build /usr/src/app/frontend/dist /usr/share/nginx/html

# Copy nginx config file
COPY <<EOF /etc/nginx/conf.d/default.conf
server {
    listen 80;
    server_name localhost;
    
    location / {
        root /usr/share/nginx/html;
        index index.html;
        try_files \$uri \$uri/ /index.html;
    }
}
EOF

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]