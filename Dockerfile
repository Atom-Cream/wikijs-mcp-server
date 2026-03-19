# Multi-stage build для оптимизации размера
FROM node:18-alpine AS builder

# Установка зависимостей для сборки
RUN apk add --no-cache git

WORKDIR /app

# Копируем package.json и package-lock.json
COPY package*.json ./

# Устанавливаем зависимости
RUN npm install

# Копируем исходный код
COPY . .

# Собираем TypeScript
RUN npm run build

# Production образ
FROM node:18-alpine

WORKDIR /app

# Копируем только необходимое из builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/scripts ./scripts

# Создаем непривилегированного пользователя
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

# Порт для HTTP сервера
EXPOSE 3200

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3200/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Запуск HTTP сервера
CMD ["node", "dist/server.js"]
