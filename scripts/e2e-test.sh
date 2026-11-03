#!/bin/bash
# E2E тестирование всех API endpoints
BASE="http://localhost:8080"

echo "=== 1. HEALTH ==="
curl -s $BASE/api/health | python3 -c "import sys,json; print(json.load(sys.stdin)['success'])"

echo "=== 2. РЕГИСТРАЦИЯ ==="
REG=$(curl -s -X POST $BASE/api/auth/register -H 'Content-Type: application/json' -d '{"email":"e2etest@test.ru","password":"test123","name":"E2E Tester"}')
echo $REG | python3 -c "import sys,json; d=json.load(sys.stdin); print('OK' if d['success'] else d['error']['message'])"
TOKEN=$(echo $REG | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])" 2>/dev/null)

echo "=== 3. ЛОГИН ==="
LOGIN=$(curl -s -X POST $BASE/api/auth/login -H 'Content-Type: application/json' -d '{"email":"e2etest@test.ru","password":"test123"}')
echo $LOGIN | python3 -c "import sys,json; d=json.load(sys.stdin); print('OK' if d['success'] else d['error']['message'])"
TOKEN=$(echo $LOGIN | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])" 2>/dev/null)

echo "=== 4. ПРОФИЛЬ ==="
curl -s $BASE/api/auth/me -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['name'] if d['success'] else 'FAIL')"

echo "=== 5. КАТАЛОГ ==="
curl -s "$BASE/api/products?limit=3" | python3 -c "import sys,json; d=json.load(sys.stdin); print('OK: %d товаров' % d['meta']['total'])"

echo "=== 6. ВСЕ ТОВАРЫ ==="
curl -s "$BASE/api/products/all" | python3 -c "import sys,json; print('OK: %d товаров' % len(json.load(sys.stdin)))"

echo "=== 7. КАТЕГОРИИ ==="
curl -s $BASE/api/products/categories | python3 -c "import sys,json; print(json.load(sys.stdin)['data'])"

echo "=== 8. КОРЗИНА - ДОБАВИТЬ ==="
PID=$(curl -s "$BASE/api/products?limit=1" | python3 -c "import sys,json; print(json.load(sys.stdin)['data'][0]['id'])")
PSIZE=$(curl -s "$BASE/api/products/$PID" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['sizes'][0])")
curl -s -X POST $BASE/api/cart -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d "{\"productId\":\"$PID\",\"size\":\"$PSIZE\",\"quantity\":2}" | python3 -c "import sys,json; d=json.load(sys.stdin); print('OK' if d['success'] else d['error']['message'])"

echo "=== 9. КОРЗИНА - ПОЛУЧИТЬ ==="
curl -s $BASE/api/cart -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; d=json.load(sys.stdin); print('Товаров: %d, Итого: %s' % (len(d['data']['items']), d['data']['total']))"

echo "=== 10. ПРОМОКОД ==="
curl -s -X POST $BASE/api/cart/apply-promo -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"promoCode":"WELCOME"}' | python3 -c "import sys,json; d=json.load(sys.stdin); print('OK: скидка %s' % d['data']['discount'] if d['success'] else d['error']['message'])"

echo "=== 11. ИЗБРАННОЕ ==="
curl -s -X POST "$BASE/api/favorites/$PID" -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; d=json.load(sys.stdin); print('OK' if d['success'] else 'FAIL')"
curl -s "$BASE/api/favorites" -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; d=json.load(sys.stdin); print('В избранном: %d' % d['meta']['total'])"

echo "=== 12. АДРЕС ==="
ADDR=$(curl -s -X POST $BASE/api/addresses -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"address":"ул. Тестовая 1","city":"Москва","postalCode":"123456"}')
echo $ADDR | python3 -c "import sys,json; d=json.load(sys.stdin); print('OK' if d['success'] else 'FAIL')"
ADDR_ID=$(echo $ADDR | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)

echo "=== 13. ЗАКАЗ ==="
ORDER=$(curl -s -X POST $BASE/api/orders -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d "{\"addressId\":\"$ADDR_ID\",\"deliveryMethod\":\"courier\"}")
echo $ORDER | python3 -c "import sys,json; d=json.load(sys.stdin); print('OK: %s' % d['data']['orderNumber'] if d['success'] else d['error']['message'])"
ORDER_ID=$(echo $ORDER | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null)

echo "=== 14. ИСТОРИЯ ЗАКАЗОВ ==="
curl -s "$BASE/api/orders" -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; d=json.load(sys.stdin); print('Заказов: %d' % d['meta']['total'])"

echo "=== 15. ОТМЕНА ЗАКАЗА ==="
curl -s -X POST "$BASE/api/orders/$ORDER_ID/cancel" -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; d=json.load(sys.stdin); print('Статус: %s' % d['data']['status'] if d['success'] else d['error']['message'])"

echo "=== 16. АДМИН ==="
ADMIN_TOKEN=$(curl -s -X POST $BASE/api/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@psl.ru","password":"admin123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])")
curl -s $BASE/api/admin/stats -H "Authorization: Bearer $ADMIN_TOKEN" | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print('Юзеров: %d, Товаров: %d' % (d['totalUsers'], d['totalProducts']))"
curl -s $BASE/api/admin/orders -H "Authorization: Bearer $ADMIN_TOKEN" | python3 -c "import sys,json; print('Заказов: %d' % json.load(sys.stdin)['meta']['total'])"
curl -s $BASE/api/admin/discounts -H "Authorization: Bearer $ADMIN_TOKEN" | python3 -c "import sys,json; print('Скидок: %d' % json.load(sys.stdin)['meta']['total'])"
curl -s $BASE/api/admin/audit-log -H "Authorization: Bearer $ADMIN_TOKEN" | python3 -c "import sys,json; print('Аудит: %d записей' % json.load(sys.stdin)['meta']['total'])"

echo "=== 17. ФРОНТ ==="
curl -s -o /dev/null -w "index: %{http_code}\n" $BASE/
curl -s -o /dev/null -w "product: %{http_code}\n" $BASE/product.html
curl -s -o /dev/null -w "profile: %{http_code}\n" $BASE/profile.html
curl -s -o /dev/null -w "ai-chat: %{http_code}\n" $BASE/ai-chat.html
curl -s -o /dev/null -w "admin: %{http_code}\n" $BASE/admin/
curl -s -o /dev/null -w "privacy: %{http_code}\n" $BASE/privacy.html

echo "=== 18. ПРОИЗВОДИТЕЛЬНОСТЬ ==="
curl -s -o /dev/null -w "products/all: %{time_total}s\n" $BASE/api/products/all
curl -s -o /dev/null -w "products/all (кэш): %{time_total}s\n" $BASE/api/products/all
curl -s -o /dev/null -w "health: %{time_total}s\n" $BASE/api/health

echo ""
echo "=== ВСЕ ТЕСТЫ ЗАВЕРШЕНЫ ==="
