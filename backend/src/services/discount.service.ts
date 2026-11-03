import { prisma } from '../config/db';
import { DiscountType } from '@prisma/client';

interface DiscountResult {
  originalPrice: number;
  discountedPrice: number;
  totalDiscount: number;
  appliedRules: { id: string; name: string; type: DiscountType; value: number }[];
}

interface CartItemForDiscount {
  productId: string;
  price: number;
  quantity: number;
  tags: string[];
}

// Получить все активные правила скидок
async function getActiveRules() {
  const now = new Date();
  return prisma.discountRule.findMany({
    where: {
      isActive: true,
      OR: [
        { validFrom: null, validUntil: null },
        { validFrom: { lte: now }, validUntil: null },
        { validFrom: null, validUntil: { gte: now } },
        { validFrom: { lte: now }, validUntil: { gte: now } },
      ],
    },
    orderBy: { priority: 'desc' },
  });
}

// Рассчитать скидку для одного товара
export async function calculateProductDiscount(
  productPrice: number,
  productTags: string[],
  userId?: string,
): Promise<DiscountResult> {
  const rules = await getActiveRules();
  const result: DiscountResult = {
    originalPrice: productPrice,
    discountedPrice: productPrice,
    totalDiscount: 0,
    appliedRules: [],
  };

  // Фильтруем правила без промокода (автоматические скидки)
  const autoRules = rules.filter(r => !r.promoCode);

  // Находим подходящие правила
  const matchingRules = autoRules.filter(rule => {
    // Проверка по тегам
    if (rule.targetTags.length > 0) {
      const hasMatchingTag = rule.targetTags.some(tag => productTags.includes(tag));
      if (!hasMatchingTag) return false;
    }

    // Проверка по пользователю
    if (rule.targetUserIds.length > 0 && userId) {
      if (!rule.targetUserIds.includes(userId)) return false;
    } else if (rule.targetUserIds.length > 0 && !userId) {
      return false;
    }

    return true;
  });

  if (matchingRules.length === 0) return result;

  // Логика приоритетов: stackable суммируются, non-stackable берется лучшая
  const stackable = matchingRules.filter(r => r.isStackable);
  const nonStackable = matchingRules.filter(r => !r.isStackable);

  let discount = 0;

  // Лучшая non-stackable скидка (наивысший приоритет)
  if (nonStackable.length > 0) {
    const best = nonStackable[0]; // уже отсортированы по priority desc
    const d = calcDiscount(productPrice, best.type, best.value);
    if (d > discount) {
      discount = d;
      result.appliedRules = [{ id: best.id, name: best.name, type: best.type, value: best.value }];
    }
  }

  // Суммируем stackable скидки
  let stackDiscount = 0;
  const stackApplied: typeof result.appliedRules = [];
  for (const rule of stackable) {
    const d = calcDiscount(productPrice, rule.type, rule.value);
    stackDiscount += d;
    stackApplied.push({ id: rule.id, name: rule.name, type: rule.type, value: rule.value });
  }

  // Берем большее: non-stackable или сумма stackable
  if (stackDiscount > discount) {
    discount = stackDiscount;
    result.appliedRules = stackApplied;
  }

  // Ограничение: скидка не больше 90% от цены
  discount = Math.min(discount, productPrice * 0.9);

  result.totalDiscount = Math.round(discount * 100) / 100;
  result.discountedPrice = Math.round((productPrice - discount) * 100) / 100;

  return result;
}

// Применить промокод к корзине
export async function applyPromoCode(
  promoCode: string,
  cartItems: CartItemForDiscount[],
  userId: string,
): Promise<{ valid: boolean; discount: number; ruleName?: string }> {
  const rule = await prisma.discountRule.findUnique({
    where: { promoCode },
  });

  if (!rule || !rule.isActive) {
    return { valid: false, discount: 0 };
  }

  // Проверка дат
  const now = new Date();
  if (rule.validFrom && rule.validFrom > now) return { valid: false, discount: 0 };
  if (rule.validUntil && rule.validUntil < now) return { valid: false, discount: 0 };

  // Проверка по пользователю
  if (rule.targetUserIds.length > 0 && !rule.targetUserIds.includes(userId)) {
    return { valid: false, discount: 0 };
  }

  // Рассчитываем скидку по корзине
  let totalDiscount = 0;
  for (const item of cartItems) {
    // Проверка по тегам
    if (rule.targetTags.length > 0) {
      const hasTag = rule.targetTags.some(tag => item.tags.includes(tag));
      if (!hasTag) continue;
    }

    const itemTotal = item.price * item.quantity;
    totalDiscount += calcDiscount(itemTotal, rule.type, rule.value);
  }

  return {
    valid: true,
    discount: Math.round(totalDiscount * 100) / 100,
    ruleName: rule.name,
  };
}

function calcDiscount(price: number, type: DiscountType, value: number): number {
  if (type === 'PERCENT') {
    return price * (value / 100);
  }
  // FIXED - но не больше цены
  return Math.min(value, price);
}
