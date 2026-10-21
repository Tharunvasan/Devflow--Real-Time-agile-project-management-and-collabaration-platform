import { Router } from 'express';
import { getIssues, createIssue, getIssueById, updateIssue, deleteIssue, uploadIssueAttachment } from '../controllers/issueController';
import { upload } from '../middleware/upload';
import { authenticate } from '../middleware/auth';
import { body } from 'express-validator';
import { validate } from '../middleware/validate';

const router = Router();

router.use(authenticate);
router.get('/', getIssues);
router.post('/', [
  body('title').trim().isLength({ min: 2, max: 200 }).withMessage('Issue title must be 2-200 characters'),
  body('project').notEmpty().withMessage('Project is required'),
], validate, createIssue);
router.get('/:id', getIssueById);
router.put('/:id', updateIssue);
router.delete('/:id', deleteIssue);
router.post('/:id/attachments', upload.single('file'), uploadIssueAttachment);

export default router;
