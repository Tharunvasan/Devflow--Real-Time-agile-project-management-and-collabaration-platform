import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { Project } from '../models/Project';
import { Task, TaskStatus } from '../models/Task';
import { AppError } from '../middleware/errorHandler';

/**
 * Configure GitHub integration for a project.
 * If credentials are not available, it mocks the connection but allows the project to register a repository string.
 */
export const connectGithub = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { repository, token } = req.body;
    const project = await Project.findById(req.params.projectId);
    
    if (!project) throw new AppError('Project not found', 404);

    const isOwner = project.createdBy.toString() === req.user!.id;
    if (!isOwner && req.user!.role !== 'ADMIN') {
      throw new AppError('Only project owners can configure GitHub integration', 403);
    }

    // In a real app, 'token' would be exchanged via OAuth. 
    // Here we store it for the webhook verification and API access.
    project.githubIntegration = {
      repository,
      accessToken: token || 'mock-token',
      connectedBy: req.user!.id as any,
      connectedAt: new Date(),
    };

    await project.save();
    res.status(200).json({ success: true, message: 'GitHub connected successfully', data: { githubIntegration: project.githubIntegration } });
  } catch (error) {
    next(error);
  }
};

/**
 * Disconnect GitHub integration for a project.
 */
export const disconnectGithub = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) throw new AppError('Project not found', 404);

    const isOwner = project.createdBy.toString() === req.user!.id;
    if (!isOwner && req.user!.role !== 'ADMIN') {
      throw new AppError('Only project owners can configure GitHub integration', 403);
    }

    project.githubIntegration = undefined;
    await project.save();
    
    res.status(200).json({ success: true, message: 'GitHub disconnected successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * Webhook receiver for GitHub events.
 * Listens for push and pull_request events to link commits/PRs to tasks.
 * Matches task IDs in commit messages (e.g. "Fixes #1234567890abcdef12345678" or just the raw ID if it's unique).
 * Note: MongoDB ObjectIds are 24 hex characters.
 */
export const githubWebhook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const event = req.headers['x-github-event'];
    // In a real app, we would verify the 'x-hub-signature-256' here using the project's secret.
    
    // Attempt to parse out the project ID from the query param or URL path (e.g., /api/github/webhook/:projectId)
    const projectId = req.params.projectId;
    if (!projectId) {
      res.status(400).json({ success: false, message: 'Missing projectId' });
      return;
    }

    const payload = req.body;
    
    if (event === 'push') {
      const commits = payload.commits || [];
      for (const commit of commits) {
        // Look for 24-char hex strings in commit message
        const matches = commit.message.match(/[a-fA-F0-9]{24}/g);
        if (matches) {
          for (const taskId of matches) {
            // Find task and add a comment indicating the linked commit
            const task = await Task.findById(taskId);
            if (task && task.project.toString() === projectId) {
              // In real scenario, we might link the commit ID to a "commits" array on the Task.
              // For now, we simulate integration by completing the task if "Fixes" is mentioned.
              if (/fix(es|ed)?|resolve(s|d)?/i.test(commit.message)) {
                 task.status = TaskStatus.DONE;
                 await task.save();
              }
            }
          }
        }
      }
    }
    
    res.status(200).json({ success: true, message: 'Webhook processed' });
  } catch (error) {
    next(error);
  }
};
