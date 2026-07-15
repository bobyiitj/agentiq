# ============================================================================
# AgentOS - Production Dockerfile
# Multi-stage build for optimized production image
# ============================================================================

# ----------------------------------------------------------------------------
# Base stage - Shared dependencies
# ----------------------------------------------------------------------------
FROM node:20-alpine AS base

# Install system dependencies
RUN apk add --no-cache \
    dumb-init \
    tini \
    openssl

# Set working directory
WORKDIR /app

# ----------------------------------------------------------------------------
# Dependencies stage - Install production dependencies only
# ----------------------------------------------------------------------------
FROM base AS deps

# Copy package files
COPY package.json package-lock.json* ./

# Install production dependencies only
RUN npm ci --only=production --ignore-scripts && npm cache clean --force

# ----------------------------------------------------------------------------
# Builder stage - Build the application
# ----------------------------------------------------------------------------
FROM base AS builder

# Copy package files
COPY package.json package-lock.json* ./

# Install ALL dependencies (including devDependencies for build)
RUN npm ci --ignore-scripts

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the application
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ----------------------------------------------------------------------------
# Runner stage - Production runtime
# ----------------------------------------------------------------------------
FROM base AS runner

# Create non-root user
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# Set environment variables
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME="0.0.0.0"

# Copy built application from builder
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# Copy production dependencies
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Use tini for proper signal handling
ENTRYPOINT ["tini", "--"]

# Start the application
CMD ["node", "server.js"]