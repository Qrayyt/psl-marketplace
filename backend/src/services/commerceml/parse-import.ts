import { XMLParser } from 'fast-xml-parser';
import fs from 'fs/promises';

// Структура товара из CommerceML 2.05+ import.xml
// <КоммерческаяИнформация>
//   <Классификатор>
//     <Группы><Группа><Ид/><Наименование/></Группа></Группы>
//   </Классификатор>
//   <Каталог>
//     <Товары>
//       <Товар>
//         <Ид>GUID</Ид>
//         <Артикул>SKU</Артикул>
//         <Наименование>Name</Наименование>
//         <Описание>Description</Описание>
//         <Группы><Ид>group-guid</Ид></Группы>
//         <Картинка>relative/path.jpg</Картинка>
//         <ЗначенияРеквизитов>
//           <ЗначениеРеквизита><Наименование>Цвет</Наименование><Значение>Черный</Значение></ЗначениеРеквизита>
//         </ЗначенияРеквизитов>
//       </Товар>
//     </Товары>
//   </Каталог>
// </КоммерческаяИнформация>

export interface ParsedGroup {
  externalId: string;
  name: string;
  parentId?: string;
}

export interface ParsedCatalogItem {
  externalId: string;
  sku?: string;
  name: string;
  description?: string;
  groupIds: string[];
  imagePaths: string[];
  properties: Record<string, string>;
}

export interface ParsedImport {
  groups: ParsedGroup[];
  items: ParsedCatalogItem[];
}

// Преобразуем XML-значение в массив (fast-xml-parser возвращает один объект если элемент единственный)
function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function extractGroups(groupsNode: unknown, parentId?: string): ParsedGroup[] {
  if (!groupsNode || typeof groupsNode !== 'object') return [];
  const raw = (groupsNode as { Группа?: unknown }).Группа;
  const result: ParsedGroup[] = [];
  for (const g of toArray(raw) as Array<Record<string, unknown>>) {
    const externalId = String(g.Ид || '').trim();
    const name = String(g.Наименование || '').trim();
    if (!externalId || !name) continue;
    result.push({ externalId, name, parentId });
    const nested = extractGroups(g.Группы, externalId);
    result.push(...nested);
  }
  return result;
}

function extractItemProperties(valuesNode: unknown): Record<string, string> {
  const props: Record<string, string> = {};
  if (!valuesNode || typeof valuesNode !== 'object') return props;
  const raw = (valuesNode as { ЗначениеРеквизита?: unknown }).ЗначениеРеквизита;
  for (const v of toArray(raw) as Array<Record<string, unknown>>) {
    const key = String(v.Наименование || '').trim();
    const value = String(v.Значение || '').trim();
    if (key) props[key] = value;
  }
  return props;
}

function extractItemGroupIds(groupsNode: unknown): string[] {
  if (!groupsNode || typeof groupsNode !== 'object') return [];
  const raw = (groupsNode as { Ид?: unknown }).Ид;
  return toArray(raw).map(v => String(v).trim()).filter(Boolean);
}

export async function parseImportXml(filePath: string): Promise<ParsedImport> {
  const xml = await fs.readFile(filePath, 'utf-8');

  const parser = new XMLParser({
    ignoreAttributes: true,
    parseTagValue: false,
    trimValues: true,
  });

  const doc = parser.parse(xml) as Record<string, unknown>;
  const root = (doc.КоммерческаяИнформация || {}) as Record<string, unknown>;

  const classifier = (root.Классификатор || {}) as Record<string, unknown>;
  const groups = extractGroups(classifier.Группы);

  const catalog = (root.Каталог || {}) as Record<string, unknown>;
  const itemsNode = catalog.Товары;
  const items: ParsedCatalogItem[] = [];

  for (const t of toArray((itemsNode as { Товар?: unknown } | undefined)?.Товар) as Array<Record<string, unknown>>) {
    const externalId = String(t.Ид || '').trim();
    if (!externalId) continue;

    items.push({
      externalId,
      sku: t.Артикул ? String(t.Артикул).trim() : undefined,
      name: String(t.Наименование || '').trim(),
      description: t.Описание ? String(t.Описание).trim() : undefined,
      groupIds: extractItemGroupIds(t.Группы),
      imagePaths: toArray(t.Картинка).map(v => String(v).trim()).filter(Boolean),
      properties: extractItemProperties(t.ЗначенияРеквизитов),
    });
  }

  return { groups, items };
}
