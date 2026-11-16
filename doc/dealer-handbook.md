# Дилерский справочник PSL

Справочник находится по адресу `/handbook/`. Архив хранится вне каталога фронтенда. API проверяет пользователя при чтении списка и при каждом скачивании. Зарегистрированные дилеры получают доступ по одному аккаунту. Администраторы имеют доступ по роли.

## Установка архива

Перенесите закрытым каналом `PSL_Handbook_Inventory.zip` и семь архивов `PSL_Handbook_Originals_01.zip` — `PSL_Handbook_Originals_07.zip` в один каталог на сервере. Из корня репозитория выполните:

```sh
sudo python3 scripts/import-handbook.py /path/to/archive/PSL_Handbook_Inventory.zip /var/lib/psl/handbook
```

Скрипт сверяет контрольные суммы, объединяет идентичные PDF и устанавливает манифест. При использовании отдельного production Compose добавьте контейнеру app том `/var/lib/psl/handbook:/var/lib/psl/handbook:ro`. Примените миграции в рамках штатного деплоя.

Доступ для существующего аккаунта выдаётся и отзывается по email:

```sh
docker compose exec -T app npx tsx prisma/handbook-access.ts grant 'dealer@example.com'
docker compose exec -T app npx tsx prisma/handbook-access.ts revoke 'dealer@example.com'
```

Для проверки используйте обычный аккаунт, аккаунт с выданным доступом и выход из сессии. Проверьте выдачу списка, скачивание PDF и запрет API без авторизации.
