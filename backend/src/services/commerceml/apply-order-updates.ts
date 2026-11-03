import { XMLParser } from 'fast-xml-parser';
import fs from 'fs/promises';
import { prisma } from '../../config/db';
import { OrderStatus } from '@prisma/client';

// 1С присылает обратно те же заказы + обновлённые реквизиты
// Нас интересует в первую очередь "Статус заказа" и привязка Ид документа 1С к нашему заказу

// Маппинг строкового статуса из 1С в наш enum
// Клиент может настроить это в админке позже — пока дефолтные соответствия
const DEFAULT_STATUS_MAP: Record<string, OrderStatus> = {
  'Новый': 'NEW',
  'Загружен': 'NEW',
  'Принят': 'PROCESSING',
  'В обработке': 'PROCESSING',
  'Подтверждён': 'PROCESSING',
  'Отгружен': 'SHIPPED',
  'Отправлен': 'SHIPPED',
  'Доставлен': 'DELIVERED',
  'Выполнен': 'DELIVERED',
  'Отменён': 'CANCELLED',
  'Отменен': 'CANCELLED',
  'Отказ': 'CANCELLED',
};

function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function extractStatus(req: unknown): string | undefined {
  if (!req || typeof req !== 'object') return undefined;
  const raw = (req as { ЗначениеРеквизита?: unknown }).ЗначениеРеквизита;
  for (const r of toArray(raw) as Array<Record<string, unknown>>) {
    if (String(r.Наименование || '') === 'Статус заказа') {
      return String(r.Значение || '').trim();
    }
  }
  return undefined;
}

export interface OrderUpdateResult {
  updated: number;
  unknown: number;
  linked: number;
}

export async function applyOrderUpdates(filePath: string): Promise<OrderUpdateResult> {
  const xml = await fs.readFile(filePath, 'utf-8');
  const parser = new XMLParser({
    ignoreAttributes: true,
    parseTagValue: false,
    trimValues: true,
  });

  const doc = parser.parse(xml) as Record<string, unknown>;
  const root = (doc.КоммерческаяИнформация || {}) as Record<string, unknown>;
  const documents = toArray(root.Документ) as Array<Record<string, unknown>>;

  const result: OrderUpdateResult = { updated: 0, unknown: 0, linked: 0 };

  for (const docNode of documents) {
    const idIn1C = String(docNode.Ид || '').trim();
    const orderNumber = String(docNode.Номер || '').trim();
    if (!idIn1C && !orderNumber) continue;

    // Ищем заказ по externalId или по orderNumber (если 1С впервые прислала свой Ид)
    const order = await prisma.order.findFirst({
      where: {
        OR: [
          idIn1C ? { externalId: idIn1C } : {},
          orderNumber ? { orderNumber } : {},
        ].filter(c => Object.keys(c).length > 0),
      },
    });

    if (!order) {
      result.unknown++;
      continue;
    }

    const updates: { externalId?: string; status?: OrderStatus; syncedAt?: Date } = {
      syncedAt: new Date(),
    };

    if (idIn1C && !order.externalId) {
      updates.externalId = idIn1C;
      result.linked++;
    }

    const statusText = extractStatus(docNode.ЗначенияРеквизитов);
    if (statusText) {
      const mapped = DEFAULT_STATUS_MAP[statusText];
      if (mapped && mapped !== order.status) {
        updates.status = mapped;
      }
    }

    await prisma.order.update({ where: { id: order.id }, data: updates });
    result.updated++;
  }

  return result;
}
