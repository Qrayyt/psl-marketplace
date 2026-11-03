import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
  syncCart,
  applyPromo,
  removePromo,
} from '../controllers/cart.controller';

const router = Router();

// Все эндпоинты корзины требуют авторизации
router.use(authenticate);

router.get('/', getCart);
router.post('/', addToCart);
router.post('/sync', syncCart);
router.post('/apply-promo', applyPromo);
router.patch('/:id', updateCartItem);
router.delete('/promo', removePromo);
router.delete('/:id', removeCartItem);
router.delete('/', clearCart);

export default router;
