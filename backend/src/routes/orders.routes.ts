import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  createOrder,
  getOrders,
  getOrder,
  cancelOrder,
} from '../controllers/orders.controller';

const router = Router();

router.use(authenticate);

router.post('/', createOrder);
router.get('/', getOrders);
router.get('/:id', getOrder);
router.post('/:id/cancel', cancelOrder);

export default router;
