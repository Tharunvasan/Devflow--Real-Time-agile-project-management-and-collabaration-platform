import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { body } from 'express-validator';
import {
  linkRepository,
  getRepositories,
  getBranches,
  getCommits,
  getTree,
} from '../controllers/repositoryController';
import { RepositorySource } from '../models/Repository';

const router = Router();

router.use(authenticate);

router.post('/', [
  body('name').trim().notEmpty().withMessage('Repository name is required'),
  body('projectId').notEmpty().withMessage('Project ID is required'),
  body('source').isIn(Object.values(RepositorySource)).withMessage('Invalid source'),
], validate, linkRepository);

router.get('/project/:projectId', getRepositories);

router.get('/:id/branches', getBranches);
router.get('/:id/commits', getCommits);
router.get('/:id/tree', getTree);

export default router;
