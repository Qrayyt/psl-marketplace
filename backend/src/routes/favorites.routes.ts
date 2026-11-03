import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getFavorites,
  addFavorite,
  removeFavorite,
  favoriteToCart,
  syncFavorites,
} from '../controllers/favorites.controller';

const router = Router();

router.use(authenticate);

router.get('/', getFavorites);
router.post('/sync', syncFavorites);
router.post('/:productId', addFavorite);
router.post('/:productId/to-cart', favoriteToCart);
router.delete('/:productId', removeFavorite);

export default router;
