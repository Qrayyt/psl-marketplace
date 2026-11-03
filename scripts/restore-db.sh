#!/bin/bash
# Восстановление БД из бэкапа
# Использование: ./restore-db.sh backup_20260406_030000.sql.gz

BACKUP_DIR="/opt/zakaz/psl-marketplace/backups"
CONTAINER="psl-marketplace-postgres-1"
DB_USER="psl_admin"
DB_NAME="psl_marketplace"

if [ -z "$1" ]; then
  echo "Использование: $0 <имя_файла_бэкапа>"
  echo "Доступные бэкапы:"
  ls -lh "$BACKUP_DIR"/backup_*.sql.gz 2>/dev/null || echo "  Нет бэкапов"
  exit 1
fi

BACKUP_FILE="$BACKUP_DIR/$1"
if [ ! -f "$BACKUP_FILE" ]; then
  echo "Файл не найден: $BACKUP_FILE"
  exit 1
fi

echo "ВНИМАНИЕ: текущая БД будет перезаписана!"
read -p "Продолжить? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "Отменено"
  exit 0
fi

echo "[Restore] Восстановление из $1..."

# Пересоздаем БД
docker exec "$CONTAINER" psql -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS ${DB_NAME};"
docker exec "$CONTAINER" psql -U "$DB_USER" -d postgres -c "CREATE DATABASE ${DB_NAME};"

# Восстанавливаем
gunzip -c "$BACKUP_FILE" | docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME"

if [ $? -eq 0 ]; then
  echo "[Restore] OK"
else
  echo "[Restore] ОШИБКА" >&2
  exit 1
fi
