import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/db';
import { successResponse } from '../../utils/apiResponse';

export async function getStats(_req: Request, res: Response, next: NextFunction) {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart.getTime() - 7 * 86400000);
    const monthStart = new Date(todayStart.getTime() - 30 * 86400000);

    const [
      ordersToday,
      ordersWeek,
      ordersMonth,
      totalUsers,
      totalProducts,
      revenueToday,
      revenueWeek,
      revenueMonth,
      topProducts,
    ] = await Promise.all([
      prisma.order.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.order.count({ where: { createdAt: { gte: weekStart } } }),
      prisma.order.count({ where: { createdAt: { gte: monthStart } } }),
      prisma.user.count(),
      prisma.product.count({ where: { isActive: true } }),
      prisma.order.aggregate({ where: { createdAt: { gte: todayStart }, status: { not: 'CANCELLED' } }, _sum: { total: true } }),
      prisma.order.aggregate({ where: { createdAt: { gte: weekStart }, status: { not: 'CANCELLED' } }, _sum: { total: true } }),
      prisma.order.aggregate({ where: { createdAt: { gte: monthStart }, status: { not: 'CANCELLED' } }, _sum: { total: true } }),
      prisma.orderItem.groupBy({
        by: ['productId'],
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 10,
      }),
    ]);

    // Обогатим топ товаров названиями
    const topProductIds = topProducts.map(p => p.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: topProductIds } },
      select: { id: true, name: true, price: true, imageUrl: true },
    });
    const productMap = new Map(products.map(p => [p.id, p]));

    const topProductsEnriched = topProducts.map(p => ({
      product: productMap.get(p.productId),
      totalSold: p._sum.quantity,
    }));

    successResponse(res, {
      orders: {
        today: ordersToday,
        week: ordersWeek,
        month: ordersMonth,
      },
      revenue: {
        today: revenueToday._sum.total || 0,
        week: revenueWeek._sum.total || 0,
        month: revenueMonth._sum.total || 0,
      },
      totalUsers,
      totalProducts,
      topProducts: topProductsEnriched,
    });
  } catch (err) {
    next(err);
  }
}
