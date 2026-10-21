import { Router } from 'express';
import { register, login, getMe, updateProfile, changePassword, registerValidation, loginValidation } from '../controllers/authController';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { body } from 'express-validator';

const router = Router();

router.post('/register', registerValidation, validate, register);
router.post('/login', loginValidation, validate, login);
router.get('/me', authenticate, getMe);
router.put('/profile', authenticate, [
  body('name').optional().trim().isLength({ min: 2, max: 50 }),
], validate, updateProfile);
router.put('/password', authenticate, [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
], validate, changePassword);

export default router;
