# ---- build the frontend ----
FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- runtime (the server uses only Node built-ins: no prod deps) ----
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
ENV DB_PATH=/data/spotlight.db
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/package.json ./package.json
EXPOSE 8080
CMD ["node", "server/index.js"]
