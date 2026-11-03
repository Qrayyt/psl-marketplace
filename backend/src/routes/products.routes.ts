import { Router } from 'express';
import { listProducts, getProduct, getCategories, getAllProducts } from '../controllers/products.controller';
import { optionalAuth } from '../middleware/auth';

const router = Router();

/**
 * @openapi
 * /products:
 *   get:
 *     summary: Список товаров с фильтрацией и пагинацией
 *     tags: [Каталог]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *       - in: query
 *         name: tags
 *         schema: { type: string }
 *         description: Через запятую
 *       - in: query
 *         name: price_min
 *         schema: { type: number }
 *       - in: query
 *         name: price_max
 *         schema: { type: number }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: sort
 *         schema: { type: string, enum: [price_asc, price_desc, newest, popular, rating] }
 */
router.get('/', optionalAuth, listProducts);

/**
 * @openapi
 * /products/categories:
 *   get:
 *     summary: Список категорий
 *     tags: [Каталог]
 */
router.get('/categories', getCategories);

/**
 * @openapi
 * /products/all:
 *   get:
 *     summary: Все товары (замена window.PRODUCTS для фронтенда)
 *     tags: [Каталог]
 *     description: Возвращает плоский массив всех активных товаров в формате data.js
 */
router.get('/all', getAllProducts);

/**
 * @openapi
 * /products/{id}:
 *   get:
 *     summary: Карточка товара
 *     tags: [Каталог]
 */
router.get('/:id', optionalAuth, getProduct);

export default router;
