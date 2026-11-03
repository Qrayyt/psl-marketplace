import { prisma } from '../../config/db';
import { ParsedImport, ParsedCatalogItem } from './parse-import';
import { ParsedOffer } from './parse-offers';

export interface ApplyResult {
  created: number;
  updated: number;
  skipped: number;
}

// Раскладываем реквизиты 1С в наши поля товара
function mapProperties(item: ParsedCatalogItem): {
  color: string | null;
  sizes: string[];
  tags: string[];
  details: string[];
} {
  const color = item.properties['Цвет']?.trim() || null;

  // Размер может прийти как "Размер" или "Размеры" (значение через запятую)
  const sizesRaw = item.properties['Размер'] || item.properties['Размеры'] || '';
  const sizes = sizesRaw
    .split(/[,;]/)
    .map(s => s.trim())
    .filter(Boolean);

  const tagsRaw = item.properties['Теги'] || '';
  const tags = tagsRaw.split(/[,;]/).map(s => s.trim()).filter(Boolean);

  const details: string[] = [];
  for (const [key, value] of Object.entries(item.properties)) {
    if (['Цвет', 'Размер', 'Размеры', 'Теги'].includes(key)) continue;
    if (!value) continue;
    details.push(`${key}: ${value}`);
  }

  return { color, sizes, tags, details };
}

// import.xml: каталог (описания, картинки, структура)
export async function applyImport(parsed: ParsedImport): Promise<ApplyResult> {
  const result: ApplyResult = { created: 0, updated: 0, skipped: 0 };

  // Маппинг groupId -> название (для поля category)
  const groupMap = new Map<string, string>();
  for (const g of parsed.groups) groupMap.set(g.externalId, g.name);

  for (const item of parsed.items) {
    const { color, sizes, tags, details } = mapProperties(item);
    const category = item.groupIds
      .map(id => groupMap.get(id))
      .find(Boolean) || 'Без категории';

    const existing = await prisma.product.findUnique({
      where: { externalId: item.externalId },
    });

    if (existing) {
      await prisma.product.update({
        where: { id: existing.id },
        data: {
          name: item.name || existing.name,
          sku: item.sku ?? existing.sku,
          description: item.description ?? existing.description,
          category,
          color: color ?? existing.color,
          sizes: sizes.length ? sizes : existing.sizes,
          tags: tags.length ? tags : existing.tags,
          details: details.length ? details : existing.details,
        },
      });
      result.updated++;
    } else {
      await prisma.product.create({
        data: {
          externalId: item.externalId,
          sku: item.sku,
          name: item.name || '(без названия)',
          description: item.description,
          category,
          color,
          sizes,
          tags,
          details,
          price: 0,
          stock: 0,
        },
      });
      result.created++;
    }
  }

  return result;
}

// offers.xml: цены и остатки
export async function applyOffers(offers: ParsedOffer[]): Promise<ApplyResult> {
  const result: ApplyResult = { created: 0, updated: 0, skipped: 0 };

  for (const offer of offers) {
    const product = await prisma.product.findUnique({
      where: { externalId: offer.externalId },
    });

    if (!product) {
      // Предложение пришло раньше товара — пропускаем, следующая синхронизация подхватит
      result.skipped++;
      continue;
    }

    const data: { price?: number; stock?: number } = {};
    if (offer.price !== undefined) data.price = offer.price;
    if (offer.stock !== undefined) data.stock = offer.stock;

    if (Object.keys(data).length === 0) {
      result.skipped++;
      continue;
    }

    await prisma.product.update({ where: { id: product.id }, data });
    result.updated++;
  }

  return result;
}
