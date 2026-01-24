# ============================================
# Backend Dockerfile - Node.js + Express + Socket.io
# Production-grade, Kubernetes-ready
# ============================================

# Use Node.js LTS Alpine for smaller image size
FROM node:20-alpine AS base

# Install dependencies needed for bcrypt native compilation
RUN apk add --no-cache python3 make g++ ffmpeg

# Set working directory
WORKDIR /app

# Copy package files first (better layer caching)
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# Create uploads directories
RUN mkdir -p uploads/recordings uploads/transcripts temp

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose the port (default 3001, configurable via PORT env)
EXPOSE 3001

# Health check for Kubernetes readiness/liveness probes
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 3001) + '/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))" || exit 1

# Start the server
CMD ["node", "server.js"]
