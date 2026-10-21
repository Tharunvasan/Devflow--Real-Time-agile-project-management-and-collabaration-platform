import mongoose from 'mongoose';
import { Request, Response, NextFunction } from 'express';
import { Task, TaskStatus } from '../models/Task';
import { Sprint } from '../models/Sprint';
import { Comment } from '../models/Comment';
import { Project } from '../models/Project';
import { NotificationType } from '../models/Notification';
import { ActivityAction } from '../models/Activity';
import { ActivityService } from '../services/activityService';
import { AppError } from '../middleware/errorHandler';
import { getIO } from '../sockets/socketManager';

/**
 * Verify user membership or ownership in a project
 */
export const verifyProjectMember = async (projectId: string, userId: string, userRole?: string): Promise<any> => {
  const project = await Project.findById(projectId);
  if (!project) throw new AppError('Project not found', 404);

  const isOwner = project.createdBy.toString() === userId;
  const isMember = project.members.some((m: any) => m.user.toString() === userId);

  if (!isOwner && !isMember && userRole !== 'ADMIN') {
    throw new AppError('Not authorized to access this project', 403);
  }

  return project;
};

export const getTasks = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { project, sprint, status, priority, assignedTo, search, overdue, page = 1, limit = 100 } = req.query;
    const query: any = {};
    const userId = req.user!.id;

    if (project) {
      await verifyProjectMember(project as string, userId, req.user?.role);
      query.project = project;
    } else {
      // Find all projects the user is authorized to view
      const userProjects = await Project.find({
        $or: [{ createdBy: userId }, { 'members.user': userId }],
      }).select('_id');
      const allowedIds = userProjects.map((p) => p._id);
      query.project = { $in: allowedIds };
    }

    if (sprint) query.sprint = sprint;
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (assignedTo) query.assignedTo = assignedTo;
    if (search) query.title = { $regex: search, $options: 'i' };
    if (overdue === 'true') {
      query.dueDate = { $lt: new Date() };
      query.status = { $ne: TaskStatus.DONE };
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [tasks, total] = await Promise.all([
      Task.find(query)
        .populate('assignedTo', 'name email avatar')
        .populate('createdBy', 'name email avatar')
        .populate('project', 'name key')
        .populate('sprint', 'name')
        .populate('dependencies', 'title taskKey status')
        .skip(skip)
        .limit(Number(limit))
        .sort({ order: 1, createdAt: -1 }),
      Task.countDocuments(query),
    ]);

    res.status(200).json({ success: true, data: { tasks, total } });
  } catch (error) {
    next(error);
  }
};

export const createTask = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const {
      title,
      description,
      project,
      sprint,
      assignedTo,
      priority,
      dueDate,
      labels,
      storyPoints,
      estimatedHours,
      isBlocked,
      blockedReason,
      subtasks,
      dependencies,
    } = req.body;

    const projectDoc = await verifyProjectMember(project, req.user!.id, req.user?.role);

    if (assignedTo) {
      const isAssigneeMember =
        projectDoc.members.some((m: any) => m.user.toString() === assignedTo) ||
        projectDoc.createdBy.toString() === assignedTo;
      if (!isAssigneeMember) {
        throw new AppError('Assignee must be a member of the project', 400);
      }
    }

    // Generate readable taskKey
    const taskCount = await Task.countDocuments({ project });
    const prefix =
      projectDoc.key ||
      projectDoc.name
        .substring(0, 4)
        .toUpperCase()
        .replace(/[^A-Z]/g, '') ||
      'DEV';
    const taskKey = `${prefix}-${taskCount + 1}`;

    // Get order within column
    const highestOrderTask = await Task.findOne({ project, status: TaskStatus.TODO }).sort({ order: -1 });
    const order = highestOrderTask && typeof highestOrderTask.order === 'number' ? highestOrderTask.order + 1 : 0;

    const task = await Task.create({
      title,
      taskKey,
      order,
      description,
      project,
      sprint: sprint || null,
      assignedTo: assignedTo || null,
      priority,
      dueDate,
      storyPoints,
      estimatedHours,
      isBlocked: isBlocked || false,
      blockedReason,
      labels: labels || [],
      subtasks: (subtasks || []).map((st: any) => ({
        id: st.id || new mongoose.Types.ObjectId().toString(),
        title: st.title,
        completed: !!st.completed,
      })),
      dependencies: dependencies || [],
      createdBy: req.user!.id,
      status: TaskStatus.TODO,
    });

    if (sprint) {
      await Sprint.findByIdAndUpdate(sprint, { $addToSet: { tasks: task._id } });
    }

    const populated = await task.populate([
      { path: 'assignedTo', select: 'name email avatar' },
      { path: 'createdBy', select: 'name email avatar' },
      { path: 'project', select: 'name key' },
      { path: 'sprint', select: 'name' },
      { path: 'dependencies', select: 'title taskKey status' },
    ]);

    // Notify assignee
    if (assignedTo && assignedTo !== req.user!.id) {
      await ActivityService.createNotification({
        recipient: assignedTo,
        type: NotificationType.TASK_ASSIGNED,
        message: `You were assigned a new task: "${title}" (${taskKey})`,
        relatedProject: project,
        relatedTask: task._id.toString(),
      });
    }

    // Record activity
    await ActivityService.recordActivity({
      project: project.toString(),
      actor: req.user!.id,
      action: ActivityAction.TASK_CREATED,
      details: `Created task ${taskKey}: "${title}"`,
      resourceType: 'TASK',
      resourceId: task._id.toString(),
      metadata: { taskKey, title, priority, status: TaskStatus.TODO },
    });

    // Real-time socket broadcast
    const io = getIO();
    if (io) {
      io.to(`project:${project}`).emit('task:created', populated);
    }

    res.status(201).json({ success: true, message: 'Task created', data: { task: populated } });
  } catch (error) {
    next(error);
  }
};

export const getTaskById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('assignedTo', 'name email avatar')
      .populate('createdBy', 'name email avatar')
      .populate('project', 'name key members createdBy')
      .populate('sprint', 'name')
      .populate('dependencies', 'title taskKey status');

    if (!task) throw new AppError('Task not found', 404);

    // Verify access
    await verifyProjectMember(task.project._id.toString(), req.user!.id, req.user?.role);

    res.status(200).json({ success: true, data: { task } });
  } catch (error) {
    next(error);
  }
};

export const updateTask = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const {
      title,
      description,
      status,
      priority,
      assignedTo,
      sprint,
      dueDate,
      labels,
      storyPoints,
      estimatedHours,
      isBlocked,
      blockedReason,
      subtasks,
      dependencies,
      order,
    } = req.body;

    const existingTask = await Task.findById(req.params.id);
    if (!existingTask) throw new AppError('Task not found', 404);

    const projectDoc = await verifyProjectMember(existingTask.project.toString(), req.user!.id, req.user?.role);

    if (assignedTo) {
      const isAssigneeMember =
        projectDoc.members.some((m: any) => m.user.toString() === assignedTo) ||
        projectDoc.createdBy.toString() === assignedTo;
      if (!isAssigneeMember) {
        throw new AppError('Assignee must be a member of the project', 400);
      }
    }

    const oldSprint = existingTask.sprint?.toString();
    const newSprint = sprint !== undefined ? sprint : oldSprint;
    const oldAssignee = existingTask.assignedTo?.toString();
    const oldStatus = existingTask.status;

    const updateFields: Record<string, any> = {};
    if (title !== undefined) updateFields.title = title;
    if (description !== undefined) updateFields.description = description;
    if (status !== undefined) updateFields.status = status;
    if (priority !== undefined) updateFields.priority = priority;
    if (assignedTo !== undefined) updateFields.assignedTo = assignedTo || null;
    if (sprint !== undefined) updateFields.sprint = sprint || null;
    if (dueDate !== undefined) updateFields.dueDate = dueDate;
    if (labels !== undefined) updateFields.labels = labels;
    if (storyPoints !== undefined) updateFields.storyPoints = storyPoints;
    if (estimatedHours !== undefined) updateFields.estimatedHours = estimatedHours;
    if (isBlocked !== undefined) updateFields.isBlocked = isBlocked;
    if (blockedReason !== undefined) updateFields.blockedReason = blockedReason;
    if (subtasks !== undefined) {
      updateFields.subtasks = (subtasks || []).map((st: any) => ({
        id: st.id || new mongoose.Types.ObjectId().toString(),
        title: st.title,
        completed: !!st.completed,
      }));
    }
    if (dependencies !== undefined) updateFields.dependencies = dependencies;
    if (order !== undefined) updateFields.order = order;

    const task = await Task.findByIdAndUpdate(req.params.id, updateFields, {
      new: true,
      runValidators: true,
    }).populate([
      { path: 'assignedTo', select: 'name email avatar' },
      { path: 'createdBy', select: 'name email avatar' },
      { path: 'project', select: 'name key' },
      { path: 'sprint', select: 'name' },
      { path: 'dependencies', select: 'title taskKey status' },
    ]);

    if (!task) throw new AppError('Task not found', 404);

    // Update sprint task references
    if (sprint !== undefined && oldSprint !== newSprint) {
      if (oldSprint) {
        await Sprint.findByIdAndUpdate(oldSprint, { $pull: { tasks: task._id } });
      }
      if (newSprint) {
        await Sprint.findByIdAndUpdate(newSprint, { $addToSet: { tasks: task._id } });
      }
    }

    // Notify new assignee
    if (assignedTo && assignedTo !== oldAssignee && assignedTo !== req.user!.id) {
      await ActivityService.createNotification({
        recipient: assignedTo,
        type: NotificationType.TASK_ASSIGNED,
        message: `You were assigned to task: "${task.title}"`,
        relatedProject: task.project._id.toString(),
        relatedTask: task._id.toString(),
      });
    }

    // Status changed notification
    if (status !== undefined && status !== oldStatus) {
      if (task.createdBy && task.createdBy._id.toString() !== req.user!.id) {
        await ActivityService.createNotification({
          recipient: task.createdBy._id.toString(),
          type: NotificationType.TASK_UPDATED,
          message: `Task "${task.title}" status changed to ${status.replace('_', ' ')}`,
          relatedProject: task.project._id.toString(),
          relatedTask: task._id.toString(),
        });
      }

      await ActivityService.recordActivity({
        project: task.project._id.toString(),
        actor: req.user!.id,
        action: ActivityAction.TASK_STATUS_CHANGED,
        details: `Moved task "${task.title}" to ${status.replace('_', ' ')}`,
        resourceType: 'TASK',
        resourceId: task._id.toString(),
        metadata: { from: oldStatus, to: status, taskId: task._id },
      });
    } else {
      await ActivityService.recordActivity({
        project: task.project._id.toString(),
        actor: req.user!.id,
        action: ActivityAction.TASK_UPDATED,
        details: `Updated task "${task.title}"`,
        resourceType: 'TASK',
        resourceId: task._id.toString(),
      });
    }

    // Real-time broadcast
    const io = getIO();
    if (io) {
      io.to(`project:${task.project._id.toString()}`).emit('task:updated', task);
      if (status === TaskStatus.DONE) {
        io.to(`project:${task.project._id.toString()}`).emit('task:completed', { taskId: task._id });
      }
    }

    res.status(200).json({ success: true, message: 'Task updated', data: { task } });
  } catch (error) {
    next(error);
  }
};

export const deleteTask = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) throw new AppError('Task not found', 404);

    const projectDoc = await Project.findById(task.project);
    if (!projectDoc) throw new AppError('Project not found', 404);

    const isOwner = projectDoc.createdBy.toString() === req.user!.id;
    const isManager = projectDoc.members.some(
      (m: any) => m.user.toString() === req.user!.id && m.role === 'MANAGER'
    );
    if (!isOwner && !isManager && req.user!.role !== 'ADMIN') {
      throw new AppError('Not authorized to delete this task. Only project owners or managers can delete tasks.', 403);
    }

    await Task.findByIdAndDelete(req.params.id);

    // Remove from sprint
    if (task.sprint) {
      await Sprint.findByIdAndUpdate(task.sprint, { $pull: { tasks: task._id } });
    }

    // Cascade delete comments
    await Comment.deleteMany({ task: task._id });

    // Record activity
    await ActivityService.recordActivity({
      project: task.project.toString(),
      actor: req.user!.id,
      action: ActivityAction.TASK_DELETED,
      details: `Deleted task "${task.title}"`,
      resourceType: 'TASK',
      resourceId: task._id.toString(),
    });

    const io = getIO();
    if (io) io.to(`project:${task.project}`).emit('task:deleted', { taskId: task._id });

    res.status(200).json({ success: true, message: 'Task deleted' });
  } catch (error) {
    next(error);
  }
};

export const uploadAttachment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.file) {
      throw new AppError('No file uploaded', 400);
    }

    const task = await Task.findById(req.params.id);
    if (!task) throw new AppError('Task not found', 404);

    await verifyProjectMember(task.project.toString(), req.user!.id, req.user?.role);

    const attachment = {
      filename: req.file.originalname,
      url: `/uploads/${req.file.filename}`,
      uploadedBy: req.user!.id as any,
      uploadedAt: new Date(),
    };

    task.attachments.push(attachment);
    await task.save();

    const populated = await task.populate('attachments.uploadedBy', 'name email avatar');

    const io = getIO();
    if (io) io.to(`project:${task.project}`).emit('task:updated', populated);

    res.status(200).json({
      success: true,
      message: 'Attachment uploaded successfully',
      data: { attachment: populated.attachments[populated.attachments.length - 1] },
    });
  } catch (error) {
    next(error);
  }
};
