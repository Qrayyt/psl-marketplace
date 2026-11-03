import { XMLBuilder } from 'fast-xml-parser';
import { prisma } from '../../config/db';

// Маппинг наших статусов -> строкового описания для 1С
// В мастере 1С клиент сопоставит эти названия с состояниями документа
const STATUS_LABEL: Record<string, string> = {
  NEW: 'Новый',
  PROCESSING: 'В обработке',
  SHIPPED: 'Отправлен',
  DELIVERED: 'Доставлен',
  CANCELLED: 'Отменён',
};

function formatDate(d: Date): string {
  // CommerceML хочет YYYY-MM-DD
  return d.toISOString().slice(0, 10);
}

function formatTime(d: Date): string {
  return d.toISOString().slice(11, 19);
}

// Отдаём заказы, которые ещё не синхронизированы ИЛИ изменились после последней синхронизации
export async function serializeOrdersXml(): Promise<string> {
  const orders = await prisma.order.findMany({
    where: {
      OR: [
        { syncedAt: null },
        { updatedAt: { gt: prisma.order.fields.syncedAt } },
      ],
    },
    include: {
      user: { select: { email: true, name: true, phone: true } },
      deliveryAddress: true,
      items: {
        include: {
          product: { select: { externalId: true, sku: true, name: true, price: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const documents = orders.map(order => {
    const customer = {
      Ид: order.userId,
      Наименование: order.user.name,
      ПолноеНаименование: order.user.name,
      Роль: 'Покупатель',
      Контакты: {
        Контакт: [
          { Тип: 'Почта', Значение: order.user.email },
          ...(order.user.phone ? [{ Тип: 'Телефон рабочий', Значение: order.user.phone }] : []),
        ],
      },
    };

    const товары = order.items.map(item => ({
      Ид: item.product.externalId || item.productId,
      Артикул: item.product.sku || '',
      Наименование: item.product.name,
      БазоваяЕдиница: { Код: '796', НаименованиеПолное: 'Штука', Сокращение: 'шт' },
      ЦенаЗаЕдиницу: item.price.toFixed(2),
      Количество: item.quantity,
      Сумма: (item.price * item.quantity).toFixed(2),
      ЗначенияРеквизитов: item.size ? {
        ЗначениеРеквизита: [{ Наименование: 'Размер', Значение: item.size }],
      } : undefined,
    }));

    const реквизиты = [
      { Наименование: 'Заказ оплачен', Значение: 'false' },
      { Наименование: 'Доставка разрешена', Значение: 'true' },
      { Наименование: 'Статус заказа', Значение: STATUS_LABEL[order.status] || order.status },
      { Наименование: 'Метод оплаты', Значение: 'Картой онлайн' },
    ];

    if (order.deliveryMethod) {
      реквизиты.push({ Наименование: 'Способ доставки', Значение: order.deliveryMethod });
    }
    if (order.promoCode) {
      реквизиты.push({ Наименование: 'Промокод', Значение: order.promoCode });
    }

    return {
      Ид: order.id,
      Номер: order.orderNumber,
      Дата: formatDate(order.createdAt),
      Время: formatTime(order.createdAt),
      ХозОперация: 'Заказ товара',
      Роль: 'Продавец',
      Валюта: 'RUB',
      Курс: 1,
      Сумма: order.total.toFixed(2),
      Контрагенты: { Контрагент: customer },
      Товары: { Товар: товары },
      ЗначенияРеквизитов: { ЗначениеРеквизита: реквизиты },
      Комментарий: order.deliveryAddress
        ? `Адрес: ${order.deliveryAddress.city}, ${order.deliveryAddress.address}${order.deliveryAddress.postalCode ? ', ' + order.deliveryAddress.postalCode : ''}`
        : '',
    };
  });

  const doc = {
    '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
    КоммерческаяИнформация: {
      '@_ВерсияСхемы': '2.05',
      '@_ДатаФормирования': new Date().toISOString(),
      Документ: documents,
    },
  };

  const builder = new XMLBuilder({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    format: true,
    suppressEmptyNode: true,
  });

  return '<?xml version="1.0" encoding="UTF-8"?>\n' + builder.build({ КоммерческаяИнформация: doc.КоммерческаяИнформация });
}

// Вызывается при успешном приёме заказов 1С (/api/1c/exchange?type=sale&mode=success)
export async function markOrdersSynced(orderIds?: string[]): Promise<number> {
  const where = orderIds && orderIds.length
    ? { id: { in: orderIds } }
    : {
        OR: [
          { syncedAt: null },
          { updatedAt: { gt: prisma.order.fields.syncedAt } },
        ],
      };

  const result = await prisma.order.updateMany({
    where,
    data: { syncedAt: new Date() },
  });

  return result.count;
}
