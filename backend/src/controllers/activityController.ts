import { Request, Response, NextFunction } from 'express';
import { Activity } from '../models/Activity';
import { Project } from '../models/Project';
import { AppError } from '../middleware/errorHandler';

/**
 * Check if the user is a member/owner of the project or an admin
 */
const verifyProjectAccess = async (projectId: string, userId: string, role?: string): Promise<void> => {
  const project = await Project.findById(projectId);
  if (!project) throw new AppError('Project not found', 404);
  const isOwner = project.createdBy.toString() === userId;
  const isMember = project.members.some((m) => m.user.toString() === userId);
  if (!isOwner && !isMember && role !== 'ADMIN') {
    throw new AppError('Not authorized to access activities for this project', 403);
  }
};

export const getProjectActivities = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { projectId } = req.params;
    const { page = 1, limit = 30 } = req.query;

    await verifyProjectAccess(projectId, req.user!.id, req.user?.role);

    const skip = (Number(page) - 1) * Number(limit);
    const [activities, total] = await Promise.all([
      Activity.find({ project: projectId })
        .populate('actor', 'name email avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Activity.countDocuments({ project: projectId }),
    ]);

    res.status(200).json({ success: true, data: { activities, total } });
  } catch (error) {
    next(error);
  }
};

export const getTaskActivities = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { taskId } = req.params;
    const activities = await Activity.find({ resourceId: taskId })
      .populate('actor', 'name email avatar')
      .sort({ createdAt: -1 })
      .limit(50);

    res.status(200).json({ success: true, data: { activities } });
  } catch (error) {
    next(error);
  }
};
