# Stage 1: Build
FROM node:20-slim AS build

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm install

# Copy application code
COPY . .

# Build the app (produces /app/dist)
RUN npm run build

# Stage 2: Serve
FROM nginx:alpine

# Copy built assets from Stage 1
COPY --from=build /app/dist /usr/share/nginx/html

# Copy custom nginx config to handle SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port (Nginx default)
EXPOSE 80

# Nginx starts automatically
CMD ["nginx", "-g", "daemon off;"]
