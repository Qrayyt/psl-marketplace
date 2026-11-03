import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
} from '../controllers/addresses.controller';

const router = Router();

router.use(authenticate);

router.get('/', getAddresses);
router.post('/', createAddress);
router.patch('/:id', updateAddress);
router.delete('/:id', deleteAddress);
router.patch('/:id/default', setDefaultAddress);

export default router;
