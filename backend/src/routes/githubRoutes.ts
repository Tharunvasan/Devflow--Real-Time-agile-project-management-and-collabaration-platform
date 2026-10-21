import { Router } from 'express';
import { connectGithub, disconnectGithub, githubWebhook } from '../controllers/githubController';
import { authenticate } from '../middleware/auth';

const router = Router();

// Configuration routes (Protected)
router.post('/projects/:projectId/connect', authenticate, connectGithub);
router.delete('/projects/:projectId/disconnect', authenticate, disconnectGithub);

// Webhook route (Unprotected, verified by signature ideally)
router.post('/webhook/:projectId', githubWebhook);

export default router;
