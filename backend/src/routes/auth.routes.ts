import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  register,
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
  getProfile,
  updateProfile,
} from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// Strict rate limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 10,
  message: { success: false, error: { message: 'Too many attempts, try again later' } },
});

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/reset-password', authLimiter, resetPassword);

// Protected
router.get('/me', authenticate, getProfile);
router.patch('/me', authenticate, updateProfile);

export default router;
