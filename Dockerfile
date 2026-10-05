# Use Node.js LTS (20) Alpine as base image for a small footprint
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the application code
COPY . .

# Build the Vite frontend
RUN npm run build

# --- Production Image ---
FROM node:20-alpine

WORKDIR /app

# Copy package files and install all dependencies (we need tsx and others)
COPY package.json package-lock.json ./
RUN npm ci

# Copy built frontend from the builder stage
COPY --from=builder /app/dist ./dist

# Copy backend files and source files needed for server.ts
COPY server.ts ./
COPY src ./src
COPY tsconfig.json ./

# Expose the port Cloud Run uses
EXPOSE 8080

# Environment variables
ENV PORT=8080
ENV NODE_ENV=production

# Start the server using the existing script
CMD ["npm", "run", "start"]
