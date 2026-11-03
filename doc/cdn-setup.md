# Настройка Cloudflare CDN для PSL Marketplace

## Обзор

Инструкция по подключению Cloudflare CDN к проекту PSL Marketplace.
Cloudflare выступает как reverse proxy -> кэширует статику, защищает от DDoS,
предоставляет SSL-сертификат.

---

## 1. Регистрация и добавление домена

1. Зарегистрироваться на [cloudflare.com](https://www.cloudflare.com/)
2. Нажать "Add a Site" -> ввести домен проекта (например `psl-marketplace.com`)
3. Выбрать тарифный план (Free подходит для старта)
4. Cloudflare просканирует существующие DNS-записи

---

## 2. Настройка DNS

### Смена NS-серверов

У регистратора домена заменить текущие NS-серверы на выданные Cloudflare:

```
ns1.cloudflare.com  (пример, реальные будут в панели)
ns2.cloudflare.com
```

Ожидание пропагации -> до 24 часов, обычно 1-2 часа.

### DNS-записи

Добавить записи в панели Cloudflare (DNS -> Records):

| Тип   | Имя              | Содержимое         | Прокси    | TTL  |
|-------|-------------------|--------------------|-----------|------|
| A     | @                 | IP_СЕРВЕРА         | Proxied   | Auto |
| A     | www               | IP_СЕРВЕРА         | Proxied   | Auto |
| CNAME | api (если отдельный) | api.example.com | Proxied   | Auto |

Важно: значок "облачко" (Proxied) должен быть оранжевым -> трафик идет через Cloudflare.
Если серый (DNS only) -> CDN и защита не работают.

---

## 3. Настройка SSL/TLS

### Режим SSL

Перейти: SSL/TLS -> Overview -> выбрать режим:

- **Full (Strict)** -> рекомендуемый режим
  - Cloudflare шифрует трафик между клиентом и своим сервером
  - Cloudflare шифрует трафик между собой и origin-сервером
  - Требуется валидный SSL-сертификат на origin-сервере

Если на сервере нет валидного сертификата, можно использовать:
- **Full** -> принимает самоподписанный сертификат на origin
- **Flexible** -> НЕ РЕКОМЕНДУЕТСЯ, трафик между Cloudflare и origin -> не зашифрован

### Origin Certificate (рекомендуется для Full Strict)

1. SSL/TLS -> Origin Server -> Create Certificate
2. Скачать сертификат и ключ
3. Установить на origin-сервер (Nginx):

```nginx
server {
    listen 443 ssl;
    server_name psl-marketplace.com;

    ssl_certificate     /etc/ssl/cloudflare-origin.pem;
    ssl_certificate_key /etc/ssl/cloudflare-origin-key.pem;

    # ... остальная конфигурация
}
```

### Always Use HTTPS

SSL/TLS -> Edge Certificates -> включить "Always Use HTTPS" -> все HTTP-запросы
перенаправляются на HTTPS.

---

## 4. Настройка кэширования

### Общие настройки кэша

Перейти: Caching -> Configuration

- **Caching Level** -> Standard
- **Browser Cache TTL** -> Respect Existing Headers (Nginx уже задает expires)
- **Always Online** -> включить (показывает кэш если origin недоступен)

### Что кэшируется по умолчанию

Cloudflare автоматически кэширует статические файлы по расширению:
`css, js, png, jpg, jpeg, gif, svg, ico, woff, woff2, ttf, eot`

Это совпадает с нашей Nginx-конфигурацией для статики.

### Cache Rules (обход кэша для API)

Перейти: Rules -> Cache Rules -> Create Rule

**Правило 1: Обход кэша для /api/***

```
Имя: Bypass cache for API
Условие: URI Path starts with "/api/"
Действие: Bypass cache (Eligible for cache -> Bypass cache)
```

Это критически важно: API-ответы не должны кэшироваться,
иначе пользователи будут получать чужие данные.

**Правило 2: Обход кэша для /uploads/ (если контент динамический)**

```
Имя: Bypass cache for uploads
Условие: URI Path starts with "/uploads/"
Действие: Bypass cache
```

Если загруженные файлы редко меняются, это правило можно не добавлять ->
Cloudflare будет кэшировать их (быстрее отдача).

---

## 5. Page Rules (альтернатива Cache Rules для Free плана)

Если Cache Rules недоступны, используем Page Rules (3 шт. на Free плане):

### Правило 1: API -> обход кэша

```
URL: psl-marketplace.com/api/*
Настройки:
  Cache Level -> Bypass
  Disable Performance (опционально)
```

### Правило 2: Статика -> агрессивное кэширование

```
URL: psl-marketplace.com/*.js
Настройки:
  Cache Level -> Cache Everything
  Edge Cache TTL -> 7 days
  Browser Cache TTL -> 7 days
```

### Правило 3: Корень -> стандартное кэширование

```
URL: psl-marketplace.com/*
Настройки:
  Cache Level -> Standard
  Always Use HTTPS -> On
```

Порядок важен: правила применяются сверху вниз, первое совпадение побеждает.

---

## 6. Безопасность (дополнительно)

### Firewall Rules

Rules -> WAF -> Create Rule:

- Блокировка стран, откуда не ожидается трафик
- Rate limiting для /api/auth/* (дополнительно к Nginx rate limit)

### Bot Fight Mode

Security -> Bots -> включить "Bot Fight Mode" -> блокирует известных вредоносных ботов.

### Under Attack Mode

Security -> Settings -> "I'm Under Attack Mode" -> включать ТОЛЬКО при DDoS-атаке.
Показывает JS-challenge всем посетителям (5 секунд ожидания).

---

## 7. Проверка работы

### DNS пропагация

```bash
# Проверить что DNS указывает на Cloudflare
dig +short psl-marketplace.com
nslookup psl-marketplace.com
```

IP должен принадлежать Cloudflare (не вашему серверу напрямую).

### Заголовки ответа

```bash
# Проверить что Cloudflare проксирует трафик
curl -I https://psl-marketplace.com

# Ожидаемые заголовки:
# cf-cache-status: HIT (или MISS при первом запросе)
# cf-ray: <id>
# server: cloudflare
```

### Кэш статики

```bash
# Запросить статический файл дважды
curl -I https://psl-marketplace.com/assets/main.js

# Первый запрос: cf-cache-status: MISS
# Второй запрос: cf-cache-status: HIT
```

### API не кэшируется

```bash
curl -I https://psl-marketplace.com/api/products

# cf-cache-status: BYPASS (или DYNAMIC)
# Не должно быть HIT
```

---

## 8. Настройки в Nginx для работы с Cloudflare

Cloudflare передает реальный IP клиента в заголовке `CF-Connecting-IP`.
Чтобы Nginx видел настоящий IP (а не IP Cloudflare):

```nginx
# Добавить в секцию http {} или server {}
# Актуальные диапазоны IP Cloudflare -> https://www.cloudflare.com/ips/

set_real_ip_from 173.245.48.0/20;
set_real_ip_from 103.21.244.0/22;
set_real_ip_from 103.22.200.0/22;
set_real_ip_from 103.31.4.0/22;
set_real_ip_from 141.101.64.0/18;
set_real_ip_from 108.162.192.0/18;
set_real_ip_from 190.93.240.0/20;
set_real_ip_from 188.114.96.0/20;
set_real_ip_from 197.234.240.0/22;
set_real_ip_from 198.41.128.0/17;
set_real_ip_from 162.158.0.0/15;
set_real_ip_from 104.16.0.0/13;
set_real_ip_from 104.24.0.0/14;
set_real_ip_from 172.64.0.0/13;
set_real_ip_from 131.0.72.0/22;

real_ip_header CF-Connecting-IP;
```
