import { redis } from '../config/redis';
import { prisma } from '../config/db';
import { serializeProducts } from '../utils/serializers';

const PRODUCTS_ALL_KEY = 'cache:products:all';
const PRODUCTS_TTL = 300; // 5 минут

// Получить все товары (с кэшем)
export async function getCachedAllProducts(): Promise<unknown[]> {
  const cached = await redis.get(PRODUCTS_ALL_KEY);
  if (cached) {
    return JSON.parse(cached);
  }

  const products = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
  });

  const serialized = serializeProducts(products);
  await redis.set(PRODUCTS_ALL_KEY, JSON.stringify(serialized), 'EX', PRODUCTS_TTL);

  return serialized;
}

// Инвалидация кэша (вызывать при изменении товаров)
export async function invalidateProductsCache(): Promise<void> {
  await redis.del(PRODUCTS_ALL_KEY);
}
