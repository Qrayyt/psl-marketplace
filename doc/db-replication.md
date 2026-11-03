# Настройка PostgreSQL Streaming Replication в Docker

## Обзор

Инструкция по настройке PostgreSQL master-replica репликации
в Docker-окружении проекта PSL Marketplace.

Схема: Master (запись/чтение) -> Replica (только чтение)

Streaming replication -> реплика подключается к мастеру и получает WAL-записи
в реальном времени (асинхронная репликация по умолчанию).

---

## 1. Структура файлов

```
psl-marketplace/
  docker-compose.yml          # основной compose (обновляем)
  docker-compose.repl.yml     # override для репликации
  db/
    master/
      init-replication.sh     # скрипт инициализации мастера
    replica/
      init-replica.sh         # скрипт инициализации реплики
```

---

## 2. Настройка Master

### 2.1 Скрипт инициализации мастера

Создать файл `db/master/init-replication.sh`:

```bash
#!/bin/bash
set -e

# Создаем пользователя для репликации
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE ROLE replicator WITH REPLICATION LOGIN PASSWORD '${REPLICATION_PASSWORD}';
EOSQL

echo "Пользователь replicator создан"
```

### 2.2 Конфигурация PostgreSQL для мастера

Создать файл `db/master/postgresql.conf`:

```ini
# Репликация
wal_level = replica
max_wal_senders = 3
wal_keep_size = 256MB

# Логирование (опционально, полезно для отладки)
log_replication_commands = on
```

### 2.3 Разрешение подключения реплики

Создать файл `db/master/pg_hba_replication.conf`:

```
# TYPE  DATABASE        USER          ADDRESS           METHOD
host    replication     replicator    0.0.0.0/0         md5
```

Эта строка разрешает пользователю `replicator` подключаться
для репликации с любого IP в Docker-сети.

---

## 3. Настройка Replica

### 3.1 Скрипт инициализации реплики

Создать файл `db/replica/init-replica.sh`:

```bash
#!/bin/bash
set -e

# Ждем пока мастер станет доступен
until pg_isready -h db-master -p 5432 -U "$POSTGRES_USER"; do
    echo "Ожидание мастера..."
    sleep 2
done

echo "Мастер доступен. Начинаем pg_basebackup..."

# Останавливаем PostgreSQL на реплике
pg_ctl -D "$PGDATA" -m fast -w stop || true

# Очищаем директорию данных
rm -rf "$PGDATA"/*

# Копируем данные с мастера
pg_basebackup \
    -h db-master \
    -p 5432 \
    -U replicator \
    -D "$PGDATA" \
    -Fp -Xs -P -R

# Флаг -R -> автоматически создает standby.signal и primary_conninfo
# в postgresql.auto.conf

echo "pg_basebackup завершен. Запускаем реплику..."

# Запускаем PostgreSQL
pg_ctl -D "$PGDATA" -w start
```

---

## 4. Docker Compose конфигурация

### 4.1 Файл docker-compose.repl.yml

```yaml
version: "3.8"

services:
  # Master база данных
  db-master:
    image: postgres:16-alpine
    container_name: psl-db-master
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${DB_NAME:-psl_marketplace}
      POSTGRES_USER: ${DB_USER:-postgres}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      REPLICATION_PASSWORD: ${REPLICATION_PASSWORD}
    volumes:
      - db-master-data:/var/lib/postgresql/data
      - ./db/master/init-replication.sh:/docker-entrypoint-initdb.d/init-replication.sh
      - ./db/master/postgresql.conf:/etc/postgresql/postgresql.conf
      - ./db/master/pg_hba_replication.conf:/etc/postgresql/pg_hba_replication.conf
    command: >
      postgres
      -c config_file=/etc/postgresql/postgresql.conf
      -c hba_file=/etc/postgresql/pg_hba_replication.conf
    ports:
      - "5432:5432"
    networks:
      - psl-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER:-postgres}"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Replica база данных (только чтение)
  db-replica:
    image: postgres:16-alpine
    container_name: psl-db-replica
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${DB_NAME:-psl_marketplace}
      POSTGRES_USER: ${DB_USER:-postgres}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      PGUSER: ${DB_USER:-postgres}
    volumes:
      - db-replica-data:/var/lib/postgresql/data
      - ./db/replica/init-replica.sh:/init-replica.sh
    entrypoint: ["/bin/bash", "/init-replica.sh"]
    ports:
      - "5433:5432"
    networks:
      - psl-network
    depends_on:
      db-master:
        condition: service_healthy

volumes:
  db-master-data:
  db-replica-data:

networks:
  psl-network:
    driver: bridge
```

### 4.2 Переменные окружения

Добавить в `.env`:

```bash
# Репликация
REPLICATION_PASSWORD=strong_replication_password_here
```

---

## 5. Подключение приложения

### 5.1 Разделение чтения и записи

В приложении можно использовать две строки подключения:

```bash
# Мастер -> запись и чтение
DATABASE_URL=postgresql://postgres:password@db-master:5432/psl_marketplace

# Реплика -> только чтение
DATABASE_REPLICA_URL=postgresql://postgres:password@db-replica:5432/psl_marketplace
```

### 5.2 Пример в коде (псевдокод)

```javascript
// Подключения к БД
const masterPool = new Pool({ connectionString: process.env.DATABASE_URL });
const replicaPool = new Pool({ connectionString: process.env.DATABASE_REPLICA_URL });

// Запись -> всегда на мастер
async function createProduct(data) {
    return masterPool.query('INSERT INTO products ...', [data]);
}

// Чтение -> на реплику (разгружаем мастер)
async function getProducts() {
    return replicaPool.query('SELECT * FROM products');
}
```

---

## 6. Запуск

### 6.1 Первый запуск

```bash
# Сделать скрипты исполняемыми
chmod +x db/master/init-replication.sh
chmod +x db/replica/init-replica.sh

# Запустить с файлом репликации
docker compose -f docker-compose.yml -f docker-compose.repl.yml up -d
```

### 6.2 Проверка статуса репликации

На мастере:

```bash
docker exec -it psl-db-master psql -U postgres -c "SELECT * FROM pg_stat_replication;"
```

Ожидаемый результат -> строка с `state = streaming`.

На реплике:

```bash
docker exec -it psl-db-replica psql -U postgres -c "SELECT pg_is_in_recovery();"
```

Ожидаемый результат -> `t` (true, реплика в режиме recovery).

### 6.3 Проверка задержки репликации

```bash
# На мастере -> текущая позиция WAL
docker exec -it psl-db-master psql -U postgres -c "SELECT pg_current_wal_lsn();"

# На реплике -> позиция воспроизведения
docker exec -it psl-db-replica psql -U postgres -c "SELECT pg_last_wal_replay_lsn();"
```

Если значения совпадают или близки -> репликация работает без задержки.

---

## 7. Мониторинг

### 7.1 Лаг репликации

```sql
-- На мастере: показывает задержку каждой реплики
SELECT
    client_addr,
    state,
    sent_lsn,
    write_lsn,
    flush_lsn,
    replay_lsn,
    pg_wal_lsn_diff(sent_lsn, replay_lsn) AS replication_lag_bytes
FROM pg_stat_replication;
```

### 7.2 Алерт при большом лаге

Если `replication_lag_bytes` превышает 100MB -> что-то не так:
- Реплика перегружена
- Сеть между контейнерами тормозит
- Мастер генерирует слишком много WAL

---

## 8. Типичные проблемы

### Реплика не подключается к мастеру

1. Проверить что `pg_hba.conf` мастера разрешает подключение replicator
2. Проверить что контейнеры в одной Docker-сети
3. Проверить пароль `REPLICATION_PASSWORD`

```bash
# Тест подключения с реплики
docker exec -it psl-db-replica psql \
    "host=db-master port=5432 user=replicator password=your_password dbname=replication" \
    -c "IDENTIFY_SYSTEM;"
```

### Реплика отстала слишком сильно

Если WAL-файлы на мастере уже удалены, реплика не сможет догнать.
Решение -> пересоздать реплику с нуля:

```bash
docker compose -f docker-compose.yml -f docker-compose.repl.yml stop db-replica
docker volume rm psl-marketplace_db-replica-data
docker compose -f docker-compose.yml -f docker-compose.repl.yml up -d db-replica
```

### Реплика стала read-write (аварийное промоутирование)

Если мастер упал и нужно промоутировать реплику:

```bash
docker exec -it psl-db-replica pg_ctl promote -D /var/lib/postgresql/data
```

После этого реплика станет самостоятельным мастером.
Обратите внимание: после промоута нужно перенастроить репликацию заново.

---

## 9. Синхронная репликация (опционально)

По умолчанию репликация асинхронная -> мастер не ждет подтверждения от реплики.
Для критичных данных можно включить синхронный режим.

Добавить в `db/master/postgresql.conf`:

```ini
synchronous_standby_names = 'psl-db-replica'
synchronous_commit = on
```

Минус: мастер будет ждать подтверждения от реплики при каждом коммите ->
увеличивается latency записи. Используйте только если потеря данных недопустима.
