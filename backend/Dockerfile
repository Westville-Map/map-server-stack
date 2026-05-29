# --- Build / Dependency Stage ---
FROM node:24-alpine AS builder
WORKDIR /app

# Copy package files first to leverage Docker layer caching
COPY app/package*.json ./
RUN npm ci --only=production

# --- Production Stage ---
FROM node:24-alpine
WORKDIR /app

# Copy production dependencies from builder stage
COPY --from=builder /app/node_modules ./node_modules

# Copy app source code from host app/ directory
COPY app/ .

# Create the data directory and set permissions for the non-root 'node' user
RUN mkdir -p /app/data && chown -R node:node /app

# Run as non-root user
USER node

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "server.js"]
