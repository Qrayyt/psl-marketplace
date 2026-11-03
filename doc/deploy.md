# Инструкция по развертыванию

## Требования
- Docker + Docker Compose
- Git

## Первый запуск

```bash
git clone https://github.com/Xendor1987/psl-marketplace.git
cd psl-marketplace
docker compose up -d
docker compose exec app npx prisma migrate deploy
docker compose exec app npx tsx prisma/seed.ts
```

## Обновление

```bash
cd /opt/zakaz/psl-marketplace
git pull
docker compose build app
docker compose up -d --force-recreate app nginx
```

Важно: для postgres и redis использовать `--no-recreate` чтобы не потерять данные.

## Переменные окружения

Файл: `backend/.env`

| Переменная | Описание |
|---|---|
| PORT | Порт backend (3000) |
| DATABASE_URL | Строка подключения PostgreSQL |
| REDIS_URL | Строка подключения Redis |
| JWT_ACCESS_SECRET | Секрет access-токена (мин 32 символа) |
| JWT_REFRESH_SECRET | Секрет refresh-токена (мин 32 символа) |
| CORS_ORIGIN | Разрешенные домены (* для всех) |
| SMTP_HOST | SMTP сервер для email |
| SMTP_PORT | Порт SMTP (587) |
| SMTP_USER | Логин SMTP |
| SMTP_PASS | Пароль SMTP |
| SMTP_FROM | Отправитель |
| ODATA_1C_URL | URL API 1С |
| ODATA_1C_USER | Логин 1С |
| ODATA_1C_PASS | Пароль 1С |

## Порты (прод 195.133.66.31)

| Сервис | Порт |
|---|---|
| Nginx (фронт + API proxy) | 8080 |
| Backend API (прямой) | 3030 |
| PostgreSQL | 5440 |
| Redis | 6383 |

## Бэкапы

Бэкап БД выполняется скриптом `scripts/backup-db.sh`.

Настройка cron:
```bash
chmod +x /opt/zakaz/psl-marketplace/scripts/backup-db.sh
crontab -e
# Добавить строку:
0 3 * * * /opt/zakaz/psl-marketplace/scripts/backup-db.sh >> /var/log/psl-backup.log 2>&1
```

Восстановление:
```bash
./scripts/restore-db.sh backup_20260406_030000.sql.gz
```

## SSL (Let's Encrypt)

При привязке домена:
```bash
apt install certbot python3-certbot-nginx
certbot --nginx -d yourdomain.ru
```

Автопродление настроено автоматически через systemd timer.
