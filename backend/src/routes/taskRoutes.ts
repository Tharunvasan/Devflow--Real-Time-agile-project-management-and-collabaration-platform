import { Router } from 'express';
import { getTasks, createTask, getTaskById, updateTask, deleteTask, uploadAttachment } from '../controllers/taskController';
import { upload } from '../middleware/upload';
import { authenticate } from '../middleware/auth';
import { body } from 'express-validator';
import { validate } from '../middleware/validate';

const router = Router();

router.use(authenticate);
router.get('/', getTasks);
router.post('/', [
  body('title').trim().isLength({ min: 2, max: 200 }).withMessage('Task title must be 2-200 characters'),
  body('project').notEmpty().withMessage('Project is required'),
], validate, createTask);
router.get('/:id', getTaskById);
router.put('/:id', updateTask);
router.delete('/:id', deleteTask);
router.post('/:id/attachments', upload.single('file'), uploadAttachment);

export default router;
