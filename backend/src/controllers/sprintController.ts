import { Request, Response, NextFunction } from 'express';
import { Sprint, SprintStatus } from '../models/Sprint';
import { Task, TaskStatus } from '../models/Task';
import { Project } from '../models/Project';
import { NotificationType } from '../models/Notification';
import { ActivityAction } from '../models/Activity';
import { ActivityService } from '../services/activityService';
import { AppError } from '../middleware/errorHandler';
import { getIO } from '../sockets/socketManager';
import { verifyProjectMember } from './taskController';

export const getSprintsByProject = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { projectId } = req.params;
    await verifyProjectMember(projectId, req.user!.id, req.user?.role);

    const sprints = await Sprint.find({ project: projectId })
      .populate('createdBy', 'name email')
      .populate({ path: 'tasks', populate: { path: 'assignedTo', select: 'name email avatar' } })
      .sort({ startDate: 1 });

    // Calculate historical team velocity from completed sprints
    const completedSprints = sprints.filter((s) => s.status === SprintStatus.COMPLETED);
    const velocityHistory = completedSprints.map((s) => {
      const points = (s.tasks as any[]).reduce((sum, t) => {
        return t && t.status === TaskStatus.DONE ? sum + (t.storyPoints || 0) : sum;
      }, 0);
      return {
        sprintId: s._id,
        name: s.name,
        completedPoints: points,
      };
    });

    const averageVelocity =
      velocityHistory.length > 0
        ? Math.round(velocityHistory.reduce((sum, v) => sum + v.completedPoints, 0) / velocityHistory.length)
        : 0;

    const cleanSprints = sprints.map(s => {
      const obj = s.toObject();
      obj.tasks = (obj.tasks || []).filter(Boolean);
      return obj;
    });

    res.status(200).json({
      success: true,
      data: {
        sprints: cleanSprints,
        metrics: {
          velocityHistory,
          averageVelocity,
          completedSprintCount: completedSprints.length,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const createSprint = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, goal, project, startDate, endDate } = req.body;

    const projectDoc = await verifyProjectMember(project, req.user!.id, req.user?.role);

    const isOwner = projectDoc.createdBy.toString() === req.user!.id;
    const isManager = projectDoc.members.some(
      (m: any) => m.user.toString() === req.user!.id && m.role === 'MANAGER'
    );
    if (!isOwner && !isManager && req.user!.role !== 'ADMIN') {
      throw new AppError('Not authorized to create sprints in this project', 403);
    }

    const sprint = await Sprint.create({
      name,
      goal,
      project,
      startDate,
      endDate,
      createdBy: req.user!.id,
    });

    const populated = await sprint.populate('createdBy', 'name email');

    await ActivityService.recordActivity({
      project,
      actor: req.user!.id,
      action: ActivityAction.SPRINT_STARTED,
      details: `Created sprint "${name}"`,
      resourceType: 'SPRINT',
      resourceId: sprint._id.toString(),
    });

    const io = getIO();
    if (io) {
      io.to(`project:${project}`).emit('sprint:created', populated);
    }

    res.status(201).json({ success: true, message: 'Sprint created', data: { sprint: populated } });
  } catch (error) {
    next(error);
  }
};

export const getSprintById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const sprint = await Sprint.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate({
        path: 'tasks',
        populate: [
          { path: 'assignedTo', select: 'name email avatar' },
          { path: 'createdBy', select: 'name email' },
        ],
      });

    if (!sprint) throw new AppError('Sprint not found', 404);

    const projId = (sprint.project as any)?._id?.toString() || (sprint.project as any)?.toString();

    await verifyProjectMember(projId, req.user!.id, req.user?.role);

    // Calculate progress and story points
    const rawTasks = (sprint.tasks as any[]) || [];
    const tasks = rawTasks.filter((t) => t && typeof t === 'object');
    const totalTasks = tasks.length;
    let completedTasks = 0;
    let totalStoryPoints = 0;
    let completedStoryPoints = 0;

    tasks.forEach((t) => {
      const sp = typeof t.storyPoints === 'number' ? t.storyPoints : 0;
      totalStoryPoints += sp;
      if (t.status === TaskStatus.DONE) {
        completedTasks++;
        completedStoryPoints += sp;
      }
    });

    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    // Calculate realistic burndown data points across sprint duration
    const start = new Date(sprint.startDate).getTime();
    const end = new Date(sprint.endDate).getTime();
    const durationDays = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)));
    const now = Date.now();

    const burndown: { day: string; ideal: number; actual: number | null }[] = [];
    for (let i = 0; i <= durationDays; i++) {
      const pointDate = new Date(start + i * 24 * 60 * 60 * 1000);
      const dayLabel = pointDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const idealRemaining = Math.max(0, Math.round(totalStoryPoints - (totalStoryPoints / durationDays) * i));

      let actualRemaining: number | null = null;
      if (pointDate.getTime() <= now) {
        // Points done by this date
        const pointsDoneByDate = tasks.reduce((sum, t) => {
          if (t && t.status === TaskStatus.DONE && t.updatedAt && new Date(t.updatedAt).getTime() <= pointDate.getTime()) {
            return sum + (t.storyPoints || 0);
          }
          return sum;
        }, 0);
        actualRemaining = Math.max(0, totalStoryPoints - pointsDoneByDate);
      }

      burndown.push({
        day: dayLabel,
        ideal: idealRemaining,
        actual: actualRemaining,
      });
    }

    const cleanSprint = sprint.toObject();
    cleanSprint.tasks = (cleanSprint.tasks || []).filter(Boolean);

    res.status(200).json({
      success: true,
      data: {
        sprint: cleanSprint,
        stats: {
          totalTasks,
          completedTasks,
          remainingTasks: totalTasks - completedTasks,
          progress,
          totalStoryPoints,
          completedStoryPoints,
          remainingStoryPoints: totalStoryPoints - completedStoryPoints,
        },
        burndown,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateSprint = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, goal, startDate, endDate, status } = req.body;
    const sprint = await Sprint.findById(req.params.id);
    if (!sprint) throw new AppError('Sprint not found', 404);

    const projectDoc = await verifyProjectMember(sprint.project.toString(), req.user!.id, req.user?.role);

    const isOwner = projectDoc.createdBy.toString() === req.user!.id;
    const isManager = projectDoc.members.some(
      (m: any) => m.user.toString() === req.user!.id && m.role === 'MANAGER'
    );
    if (!isOwner && !isManager && req.user!.role !== 'ADMIN') {
      throw new AppError('Not authorized to update this sprint', 403);
    }

    const wasActive = sprint.status === SprintStatus.ACTIVE;

    const updated = await Sprint.findByIdAndUpdate(
      req.params.id,
      { name, goal, startDate, endDate, status },
      { new: true, runValidators: true }
    ).populate('createdBy', 'name email');

    if (!updated) throw new AppError('Sprint not found', 404);

    const io = getIO();

    if (status === SprintStatus.ACTIVE && !wasActive) {
      // Notify project members
      for (const m of projectDoc.members) {
        await ActivityService.createNotification({
          recipient: m.user.toString(),
          type: NotificationType.SPRINT_STARTED,
          message: `Sprint "${updated.name}" has started`,
          relatedProject: sprint.project.toString(),
        });
      }

      await ActivityService.recordActivity({
        project: sprint.project.toString(),
        actor: req.user!.id,
        action: ActivityAction.SPRINT_STARTED,
        details: `Started sprint "${updated.name}"`,
        resourceType: 'SPRINT',
        resourceId: updated._id.toString(),
      });

      if (io) io.to(`project:${sprint.project}`).emit('sprint:started', updated);
    }

    if (status === SprintStatus.COMPLETED) {
      // Safely eject incomplete tasks back to product backlog
      const incompleteTasks = await Task.find({ sprint: updated._id, status: { $ne: TaskStatus.DONE } });
      if (incompleteTasks.length > 0) {
        await Task.updateMany(
          { sprint: updated._id, status: { $ne: TaskStatus.DONE } },
          { $set: { sprint: null } }
        );
        const incompleteTaskIds = incompleteTasks.map((t) => t._id);
        await Sprint.findByIdAndUpdate(updated._id, {
          $pull: { tasks: { $in: incompleteTaskIds } },
        });
      }

      // Notify project members
      for (const m of projectDoc.members) {
        await ActivityService.createNotification({
          recipient: m.user.toString(),
          type: NotificationType.SPRINT_COMPLETED,
          message: `Sprint "${updated.name}" has been completed`,
          relatedProject: sprint.project.toString(),
        });
      }

      await ActivityService.recordActivity({
        project: sprint.project.toString(),
        actor: req.user!.id,
        action: ActivityAction.SPRINT_COMPLETED,
        details: `Completed sprint "${updated.name}" (${incompleteTasks.length} incomplete tasks returned to backlog)`,
        resourceType: 'SPRINT',
        resourceId: updated._id.toString(),
      });

      if (io) io.to(`project:${sprint.project}`).emit('sprint:completed', updated);
    }

    if (io) io.to(`project:${sprint.project}`).emit('sprint:updated', updated);

    res.status(200).json({ success: true, message: 'Sprint updated', data: { sprint: updated } });
  } catch (error) {
    next(error);
  }
};

export const deleteSprint = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const sprint = await Sprint.findById(req.params.id);
    if (!sprint) throw new AppError('Sprint not found', 404);

    const projectDoc = await verifyProjectMember(sprint.project.toString(), req.user!.id, req.user?.role);

    const isOwner = projectDoc.createdBy.toString() === req.user!.id;
    const isManager = projectDoc.members.some(
      (m: any) => m.user.toString() === req.user!.id && m.role === 'MANAGER'
    );
    if (!isOwner && !isManager && req.user!.role !== 'ADMIN') {
      throw new AppError('Not authorized to delete this sprint', 403);
    }

    await Sprint.findByIdAndDelete(req.params.id);
    await Task.updateMany({ sprint: sprint._id }, { $unset: { sprint: '' } });

    const io = getIO();
    if (io) io.to(`project:${sprint.project}`).emit('sprint:deleted', { sprintId: sprint._id });

    res.status(200).json({ success: true, message: 'Sprint deleted' });
  } catch (error) {
    next(error);
  }
};

export const addTaskToSprint = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { taskId } = req.body;
    const sprint = await Sprint.findById(req.params.id);
    if (!sprint) throw new AppError('Sprint not found', 404);

    await verifyProjectMember(sprint.project.toString(), req.user!.id, req.user?.role);

    if (sprint.tasks.map(String).includes(taskId)) {
      throw new AppError('Task already in sprint', 409);
    }

    sprint.tasks.push(taskId);
    await sprint.save();
    const updatedTask = await Task.findByIdAndUpdate(taskId, { sprint: sprint._id }, { new: true })
      .populate('assignedTo createdBy', 'name email avatar');

    const io = getIO();
    if (io) {
      io.to(`project:${sprint.project}`).emit('task:updated', updatedTask);
      io.to(`project:${sprint.project}`).emit('sprint:updated', sprint);
    }

    res.status(200).json({ success: true, message: 'Task added to sprint', data: { sprint } });
  } catch (error) {
    next(error);
  }
};

export const removeTaskFromSprint = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const sprint = await Sprint.findById(req.params.id);
    if (!sprint) throw new AppError('Sprint not found', 404);

    await verifyProjectMember(sprint.project.toString(), req.user!.id, req.user?.role);

    await Sprint.findByIdAndUpdate(req.params.id, { $pull: { tasks: req.params.taskId } });
    const updatedTask = await Task.findByIdAndUpdate(req.params.taskId, { $unset: { sprint: '' } }, { new: true })
      .populate('assignedTo createdBy', 'name email avatar');

    const io = getIO();
    if (io) {
      io.to(`project:${sprint.project}`).emit('task:updated', updatedTask);
      io.to(`project:${sprint.project}`).emit('sprint:updated', sprint);
    }

    res.status(200).json({ success: true, message: 'Task removed from sprint', data: { sprint } });
  } catch (error) {
    next(error);
  }
};
