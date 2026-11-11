import multer from 'multer';
import { listAdminProductDocuments, uploadProductDocument, replaceProductDocument, downloadProductDocument, deleteProductDocument } from '../controllers/product-documents.controller';
import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';

import {
  listProducts, createProduct, updateProduct,
  deleteProduct, restoreProduct, hardDeleteProduct,
  importProducts, uploadProductImage, deleteProductImage,
} from '../controllers/admin/admin-products.controller';
import { upload } from '../middleware/upload';
import { env } from '../config/env';
import { listBrands, createBrand } from '../controllers/admin/admin-brands.controller';

import {
  listUsers, getUser, updateUser,
  blockUser, unblockUser,
} from '../controllers/admin/admin-users.controller';

import {
  listOrders, getOrder, updateOrderStatus,
} from '../controllers/admin/admin-orders.controller';

import {
  listDiscounts, createDiscount,
  updateDiscount, deleteDiscount,
} from '../controllers/admin/admin-discounts.controller';

import { getStats } from '../controllers/admin/admin-stats.controller';
import { getAuditLog } from '../controllers/admin/admin-audit.controller';
import { listCategories, listTags, renameCategory, renameTag } from '../controllers/admin/admin-categories.controller';
import {
  triggerSync, getExchangeLog, receiveProducts,
  listOnecUsers, createOnecUser, updateOnecUser, deleteOnecUser,
} from '../controllers/admin/admin-exchange.controller';

const router = Router();

// Все админские эндпоинты требуют авторизации + роль ADMIN
router.use(authenticate, requireRole('ADMIN'));

// Дашборд
router.get('/stats', getStats);

// Товары
router.get('/brands', listBrands);
router.post('/brands', createBrand);
router.get('/products', listProducts);
const productImage = multer({ storage: multer.memoryStorage(), limits: { fileSize: env.upload.maxFileSize, files: 1, fields: 1 } });
const documentUpload = multer({ storage: multer.memoryStorage(), limits: {
  fileSize: 5 * 1024 * 1024, files: 1, fields: 2,
} });
router.get('/products/:id/documents', listAdminProductDocuments);
router.post('/products/:id/documents', documentUpload.single('document'), uploadProductDocument);
router.get('/products/:id/documents/:documentId', downloadProductDocument);
router.put('/products/:id/documents/:documentId', documentUpload.single('document'), replaceProductDocument);
router.delete('/products/:id/documents/:documentId', deleteProductDocument);
router.post('/products', productImage.single('image'), createProduct);
router.post('/products/import', importProducts);
router.patch('/products/:id', productImage.single('image'), updateProduct);
router.delete('/products/:id', deleteProduct);
router.post('/products/:id/restore', restoreProduct);
router.delete('/products/:id/hard', hardDeleteProduct);
router.post('/products/:id/image', upload.single('image'), uploadProductImage);
router.delete('/products/:id/image', deleteProductImage);

// Пользователи
router.get('/users', listUsers);
router.get('/users/:id', getUser);
router.patch('/users/:id', updateUser);
router.post('/users/:id/block', blockUser);
router.post('/users/:id/unblock', unblockUser);

// Заказы
router.get('/orders', listOrders);
router.get('/orders/:id', getOrder);
router.patch('/orders/:id/status', updateOrderStatus);

// Скидки
router.get('/discounts', listDiscounts);
router.post('/discounts', createDiscount);
router.patch('/discounts/:id', updateDiscount);
router.delete('/discounts/:id', deleteDiscount);

// Категории и теги
router.get('/categories', listCategories);
router.post('/categories/rename', renameCategory);
router.get('/tags', listTags);
router.post('/tags/rename', renameTag);

// Аудит-лог
router.get('/audit-log', getAuditLog);

// Обмен с 1С
router.post('/exchange/sync', triggerSync);
router.get('/exchange/log', getExchangeLog);
router.post('/exchange/products', receiveProducts);

// Учётки 1С
router.get('/exchange/onec-users', listOnecUsers);
router.post('/exchange/onec-users', createOnecUser);
router.patch('/exchange/onec-users/:id', updateOnecUser);
router.delete('/exchange/onec-users/:id', deleteOnecUser);

export default router;
