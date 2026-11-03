# API документация PSL Marketplace

Swagger UI: http://{host}/api/docs

## Аутентификация

Все защищенные эндпоинты требуют заголовок:
```
Authorization: Bearer {access_token}
```

### POST /api/auth/register
Регистрация. Тело: `{ email, password, name, phone? }`

### POST /api/auth/login
Вход. Тело: `{ email, password }`. Ответ: `{ user, accessToken, refreshToken }`

### POST /api/auth/refresh
Обновление токена. Тело: `{ refreshToken }`

### POST /api/auth/logout
Выход. Тело: `{ refreshToken }`

### POST /api/auth/forgot-password
Запрос сброса пароля. Тело: `{ email }`

### GET /api/auth/me
Получить профиль (авторизация)

### PATCH /api/auth/me
Обновить профиль. Тело: `{ name?, phone? }`

## Каталог

### GET /api/products
Список с пагинацией. Параметры: page, limit, category, tags, price_min, price_max, search, sort

### GET /api/products/all
Все товары (формат data.js для фронтенда)

### GET /api/products/categories
Список категорий

### GET /api/products/:id
Карточка товара

## Корзина (авторизация)

### GET /api/cart
Получить корзину с расчетом скидок

### POST /api/cart
Добавить товар. Тело: `{ productId, size, quantity }`

### POST /api/cart/sync
Синхронизация с localStorage. Тело: `{ items: [{ productId, size, quantity }] }`

### POST /api/cart/apply-promo
Применить промокод. Тело: `{ promoCode }`

### PATCH /api/cart/:id
Изменить количество. Тело: `{ quantity }`

### DELETE /api/cart/:id
Удалить товар

### DELETE /api/cart
Очистить корзину

## Избранное (авторизация)

### GET /api/favorites
Список избранного

### POST /api/favorites/:productId
Добавить в избранное

### DELETE /api/favorites/:productId
Убрать из избранного

### POST /api/favorites/:productId/to-cart
Перенести в корзину

### POST /api/favorites/sync
Синхронизация. Тело: `{ productIds: [] }`

## Адреса (авторизация)

### GET /api/addresses
### POST /api/addresses
### PATCH /api/addresses/:id
### DELETE /api/addresses/:id
### PATCH /api/addresses/:id/default

## Заказы (авторизация)

### POST /api/orders
Оформить заказ. Тело: `{ addressId?, address?, deliveryMethod? }`

### GET /api/orders
История заказов

### GET /api/orders/:id
Детали заказа

### POST /api/orders/:id/cancel
Отмена заказа (только статус NEW)

## Админ API (авторизация + роль ADMIN)

### GET /api/admin/stats
Дашборд (заказы, выручка, топ товаров)

### Товары
- GET /api/admin/products
- POST /api/admin/products
- PATCH /api/admin/products/:id
- DELETE /api/admin/products/:id
- POST /api/admin/products/import
- POST /api/admin/products/:id/image (multipart/form-data, поле image)

### Пользователи
- GET /api/admin/users
- GET /api/admin/users/:id
- PATCH /api/admin/users/:id
- POST /api/admin/users/:id/block
- POST /api/admin/users/:id/unblock

### Заказы
- GET /api/admin/orders
- GET /api/admin/orders/:id
- PATCH /api/admin/orders/:id/status

### Скидки
- GET /api/admin/discounts
- POST /api/admin/discounts
- PATCH /api/admin/discounts/:id
- DELETE /api/admin/discounts/:id

### Обмен 1С
- POST /api/admin/exchange/sync
- GET /api/admin/exchange/log
- POST /api/admin/exchange/products

### Аудит-лог
- GET /api/admin/audit-log
