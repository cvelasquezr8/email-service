# ---------- BUILD STAGE ----------
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependencies files first for better caching
COPY package.json yarn.lock ./

RUN yarn install --immutable

# Copy the rest of the application code
COPY . .

#  Build the application
RUN yarn build


# ---------- RUNTIME STAGE ----------
FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production

# Copy only the necessary files for production
COPY package.json yarn.lock ./

RUN yarn install --production --immutable

# Copy the built application from the builder stage
COPY --from=builder /app/dist ./dist

# Expose the port the application runs on
EXPOSE 80

CMD ["node", "dist/main.js"]
