import { Router } from 'express';
import { getProjects, createProject, getProjectById, updateProject, deleteProject, addMember, removeMember } from '../controllers/projectController';
import { authenticate, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';
import { body } from 'express-validator';
import { validate } from '../middleware/validate';

const router = Router();

router.use(authenticate);
router.get('/', getProjects);
router.post('/', authorize(UserRole.ADMIN, UserRole.PROJECT_MANAGER), [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Project name must be 2-100 characters'),
  body('description').optional().isLength({ max: 500 }),
], validate, createProject);
router.get('/:id', getProjectById);
router.put('/:id', updateProject);
router.delete('/:id', deleteProject);
router.post('/:id/members', [
  body('userId').notEmpty().withMessage('User ID is required'),
], validate, addMember);
router.delete('/:id/members/:userId', removeMember);

export default router;
