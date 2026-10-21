import { Router } from 'express';
import { getCommentsByTask, getCommentsByIssue, createComment, updateComment, deleteComment } from '../controllers/commentController';
import { authenticate } from '../middleware/auth';
import { body } from 'express-validator';
import { validate } from '../middleware/validate';

const router = Router();

router.use(authenticate);
router.get('/task/:taskId', getCommentsByTask);
router.get('/issue/:issueId', getCommentsByIssue);
router.post('/', [
  body('content').trim().isLength({ min: 1, max: 1000 }).withMessage('Comment must be 1-1000 characters'),
], validate, createComment);
router.put('/:id', [body('content').trim().isLength({ min: 1, max: 1000 })], validate, updateComment);
router.delete('/:id', deleteComment);

export default router;
