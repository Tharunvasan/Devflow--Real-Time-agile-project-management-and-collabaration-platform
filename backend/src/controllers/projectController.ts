import { Request, Response, NextFunction } from 'express';
import { Project, MemberRole } from '../models/Project';
import { Task } from '../models/Task';
import { Sprint } from '../models/Sprint';
import { Issue } from '../models/Issue';
import { Comment } from '../models/Comment';
import { Notification, NotificationType } from '../models/Notification';
import { ActivityAction } from '../models/Activity';
import { ActivityService } from '../services/activityService';
import { AppError } from '../middleware/errorHandler';
import { getIO } from '../sockets/socketManager';

export const getProjects = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { status, search } = req.query;
    const userId = req.user!.id;

    const query: any = {
      $or: [{ createdBy: userId }, { 'members.user': userId }],
    };
    if (status) query.status = status;
    if (search) query.name = { $regex: search, $options: 'i' };

    const projects = await Project.find(query)
      .populate('createdBy', 'name email avatar')
      .populate('members.user', 'name email avatar')
      .sort({ updatedAt: -1 });

    res.status(200).json({ success: true, data: { projects } });
  } catch (error) {
    next(error);
  }
};

export const createProject = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, key, description, status, startDate, endDate } = req.body;

    // Derived key if not supplied
    const projectKey =
      key ||
      name
        .substring(0, 4)
        .toUpperCase()
        .replace(/[^A-Z]/g, '') ||
      'DEV';

    const project = await Project.create({
      name,
      key: projectKey,
      description,
      status,
      startDate,
      endDate,
      createdBy: req.user!.id,
      members: [{ user: req.user!.id, role: MemberRole.OWNER }],
    });

    const populated = await project.populate([
      { path: 'createdBy', select: 'name email avatar' },
      { path: 'members.user', select: 'name email avatar' },
    ]);

    await ActivityService.recordActivity({
      project: project._id.toString(),
      actor: req.user!.id,
      action: ActivityAction.TASK_CREATED,
      details: `Created project "${name}"`,
      resourceType: 'PROJECT',
      resourceId: project._id.toString(),
    });

    res.status(201).json({ success: true, message: 'Project created', data: { project: populated } });
  } catch (error) {
    next(error);
  }
};

export const getProjectById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('createdBy', 'name email avatar')
      .populate('members.user', 'name email avatar');

    if (!project) throw new AppError('Project not found', 404);

    const isMember =
      project.createdBy._id.toString() === req.user!.id ||
      project.members.some((m) => m.user._id.toString() === req.user!.id);
    if (!isMember && req.user!.role !== 'ADMIN') throw new AppError('Access denied', 403);

    res.status(200).json({ success: true, data: { project } });
  } catch (error) {
    next(error);
  }
};

export const updateProject = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, key, description, status, startDate, endDate } = req.body;

    const project = await Project.findById(req.params.id);
    if (!project) throw new AppError('Project not found', 404);

    const isOwner = project.createdBy.toString() === req.user!.id;
    const isManager = project.members.some(
      (m) => m.user.toString() === req.user!.id && m.role === MemberRole.MANAGER
    );
    if (!isOwner && !isManager && req.user!.role !== 'ADMIN') {
      throw new AppError('Not authorized to update this project', 403);
    }

    const updateFields: Record<string, any> = {};
    if (name !== undefined) updateFields.name = name;
    if (key !== undefined) updateFields.key = key;
    if (description !== undefined) updateFields.description = description;
    if (status !== undefined) updateFields.status = status;
    if (startDate !== undefined) updateFields.startDate = startDate;
    if (endDate !== undefined) updateFields.endDate = endDate;

    const updated = await Project.findByIdAndUpdate(req.params.id, updateFields, {
      new: true,
      runValidators: true,
    }).populate('createdBy members.user', 'name email avatar');

    const io = getIO();
    if (io && updated) {
      io.to(`project:${updated._id}`).emit('project:updated', updated);
    }

    res.status(200).json({ success: true, message: 'Project updated', data: { project: updated } });
  } catch (error) {
    next(error);
  }
};

export const deleteProject = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) throw new AppError('Project not found', 404);

    const isOwner = project.createdBy.toString() === req.user!.id;
    if (!isOwner && req.user!.role !== 'ADMIN') {
      throw new AppError('Not authorized to delete this project', 403);
    }

    const taskIds = (await Task.find({ project: req.params.id }).select('_id')).map((t) => t._id);
    await Comment.deleteMany({
      $or: [
        { task: { $in: taskIds } },
        { issue: { $in: (await Issue.find({ project: req.params.id }).select('_id')).map((i) => i._id) } },
      ],
    });
    await Task.deleteMany({ project: req.params.id });
    await Sprint.deleteMany({ project: req.params.id });
    await Issue.deleteMany({ project: req.params.id });
    await Notification.deleteMany({ relatedProject: req.params.id });
    await Project.findByIdAndDelete(req.params.id);

    const io = getIO();
    if (io) {
      io.to(`project:${project._id}`).emit('project:deleted', { projectId: project._id });
    }

    res.status(200).json({ success: true, message: 'Project deleted' });
  } catch (error) {
    next(error);
  }
};

export const addMember = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId, role = MemberRole.DEVELOPER } = req.body;
    const project = await Project.findById(req.params.id);
    if (!project) throw new AppError('Project not found', 404);

    const isOwner = project.createdBy.toString() === req.user!.id;
    const isManager = project.members.some(
      (m) => m.user.toString() === req.user!.id && m.role === MemberRole.MANAGER
    );
    if (!isOwner && !isManager && req.user!.role !== 'ADMIN') {
      throw new AppError('Not authorized to add members to this project', 403);
    }

    const alreadyMember = project.members.some((m) => m.user.toString() === userId);
    if (alreadyMember) throw new AppError('User is already a project member', 409);

    project.members.push({ user: userId, role });
    await project.save();

    await ActivityService.createNotification({
      recipient: userId,
      type: NotificationType.MEMBER_ADDED,
      message: `You were added to project "${project.name}" as ${role}`,
      relatedProject: project._id.toString(),
    });

    await ActivityService.recordActivity({
      project: project._id.toString(),
      actor: req.user!.id,
      action: ActivityAction.MEMBER_ADDED,
      details: `Added new member to project "${project.name}"`,
      resourceType: 'PROJECT',
      resourceId: project._id.toString(),
    });

    const updated = await Project.findById(req.params.id).populate('createdBy members.user', 'name email avatar');

    const io = getIO();
    if (io && updated) {
      io.to(`project:${project._id}`).emit('member:added', { project: updated, userId });
    }

    res.status(200).json({ success: true, message: 'Member added', data: { project: updated } });
  } catch (error) {
    next(error);
  }
};

export const removeMember = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) throw new AppError('Project not found', 404);

    const isOwner = project.createdBy.toString() === req.user!.id;
    const isManager = project.members.some(
      (m) => m.user.toString() === req.user!.id && m.role === MemberRole.MANAGER
    );
    if (!isOwner && !isManager && req.user!.role !== 'ADMIN') {
      throw new AppError('Not authorized to remove members from this project', 403);
    }

    const targetUserId = req.params.userId;
    if (project.createdBy.toString() === targetUserId) {
      throw new AppError('Cannot remove project creator', 400);
    }

    project.members = project.members.filter((m) => m.user.toString() !== targetUserId);
    await project.save();

    await ActivityService.createNotification({
      recipient: targetUserId,
      type: NotificationType.TASK_UPDATED,
      message: `You were removed from project "${project.name}"`,
      relatedProject: project._id.toString(),
    });

    await ActivityService.recordActivity({
      project: project._id.toString(),
      actor: req.user!.id,
      action: ActivityAction.MEMBER_REMOVED,
      details: `Removed member from project "${project.name}"`,
      resourceType: 'PROJECT',
      resourceId: project._id.toString(),
    });

    const updated = await Project.findById(req.params.id).populate('createdBy members.user', 'name email avatar');

    const io = getIO();
    if (io && updated) {
      io.to(`project:${project._id}`).emit('member:removed', {
        projectId: project._id,
        userId: targetUserId,
        project: updated,
      });
    }

    res.status(200).json({ success: true, message: 'Member removed', data: { project: updated } });
  } catch (error) {
    next(error);
  }
};
