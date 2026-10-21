import { Router } from 'express';
import { getNotifications, markAsRead, markAllAsRead } from '../controllers/notificationController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.get('/', getNotifications);
router.put('/read-all', markAllAsRead);
router.patch('/read-all', markAllAsRead);
router.put('/:id/read', markAsRead);
router.patch('/:id/read', markAsRead);

export default router;
