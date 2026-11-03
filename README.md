# PSL Marketplace (Galenite)

Интернет-магазин одежды бренда Galenite.

## Запуск

```bash
docker compose up -d
```

Сервисы:
- **Сайт:** http://localhost:8080
- **Админ-панель:** http://localhost:8080/admin/
- **API:** http://localhost:8080/api/
- **Swagger:** http://localhost:8080/api/docs

## Первый запуск

```bash
# Миграции
docker compose exec app npx prisma migrate deploy

# Сидер (98 товаров + админ + тестовый юзер)
docker compose exec app npx tsx prisma/seed.ts
```

## Учетные записи (сидер)

- Админ: admin@psl.ru / admin123
- Тестовый юзер: user@test.ru / user123

## Стек

- Backend: Node.js + Express + TypeScript + Prisma ORM
- Frontend: HTML + CSS + Vanilla JS
- БД: PostgreSQL 16 + Redis 7
- Инфраструктура: Docker, Nginx

## Структура

```
backend/     - API сервер (Express + TypeScript)
frontend/    - Фронтенд (HTML/CSS/JS)
nginx/       - Конфигурация Nginx
```
