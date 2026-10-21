import { Router } from 'express';
import { getSprintsByProject, createSprint, getSprintById, updateSprint, deleteSprint, addTaskToSprint, removeTaskFromSprint } from '../controllers/sprintController';
import { authenticate } from '../middleware/auth';
import { body } from 'express-validator';
import { validate } from '../middleware/validate';

const router = Router();

router.use(authenticate);
router.get('/project/:projectId', getSprintsByProject);
router.post('/', [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Sprint name is required'),
  body('project').notEmpty().withMessage('Project is required'),
  body('startDate').isISO8601().withMessage('Valid start date is required'),
  body('endDate').isISO8601().withMessage('Valid end date is required'),
], validate, createSprint);
router.get('/:id', getSprintById);
router.put('/:id', updateSprint);
router.delete('/:id', deleteSprint);
router.post('/:id/tasks', [body('taskId').notEmpty()], validate, addTaskToSprint);
router.delete('/:id/tasks/:taskId', removeTaskFromSprint);

export default router;
