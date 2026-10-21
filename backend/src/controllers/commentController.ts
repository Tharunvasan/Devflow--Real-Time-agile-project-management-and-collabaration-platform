import { Request, Response, NextFunction } from 'express';
import { Comment } from '../models/Comment';
import { Task } from '../models/Task';
import { Issue } from '../models/Issue';
import { NotificationType } from '../models/Notification';
import { ActivityAction } from '../models/Activity';
import { ActivityService } from '../services/activityService';
import { AppError } from '../middleware/errorHandler';
import { getIO } from '../sockets/socketManager';
import { verifyProjectMember } from './taskController';

export const getCommentsByTask = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const task = await Task.findById(req.params.taskId);
    if (!task) throw new AppError('Task not found', 404);

    await verifyProjectMember(task.project.toString(), req.user!.id, req.user?.role);

    const comments = await Comment.find({ task: req.params.taskId })
      .populate('author', 'name email avatar')
      .sort({ createdAt: 1 });

    res.status(200).json({ success: true, data: { comments } });
  } catch (error) {
    next(error);
  }
};

export const getCommentsByIssue = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const issue = await Issue.findById(req.params.issueId);
    if (!issue) throw new AppError('Issue not found', 404);

    await verifyProjectMember(issue.project.toString(), req.user!.id, req.user?.role);

    const comments = await Comment.find({ issue: req.params.issueId })
      .populate('author', 'name email avatar')
      .sort({ createdAt: 1 });

    res.status(200).json({ success: true, data: { comments } });
  } catch (error) {
    next(error);
  }
};

export const createComment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { content, taskId, issueId } = req.body;

    if (!content || !content.trim()) {
      throw new AppError('Comment content is required', 400);
    }

    if (!taskId && !issueId) {
      throw new AppError('Comment must belong to a task or issue', 400);
    }

    let projectId: string | null = null;
    let resourceTitle = '';
    let taskDoc: any = null;
    let issueDoc: any = null;

    if (taskId) {
      taskDoc = await Task.findById(taskId);
      if (!taskDoc) throw new AppError('Task not found', 404);
      const proj = taskDoc.project.toString();
      projectId = proj;
      resourceTitle = taskDoc.title;
      await verifyProjectMember(proj, req.user!.id, req.user?.role);
    } else if (issueId) {
      issueDoc = await Issue.findById(issueId);
      if (!issueDoc) throw new AppError('Issue not found', 404);
      const proj = issueDoc.project.toString();
      projectId = proj;
      resourceTitle = issueDoc.title;
      await verifyProjectMember(proj, req.user!.id, req.user?.role);
    }

    if (!projectId) throw new AppError('Invalid project association', 400);

    const comment = await Comment.create({
      content,
      author: req.user!.id,
      task: taskId || null,
      issue: issueId || null,
    });

    const populated = await comment.populate('author', 'name email avatar');

    // Always emit real-time comment to the project room so all collaborators see it
    const io = getIO();
    if (io) {
      io.to(`project:${projectId}`).emit('comment:new', populated);
    }

    // Notify task creator/assignee or issue reporter if different from author
    if (taskDoc) {
      const recipientId =
        taskDoc.assignedTo && taskDoc.assignedTo.toString() !== req.user!.id
          ? taskDoc.assignedTo.toString()
          : taskDoc.createdBy.toString() !== req.user!.id
          ? taskDoc.createdBy.toString()
          : null;

      if (recipientId) {
        await ActivityService.createNotification({
          recipient: recipientId,
          type: NotificationType.COMMENT_ADDED,
          message: `New comment on task "${taskDoc.title}"`,
          relatedProject: projectId,
          relatedTask: taskDoc._id.toString(),
        });
      }

      await ActivityService.recordActivity({
        project: projectId,
        actor: req.user!.id,
        action: ActivityAction.COMMENT_ADDED,
        details: `Commented on task "${taskDoc.title}"`,
        resourceType: 'TASK',
        resourceId: taskDoc._id.toString(),
      });
    }

    if (issueDoc) {
      const recipientId =
        issueDoc.reportedBy && issueDoc.reportedBy.toString() !== req.user!.id
          ? issueDoc.reportedBy.toString()
          : issueDoc.assignedTo && issueDoc.assignedTo.toString() !== req.user!.id
          ? issueDoc.assignedTo.toString()
          : null;

      if (recipientId) {
        await ActivityService.createNotification({
          recipient: recipientId,
          type: NotificationType.COMMENT_ADDED,
          message: `New comment on issue "${issueDoc.title}"`,
          relatedProject: projectId,
          relatedIssue: issueDoc._id.toString(),
        });
      }

      await ActivityService.recordActivity({
        project: projectId,
        actor: req.user!.id,
        action: ActivityAction.COMMENT_ADDED,
        details: `Commented on issue "${issueDoc.title}"`,
        resourceType: 'ISSUE',
        resourceId: issueDoc._id.toString(),
      });
    }

    res.status(201).json({ success: true, message: 'Comment added', data: { comment: populated } });
  } catch (error) {
    next(error);
  }
};

export const updateComment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { content } = req.body;
    const comment = await Comment.findById(req.params.id);
    if (!comment) throw new AppError('Comment not found', 404);
    if (comment.author.toString() !== req.user!.id) {
      throw new AppError('Not authorized to edit this comment', 403);
    }

    comment.content = content;
    await comment.save();
    const updated = await comment.populate('author', 'name email avatar');

    res.status(200).json({ success: true, message: 'Comment updated', data: { comment: updated } });
  } catch (error) {
    next(error);
  }
};

export const deleteComment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) throw new AppError('Comment not found', 404);
    if (comment.author.toString() !== req.user!.id && req.user!.role !== 'ADMIN') {
      throw new AppError('Not authorized to delete this comment', 403);
    }
    await Comment.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: 'Comment deleted' });
  } catch (error) {
    next(error);
  }
};
