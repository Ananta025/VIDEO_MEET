# ============================================
# Frontend Dockerfile - React + Vite + Nginx
# Multi-stage build (PRODUCTION READY)
# ============================================

# ==================== STAGE 1: Build ====================
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (better cache)
COPY package*.json ./
RUN npm ci && npm cache clean --force

# Copy source code
COPY . .

# ---------- Build-time arguments (Vite) ----------
ARG VITE_BASE_URL
ARG VITE_SERVER_URL

# Expose them to Vite build
ENV VITE_BASE_URL=$VITE_BASE_URL
ENV VITE_SERVER_URL=$VITE_SERVER_URL

# Build production bundle
RUN npm run build

# ==================== STAGE 2: Serve ====================
FROM nginx:alpine AS production

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Custom nginx config (SPA routing)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Permissions (security best practice)
RUN chown -R nginx:nginx /usr/share/nginx/html \
    /var/cache/nginx \
    /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid

EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
