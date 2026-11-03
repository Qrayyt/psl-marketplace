# Переменные окружения

Скопируйте `backend/.env.example` -> `backend/.env` и заполните значения.

## Обязательные для продакшена

```
DATABASE_URL=postgresql://user:password@postgres:5432/dbname
REDIS_URL=redis://:password@redis:6379
JWT_ACCESS_SECRET=<случайная строка 32+ символа>
JWT_REFRESH_SECRET=<случайная строка 32+ символа>
```

## Для email-уведомлений

```
SMTP_HOST=smtp.yandex.ru
SMTP_PORT=465
SMTP_USER=noreply@yourdomain.ru
SMTP_PASS=<пароль приложения>
SMTP_FROM="PSL Marketplace <noreply@yourdomain.ru>"
```

## Для интеграции с 1С

```
ODATA_1C_URL=http://1c-server:8080/api
ODATA_1C_USER=admin
ODATA_1C_PASS=password
```

Веб-сервисы на стороне 1С настраиваются 1С-разработчиком заказчика.
