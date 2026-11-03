import { prisma } from '../config/db';
import { env } from '../config/env';

// Маппинг статусов из 1С в наши
const STATUS_MAP: Record<string, string> = {
  'Новый': 'NEW',
  'В обработке': 'PROCESSING',
  'Отправлен': 'SHIPPED',
  'Доставлен': 'DELIVERED',
  'Отменен': 'CANCELLED',
};

// Маппинг заказа в формат 1С
function mapOrderTo1C(order: {
  orderNumber: string;
  total: number;
  discountTotal: number;
  deliveryMethod: string | null;
  user: { email: string; name: string; phone: string | null };
  deliveryAddress: { address: string; city: string; postalCode: string | null } | null;
  items: { product: { name: string }; size: string; quantity: number; price: number; discountAmount: number }[];
}) {
  return {
    Number: order.orderNumber,
    Date: new Date().toISOString(),
    Customer: {
      Email: order.user.email,
      Name: order.user.name,
      Phone: order.user.phone || '',
    },
    DeliveryAddress: order.deliveryAddress ? {
      Address: order.deliveryAddress.address,
      City: order.deliveryAddress.city,
      PostalCode: order.deliveryAddress.postalCode || '',
    } : null,
    DeliveryMethod: order.deliveryMethod || '',
    Total: order.total,
    DiscountTotal: order.discountTotal,
    Items: order.items.map(item => ({
      ProductName: item.product.name,
      Size: item.size,
      Quantity: item.quantity,
      Price: item.price,
      DiscountAmount: item.discountAmount,
    })),
  };
}

// Отправка заказа в 1С
export async function sendOrderTo1C(orderId: string): Promise<boolean> {
  if (!env.onec.url) {
    console.log('[1C] URL не настроен, пропускаем отправку');
    return false;
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      user: { select: { email: true, name: true, phone: true } },
      deliveryAddress: true,
      items: { include: { product: { select: { name: true } } } },
    },
  });

  if (!order) return false;

  const payload = mapOrderTo1C(order);
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    attempts++;

    const logEntry = await prisma.exchangeLog.create({
      data: {
        direction: 'OUTGOING',
        entityType: 'order',
        entityId: orderId,
        status: 'PENDING',
        request: JSON.parse(JSON.stringify(payload)),
      },
    });

    try {
      const response = await fetch(env.onec.url + '/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic ' + Buffer.from(`${env.onec.user}:${env.onec.pass}`).toString('base64'),
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30000),
      });

      const responseData = await response.text();

      if (response.ok) {
        await prisma.exchangeLog.update({
          where: { id: logEntry.id },
          data: { status: 'SUCCESS', response: { status: response.status, body: responseData } },
        });
        return true;
      }

      await prisma.exchangeLog.update({
        where: { id: logEntry.id },
        data: { status: 'FAILED', error: `HTTP ${response.status}`, response: { body: responseData } },
      });
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      await prisma.exchangeLog.update({
        where: { id: logEntry.id },
        data: { status: 'FAILED', error: errorMsg },
      });
    }

    // Экспоненциальная задержка: 2с, 4с, 8с
    if (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempts) * 1000));
    }
  }

  return false;
}

// Запрос статусов заказов из 1С
export async function syncOrderStatusesFrom1C(): Promise<number> {
  if (!env.onec.url) return 0;

  const logEntry = await prisma.exchangeLog.create({
    data: {
      direction: 'INCOMING',
      entityType: 'order_statuses',
      status: 'PENDING',
    },
  });

  try {
    // Получаем заказы в активных статусах
    const activeOrders = await prisma.order.findMany({
      where: { status: { in: ['NEW', 'PROCESSING', 'SHIPPED'] } },
      select: { id: true, orderNumber: true, status: true },
    });

    if (activeOrders.length === 0) {
      await prisma.exchangeLog.update({
        where: { id: logEntry.id },
        data: { status: 'SUCCESS', response: { message: 'Нет активных заказов' } },
      });
      return 0;
    }

    const orderNumbers = activeOrders.map(o => o.orderNumber);

    const response = await fetch(env.onec.url + '/orders/statuses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + Buffer.from(`${env.onec.user}:${env.onec.pass}`).toString('base64'),
      },
      body: JSON.stringify({ orderNumbers }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json() as { statuses: { orderNumber: string; status: string }[] };
    let updated = 0;

    for (const item of data.statuses || []) {
      const newStatus = STATUS_MAP[item.status];
      if (!newStatus) continue;

      const order = activeOrders.find(o => o.orderNumber === item.orderNumber);
      if (!order || order.status === newStatus) continue;

      await prisma.order.update({
        where: { id: order.id },
        data: { status: newStatus as 'NEW' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' },
      });
      updated++;
    }

    await prisma.exchangeLog.update({
      where: { id: logEntry.id },
      data: { status: 'SUCCESS', response: { checked: activeOrders.length, updated } },
    });

    return updated;
  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    await prisma.exchangeLog.update({
      where: { id: logEntry.id },
      data: { status: 'FAILED', error: errorMsg },
    });
    return 0;
  }
}

// Заготовка для приема каталога из 1С
export async function receiveProductsFrom1C(products: {
  name: string;
  price: number;
  category: string;
  description?: string;
  sizes?: string[];
}[]): Promise<number> {
  let imported = 0;

  for (const p of products) {
    await prisma.product.create({
      data: {
        name: p.name,
        price: p.price,
        category: p.category,
        description: p.description || '',
        sizes: p.sizes || [],
        tags: [],
        details: [],
      },
    });
    imported++;
  }

  await prisma.exchangeLog.create({
    data: {
      direction: 'INCOMING',
      entityType: 'product_catalog',
      status: 'SUCCESS',
      response: JSON.parse(JSON.stringify({ imported })),
    },
  });

  return imported;
}
