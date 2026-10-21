import { Router } from 'express';
import { getProjectActivities, getTaskActivities } from '../controllers/activityController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.get('/project/:projectId', getProjectActivities);
router.get('/task/:taskId', getTaskActivities);

export default router;
