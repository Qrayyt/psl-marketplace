#!/bin/bash
# Бэкап БД PostgreSQL
# Запускается через cron на хосте:
# 0 3 * * * /opt/zakaz/psl-marketplace/scripts/backup-db.sh

BACKUP_DIR="/opt/zakaz/psl-marketplace/backups"
CONTAINER="psl-marketplace-postgres-1"
DB_USER="psl_admin"
DB_NAME="psl_marketplace"
RETENTION_DAYS=30

mkdir -p "$BACKUP_DIR"

FILENAME="backup_$(date +%Y%m%d_%H%M%S).sql.gz"

docker exec "$CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_DIR/$FILENAME"

if [ $? -eq 0 ]; then
  echo "[Backup] OK: $FILENAME ($(du -h "$BACKUP_DIR/$FILENAME" | cut -f1))"
else
  echo "[Backup] ОШИБКА при создании бэкапа" >&2
  exit 1
fi

# Удаляем бэкапы старше RETENTION_DAYS дней
find "$BACKUP_DIR" -name "backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete
echo "[Backup] Очистка: удалены бэкапы старше $RETENTION_DAYS дней"
