import { Request, Response, NextFunction } from 'express';
import { Issue, IssueStatus } from '../models/Issue';
import { Comment } from '../models/Comment';
import { Project } from '../models/Project';
import { NotificationType } from '../models/Notification';
import { ActivityAction } from '../models/Activity';
import { ActivityService } from '../services/activityService';
import { AppError } from '../middleware/errorHandler';
import { getIO } from '../sockets/socketManager';
import { verifyProjectMember } from './taskController';

export const getIssues = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { project, status, severity, priority, assignedTo, search, page = 1, limit = 50 } = req.query;
    const query: any = {};
    const userId = req.user!.id;

    if (project) {
      await verifyProjectMember(project as string, userId, req.user?.role);
      query.project = project;
    } else {
      const userProjects = await Project.find({
        $or: [{ createdBy: userId }, { 'members.user': userId }],
      }).select('_id');
      const allowedIds = userProjects.map((p) => p._id);
      query.project = { $in: allowedIds };
    }

    if (status) query.status = status;
    if (severity) query.severity = severity;
    if (priority) query.priority = priority;
    if (assignedTo) query.assignedTo = assignedTo;
    if (search) query.title = { $regex: search, $options: 'i' };

    const skip = (Number(page) - 1) * Number(limit);
    const [issues, total] = await Promise.all([
      Issue.find(query)
        .populate('reportedBy', 'name email avatar')
        .populate('assignedTo', 'name email avatar')
        .populate('project', 'name key')
        .populate('relatedTask', 'title taskKey status')
        .skip(skip)
        .limit(Number(limit))
        .sort({ createdAt: -1 }),
      Issue.countDocuments(query),
    ]);

    res.status(200).json({ success: true, data: { issues, total } });
  } catch (error) {
    next(error);
  }
};

export const createIssue = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const {
      title,
      description,
      reproductionSteps,
      expectedBehavior,
      resolution,
      relatedTask,
      project,
      assignedTo,
      severity,
      priority,
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

    const count = await Issue.countDocuments({ project });
    const prefix =
      projectDoc.key ||
      projectDoc.name
        .substring(0, 4)
        .toUpperCase()
        .replace(/[^A-Z]/g, '') ||
      'ISSUE';
    const issueKey = `${prefix}-BUG-${count + 1}`;

    const issue = await Issue.create({
      issueKey,
      title,
      description,
      reproductionSteps,
      expectedBehavior,
      resolution,
      relatedTask: relatedTask || null,
      project,
      assignedTo: assignedTo || null,
      severity,
      priority,
      reportedBy: req.user!.id,
      status: IssueStatus.OPEN,
    });

    const populated = await issue.populate([
      { path: 'reportedBy', select: 'name email avatar' },
      { path: 'assignedTo', select: 'name email avatar' },
      { path: 'project', select: 'name key' },
      { path: 'relatedTask', select: 'title taskKey status' },
    ]);

    // Notify assignee
    if (assignedTo && assignedTo !== req.user!.id) {
      await ActivityService.createNotification({
        recipient: assignedTo,
        type: NotificationType.ISSUE_ASSIGNED,
        message: `You were assigned an issue: "${title}" (${issueKey})`,
        relatedProject: project,
        relatedIssue: issue._id.toString(),
      });
    }

    // Record activity
    await ActivityService.recordActivity({
      project: project.toString(),
      actor: req.user!.id,
      action: ActivityAction.ISSUE_CREATED,
      details: `Reported issue ${issueKey}: "${title}"`,
      resourceType: 'ISSUE',
      resourceId: issue._id.toString(),
    });

    // Real-time broadcast
    const io = getIO();
    if (io) {
      io.to(`project:${project}`).emit('issue:created', populated);
    }

    res.status(201).json({ success: true, message: 'Issue created', data: { issue: populated } });
  } catch (error) {
    next(error);
  }
};

export const getIssueById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const issue = await Issue.findById(req.params.id)
      .populate('reportedBy', 'name email avatar')
      .populate('assignedTo', 'name email avatar')
      .populate('project', 'name key members createdBy')
      .populate('relatedTask', 'title taskKey status');

    if (!issue) throw new AppError('Issue not found', 404);

    await verifyProjectMember(issue.project._id.toString(), req.user!.id, req.user?.role);

    res.status(200).json({ success: true, data: { issue } });
  } catch (error) {
    next(error);
  }
};

export const updateIssue = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const {
      title,
      description,
      reproductionSteps,
      expectedBehavior,
      resolution,
      relatedTask,
      status,
      severity,
      priority,
      assignedTo,
    } = req.body;

    const existingIssue = await Issue.findById(req.params.id);
    if (!existingIssue) throw new AppError('Issue not found', 404);

    const projectDoc = await verifyProjectMember(existingIssue.project.toString(), req.user!.id, req.user?.role);

    if (assignedTo) {
      const isAssigneeMember =
        projectDoc.members.some((m: any) => m.user.toString() === assignedTo) ||
        projectDoc.createdBy.toString() === assignedTo;
      if (!isAssigneeMember) {
        throw new AppError('Assignee must be a member of the project', 400);
      }
    }

    const oldStatus = existingIssue.status;
    const oldAssignee = existingIssue.assignedTo?.toString();

    const updateFields: Record<string, any> = {};
    if (title !== undefined) updateFields.title = title;
    if (description !== undefined) updateFields.description = description;
    if (reproductionSteps !== undefined) updateFields.reproductionSteps = reproductionSteps;
    if (expectedBehavior !== undefined) updateFields.expectedBehavior = expectedBehavior;
    if (resolution !== undefined) updateFields.resolution = resolution;
    if (relatedTask !== undefined) updateFields.relatedTask = relatedTask || null;
    if (status !== undefined) updateFields.status = status;
    if (severity !== undefined) updateFields.severity = severity;
    if (priority !== undefined) updateFields.priority = priority;
    if (assignedTo !== undefined) updateFields.assignedTo = assignedTo || null;

    const issue = await Issue.findByIdAndUpdate(req.params.id, updateFields, {
      new: true,
      runValidators: true,
    }).populate([
      { path: 'reportedBy', select: 'name email avatar' },
      { path: 'assignedTo', select: 'name email avatar' },
      { path: 'project', select: 'name key' },
      { path: 'relatedTask', select: 'title taskKey status' },
    ]);

    if (!issue) throw new AppError('Issue not found', 404);

    // Notify assignee if changed
    if (assignedTo && assignedTo !== oldAssignee && assignedTo !== req.user!.id) {
      await ActivityService.createNotification({
        recipient: assignedTo,
        type: NotificationType.ISSUE_ASSIGNED,
        message: `You were assigned to issue: "${issue.title}"`,
        relatedProject: issue.project._id.toString(),
        relatedIssue: issue._id.toString(),
      });
    }

    // Status changed
    if (status !== undefined && status !== oldStatus) {
      const isResolved = [IssueStatus.FIXED, IssueStatus.VERIFIED, IssueStatus.CLOSED].includes(status);
      if (issue.reportedBy && issue.reportedBy._id.toString() !== req.user!.id) {
        await ActivityService.createNotification({
          recipient: issue.reportedBy._id.toString(),
          type: isResolved ? NotificationType.ISSUE_RESOLVED : NotificationType.TASK_UPDATED,
          message: `Issue "${issue.title}" status changed to ${status}`,
          relatedProject: issue.project._id.toString(),
          relatedIssue: issue._id.toString(),
        });
      }

      await ActivityService.recordActivity({
        project: issue.project._id.toString(),
        actor: req.user!.id,
        action: isResolved ? ActivityAction.ISSUE_RESOLVED : ActivityAction.ISSUE_UPDATED,
        details: `Issue "${issue.title}" status updated to ${status}`,
        resourceType: 'ISSUE',
        resourceId: issue._id.toString(),
      });
    } else {
      await ActivityService.recordActivity({
        project: issue.project._id.toString(),
        actor: req.user!.id,
        action: ActivityAction.ISSUE_UPDATED,
        details: `Updated issue "${issue.title}"`,
        resourceType: 'ISSUE',
        resourceId: issue._id.toString(),
      });
    }

    const io = getIO();
    if (io) {
      io.to(`project:${issue.project._id.toString()}`).emit('issue:updated', issue);
    }

    res.status(200).json({ success: true, message: 'Issue updated', data: { issue } });
  } catch (error) {
    next(error);
  }
};

export const deleteIssue = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const issue = await Issue.findById(req.params.id);
    if (!issue) throw new AppError('Issue not found', 404);

    const projectDoc = await Project.findById(issue.project);
    if (!projectDoc) throw new AppError('Project not found', 404);

    const isOwner = projectDoc.createdBy.toString() === req.user!.id;
    const isReporter = issue.reportedBy.toString() === req.user!.id;
    const isManager = projectDoc.members.some(
      (m: any) => m.user.toString() === req.user!.id && m.role === 'MANAGER'
    );

    if (!isOwner && !isManager && !isReporter && req.user!.role !== 'ADMIN') {
      throw new AppError('Not authorized to delete this issue', 403);
    }

    await Issue.findByIdAndDelete(req.params.id);
    await Comment.deleteMany({ issue: issue._id });

    await ActivityService.recordActivity({
      project: issue.project.toString(),
      actor: req.user!.id,
      action: ActivityAction.ISSUE_UPDATED,
      details: `Deleted issue "${issue.title}"`,
      resourceType: 'ISSUE',
      resourceId: issue._id.toString(),
    });

    const io = getIO();
    if (io) io.to(`project:${issue.project}`).emit('issue:deleted', { issueId: issue._id });

    res.status(200).json({ success: true, message: 'Issue deleted' });
  } catch (error) {
    next(error);
  }
};

export const uploadIssueAttachment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.file) {
      throw new AppError('No file uploaded', 400);
    }

    const issue = await Issue.findById(req.params.id);
    if (!issue) throw new AppError('Issue not found', 404);

    await verifyProjectMember(issue.project.toString(), req.user!.id, req.user?.role);

    const attachment = {
      filename: req.file.originalname,
      url: `/uploads/${req.file.filename}`,
      uploadedBy: req.user!.id as any,
      uploadedAt: new Date(),
    };

    issue.attachments.push(attachment);
    await issue.save();

    const populated = await issue.populate('attachments.uploadedBy', 'name email avatar');

    const io = getIO();
    if (io) io.to(`project:${issue.project}`).emit('issue:updated', populated);

    res.status(200).json({
      success: true,
      message: 'Attachment uploaded successfully',
      data: { attachment: populated.attachments[populated.attachments.length - 1] },
    });
  } catch (error) {
    next(error);
  }
};
