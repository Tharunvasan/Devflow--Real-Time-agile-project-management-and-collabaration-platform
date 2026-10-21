import { Router } from 'express';
import { getUsers, getUserById, updateUser, deleteUser } from '../controllers/userController';
import { authenticate, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';

const router = Router();

router.use(authenticate);
router.get('/', getUsers);
router.get('/:id', getUserById);
router.put('/:id', authorize(UserRole.ADMIN), updateUser);
router.delete('/:id', authorize(UserRole.ADMIN), deleteUser);

export default router;
