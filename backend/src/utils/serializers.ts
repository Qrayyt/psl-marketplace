/**
 * Сериализаторы для преобразования данных из БД в формат фронтенда.
 * Фронтенд ожидает формат из оригинального data.js:
 * - id: строка (p1, p2 или uuid)
 * - reviews (не reviewsCount)
 * - oldPrice (не old_price)
 * - image (не imageUrl)
 * - color: строка (название цвета на русском, не hex)
 */

interface DbProduct {
  id: string;
  name: string;
  price: number;
  oldPrice: number | null;
  category: string;
  tags: string[];
  sizes: string[];
  rating: number;
  reviewsCount: number;
  color: string | null;
  description: string | null;
  details: string[];
  accent: string | null;
  imageUrl: string | null;
  imageUrls?: string[];
  isActive: boolean;
  createdAt: Date | string;
}

interface FrontProduct {
  id: string;
  name: string;
  price: number;
  oldPrice: number;
  category: string;
  tags: string[];
  sizes: string[];
  rating: number;
  reviews: number;
  color: string;
  description: string;
  details: string[];
  accent: string;
  image: string;
  imageUrls: string[];
  discountedPrice?: number;
}

// Преобразование товара из БД в формат фронтенда
export function serializeProduct(product: DbProduct, discountedPrice?: number): FrontProduct {
  const urls = product.imageUrls || [];
  // Если основная картинка не входит в список загруженных (битая ссылка на удалённый файл),
  // подставляем первую из списка
  const mainImage = product.imageUrl && urls.includes(product.imageUrl)
    ? product.imageUrl
    : (urls[0] || product.imageUrl || '');

  const result: FrontProduct = {
    id: product.id,
    name: product.name,
    price: product.price,
    oldPrice: product.oldPrice || 0,
    category: product.category,
    tags: product.tags,
    sizes: product.sizes,
    rating: product.rating,
    reviews: product.reviewsCount,
    color: product.color || '',
    description: product.description || '',
    details: product.details,
    accent: product.accent || '#111111',
    image: mainImage,
    imageUrls: urls,
  };

  if (discountedPrice !== undefined && discountedPrice < product.price) {
    result.discountedPrice = discountedPrice;
  }

  return result;
}

// Массив товаров
export function serializeProducts(
  products: DbProduct[],
  discountedPrices?: Map<string, number>,
): FrontProduct[] {
  return products.map(p =>
    serializeProduct(p, discountedPrices?.get(p.id)),
  );
}

interface DbCartItem {
  id: string;
  productId: string;
  size: string;
  quantity: number;
  product: DbProduct;
}

interface FrontCartItem {
  id: string;
  qty: number;
  size: string;
}

// Корзина в формате фронтенда: [{id, qty, size}]
export function serializeCartItems(items: DbCartItem[]): FrontCartItem[] {
  return items.map(item => ({
    id: item.productId,
    qty: item.quantity,
    size: item.size,
  }));
}

// Избранное в формате фронтенда: ["id1", "id2"]
export function serializeFavoriteIds(favorites: { productId: string }[]): string[] {
  return favorites.map(f => f.productId);
}
