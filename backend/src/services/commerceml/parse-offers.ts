import { XMLParser } from 'fast-xml-parser';
import fs from 'fs/promises';

// Структура offers.xml в CommerceML 2.05+:
// <КоммерческаяИнформация>
//   <ПакетПредложений>
//     <Предложения>
//       <Предложение>
//         <Ид>GUID</Ид>                       <- ссылка на Товар
//         <Артикул>SKU</Артикул>
//         <Цены>
//           <Цена>
//             <ЦенаЗаЕдиницу>1490.00</ЦенаЗаЕдиницу>
//             <Валюта>RUB</Валюта>
//           </Цена>
//         </Цены>
//         <Количество>42</Количество>
//       </Предложение>
//     </Предложения>
//   </ПакетПредложений>
// </КоммерческаяИнформация>

export interface ParsedOffer {
  externalId: string;
  sku?: string;
  price?: number;
  stock?: number;
}

function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function extractPrice(pricesNode: unknown): number | undefined {
  if (!pricesNode || typeof pricesNode !== 'object') return undefined;
  const prices = toArray((pricesNode as { Цена?: unknown }).Цена) as Array<Record<string, unknown>>;
  if (!prices.length) return undefined;

  // Берём первую цену (в мастере настройки 1С вид цен выбирается на стороне 1С,
  // нам приходит уже отфильтрованный)
  const raw = prices[0].ЦенаЗаЕдиницу;
  const parsed = parseFloat(String(raw || '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function parseOffersXml(filePath: string): Promise<ParsedOffer[]> {
  const xml = await fs.readFile(filePath, 'utf-8');

  const parser = new XMLParser({
    ignoreAttributes: true,
    parseTagValue: false,
    trimValues: true,
  });

  const doc = parser.parse(xml) as Record<string, unknown>;
  const root = (doc.КоммерческаяИнформация || {}) as Record<string, unknown>;
  const pkg = (root.ПакетПредложений || {}) as Record<string, unknown>;
  const offersNode = pkg.Предложения as { Предложение?: unknown } | undefined;

  const offers: ParsedOffer[] = [];
  for (const o of toArray(offersNode?.Предложение) as Array<Record<string, unknown>>) {
    const externalId = String(o.Ид || '').trim();
    if (!externalId) continue;

    const stockRaw = o.Количество;
    const stock = stockRaw !== undefined
      ? parseInt(String(stockRaw).replace(',', '.'), 10)
      : undefined;

    offers.push({
      externalId,
      sku: o.Артикул ? String(o.Артикул).trim() : undefined,
      price: extractPrice(o.Цены),
      stock: Number.isFinite(stock) ? stock : undefined,
    });
  }

  return offers;
}
