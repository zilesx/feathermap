FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY server.mjs ./server.mjs
COPY stripe-billing.mjs ./stripe-billing.mjs
ENV NODE_ENV=production PORT=3001
USER node
EXPOSE 3001
CMD ["node", "server.mjs"]
