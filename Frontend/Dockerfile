# ============================================
# Frontend Dockerfile - React + Vite + Nginx
# Multi-stage build for optimized production image
# ============================================

# ==================== STAGE 1: Build ====================
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files first (better layer caching)
COPY package*.json ./

# Install ALL dependencies (including devDependencies for build)
RUN npm ci && npm cache clean --force

# Copy source code
COPY . .

# Build arguments for environment variables at build time
# These can be overridden with --build-arg
ARG VITE_BASE_URL=http://localhost:3001
ARG VITE_SERVER_URL=http://localhost:3001

# Set environment variables for Vite build
ENV VITE_BASE_URL=$VITE_BASE_URL
ENV VITE_SERVER_URL=$VITE_SERVER_URL

# Build the production bundle
RUN npm run build

# ==================== STAGE 2: Serve ====================
FROM nginx:alpine AS production

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Create non-root user for security (nginx runs as nginx user by default)
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid

# Expose port 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
