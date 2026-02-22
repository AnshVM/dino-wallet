FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json prisma.config.ts ./
COPY prisma/ ./prisma/
COPY src/ ./src/

RUN npx prisma generate --sql
RUN npm run build

EXPOSE 3001

ENTRYPOINT ["sh", "/app/docker-entrypoint.sh"]
